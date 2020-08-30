import 'isomorphic-fetch'
import path from 'path'
import {promisify} from 'util'
import get from 'lodash/get'
import set from 'lodash/set'
import isArray from 'lodash/isArray'
import orderBy from 'lodash/orderBy'
import yaml from 'yaml'
import fs from 'fs'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import * as jsonwebtoken from 'jsonwebtoken'
import jwkToPem from 'jwk-to-pem'
import bodyParser from 'body-parser'
import hbsfy from 'hbsfy'

const logGreen = str => console.log(`\x1b[32m${str}\x1b[0m`)
const logYellow = str => console.log(`\x1b[33m${str}\x1b[0m`)

const PORT = process.env.PORT || 8180

const verifyPromised = promisify(jsonwebtoken.verify.bind(jsonwebtoken))

const result = dotenv.config()

const app = express()

app.use(cors())
app.use(bodyParser.json())

let cacheKeys = []

require.extensions['.hbs'] = function (module, filename) {
    var file = fs.readFileSync(filename, "utf8");
    var opts = { traverse: true };
    return module._compile(hbsfy.compile(file, opts), filename);
}

async function securityCheck(token, mainConfig) {
    if (!cacheKeys.length) {
        const cognitoIssuer = `https://cognito-idp.${mainConfig.AWS_REGION}.amazonaws.com/${mainConfig.COGNITO_POOL_ID}`
        const url = `${cognitoIssuer}/.well-known/jwks.json`
        const publicKeys = await fetch(url).then(res => res.json())
        cacheKeys = publicKeys.keys.reduce((agg, current) => {
            const pem = jwkToPem(current)
            agg[current.kid] = {instance: current, pem}
            return agg
        }, [])
    }

    const tokenSections = (token || '').split('.')
    const headerJSON = Buffer.from(tokenSections[0], 'base64').toString('utf8')
    const header = JSON.parse(headerJSON)
    const key = cacheKeys[header.kid]
    const claim = await verifyPromised(token, key.pem)

    return claim
}

export default async function main(serverlessConfigFilesPath, mainConfig) {
    serverlessConfigFilesPath.forEach(serverlessConfig => {
        const mainPath = path.join(process.cwd(), serverlessConfig)
        const mainDir = path.dirname(mainPath)
        const relativePath = `../..${mainDir.replace(process.cwd(), '')}`

        const mainLambdaFile = fs.readFileSync(mainPath, 'utf8')
        const parsedFile = yaml.parse(mainLambdaFile)

        logGreen(`loading ${serverlessConfig}`)

        let functions = {}

        if (isArray(parsedFile.functions)) {
            functions = parsedFile.functions.reduce((acc, f) => {
                const content = fs.readFileSync(path.join(process.cwd(), f.replace('${file(', '').replace(')}', '')), 'utf8')
                return { ...acc, ...yaml.parse(content) }
            }, functions)
        } else {
            functions = {...functions, ...parsedFile.functions}
        }

        let handlerFunctions = []

        Object.values(functions)
            .filter(f => f.events)
            .filter(f => f.events.find(e => e.http))
            .forEach(f => {
                const event = f.events[0].http
                const {path, method, authorizer} = event

                const isRouteCognitoAuthorizer = get(authorizer, 'type') === 'COGNITO_USER_POOLS'

                const exportedFunction = f.handler.substring(f.handler.lastIndexOf('.') + 1)

                handlerFunctions.push({
                    filePath: relativePath + '/' + f.handler.replace(`.${exportedFunction}`, ''),
                    path: `/${path.replace('{', ':').replace('}', '')}`,
                    exportedFunction,
                    method,
                    config: { isRouteCognitoAuthorizer },
                })
            })

        handlerFunctions = orderBy(handlerFunctions, ['path', 'method'], ['desc', 'asc'])

        handlerFunctions.forEach(({ filePath, path, exportedFunction, method, config }) => {
            try {
                const handler = require(filePath)[exportedFunction]
                logYellow(`> ${method.padEnd(8, ' ')} ${handler.name.padEnd(40, ' ')} ${path}`)
                app[method](path, async (req, res) => {
                    if (config.isRouteCognitoAuthorizer) {
                        const authentication = get(req, 'headers.authorization')
                        const securityCredentials = await securityCheck(authentication, mainConfig)

                        set(req, 'requestContext.authorizer.claims', securityCredentials)
                    }

                    if (req.query) {
                        set(req, 'queryStringParameters', req.query)
                    }

                    if (req.params) {
                        set(req, 'pathParameters', req.params)
                    }

                    req.body = JSON.stringify(req.body)

                    const response = await handler(req)
                    res.status(response.statusCode).send(response.body)
                })
            } catch (error) {
                console.error('Error on function route configuration')
                console.log(method, path)
                console.log(error)
            }
        })
    })

    app.listen(PORT, () => {
        logGreen(`Lambda-to-express listening at http://localhost:${PORT}`)
    })
}
