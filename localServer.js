require('isomorphic-fetch')
const path  = require('path')
const {promisify}  = require('util')
const get  = require('lodash/get')
const set  = require('lodash/set')
const isArray  = require('lodash/isArray')
const orderBy  = require('lodash/orderBy')
const yaml  = require('yaml')
const fs  = require('fs')
const express  = require('express')
const cors  = require('cors')
const dotenv  = require('dotenv')
const jsonwebtoken  = require('jsonwebtoken')
const jwkToPem  = require('jwk-to-pem')
const bodyParser  = require('body-parser')

const logGreen = str => console.log(`\x1b[32m${str}\x1b[0m`)
const logYellow = str => console.log(`\x1b[33m${str}\x1b[0m`)

const PORT = process.env.PORT || 8180

const verifyPromised = promisify(jsonwebtoken.verify.bind(jsonwebtoken))

const result = dotenv.config()

const app = express()

app.use(cors())
app.use(bodyParser.json())

let cacheKeys = []

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

module.exports = async function main(serverlessConfigFilesPath, mainConfig) {
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
