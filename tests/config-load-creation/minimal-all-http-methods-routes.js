module.exports.getHandler = (req) => {
    const body = { text: 'JSON response' }
    const response = {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'content-length': Buffer.from(JSON.stringify(body)).length,
        }
    }

    return req.method === 'GET' ? { ...response, body } : response
}

module.exports.postHandler = (req) => {
    const body = JSON.parse(req.body)
    return { body: { postBody: body } }
}

module.exports.putHandler = (req) => {
    const body = JSON.parse(req.body)
    return { body: { postBody: body } }
}

module.exports.deleteHandler = (req) => {
    return { statusCode: 204 }
}

