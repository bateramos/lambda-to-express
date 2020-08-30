const path = require('path')
const fs = require('fs')

const main = require('./localServer')

const serverlessConfigToLoad = process.argv.filter((el, index) => index > 1)
let mainConfig = {}

try {
    mainConfig = JSON.parse(fs.readFileSync('.lterc', 'UTF-8'))
} catch (error) {
    if (error.message.startsWith('ENOENT')) {
        console.warn('no .lterc file fould.')
    } else if (error.toString().startsWith('SyntaxError')) {
        console.warn('Parser error. .lterc is not a JSON.')
    } else {
        console.warn('Unknown error loading .lterc', error)
    }
}

main(serverlessConfigToLoad, mainConfig)
