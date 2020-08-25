import main from './localServer'

const serverlessConfigToLoad = process.argv.filter((el, index) => index > 1)

main(serverlessConfigToLoad)
