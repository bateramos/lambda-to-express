require('isomorphic-fetch')
const { expect } = require('chai')

const localServer = require('../../localServer');

const configPath = 'tests/config-load-creation/minimal-all-http-methods-routes.yml'
const url = 'http://localhost:8180/minimal/route'

describe('minimal-all-http-methods-routes', () => {
    let server
    before(() => {
        server = localServer([configPath], {})
    })

    after(() => {
        server.close()
    })

    it('should request get and get response with json body', async () => {
        const res = await fetch(url)
        const json = await res.json()
        expect(json).eql({ text: 'JSON response' })
    })

    it('should request post and get response with json body', async () => {
        const res = await fetch(url, {
            method: 'post',
            body: JSON.stringify({ prop: 'value' }),
            headers: { 'Content-Type': 'application/json' },
        })
        const json = await res.json()
        expect(json.postBody).eql({ prop: 'value' })
    })

    it('should request put and get response with json body', async () => {
        const res = await fetch(url, {
            method: 'put',
            body: JSON.stringify({ prop: 'value' }),
            headers: { 'Content-Type': 'application/json' },
        })
        const json = await res.json()
        expect(json.postBody).eql({ prop: 'value' })
    })

    it('should request delete and get valid response', async () => {
        const res = await fetch(url, {
            method: 'delete',
        })
        expect(res.status).eql(204)
    })

    it('should request head and get available headers', async () => {
        const res = await fetch(url, {
            method: 'head',
        })
        const body = await res.text()
        expect(res.status).eql(200)
        expect(body).eql('')
        expect(res.headers.get('content-length')).eql('24')
    })
    it('should request head and get available headers', async () => {
        const res = await fetch(url, {
            method: 'options',
        })
        expect(res.status).eql(204)
        expect(res.headers.get('access-control-allow-origin')).eql('*')
    })
})

