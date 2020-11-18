require('isomorphic-fetch')
const { expect } = require('chai')

const localServer = require('../../localServer');

const configPath = 'tests/config-load-creation/minimal-single-route.yml'

describe('minimal-single-route', () => {

    let server
    before(() => {
        server = localServer([configPath], {})
    })

    after(() => {
        server.close()
    })

    it('should get route and receive response with text', async () => {
        const res = await fetch('http://localhost:8180/minimal/single/route')
        const text = await res.text()
        expect(text).eql('Test response')
    })
});
