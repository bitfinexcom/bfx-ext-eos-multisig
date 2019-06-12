/* eslint-env mocha */

'use strict'

const assert = require('assert')
const path = require('path')

const createGrapes = require('bfx-svc-test-helper/grapes')
const createWorker = require('bfx-svc-test-helper/worker')
const createClient = require('bfx-svc-test-helper/client')

// ssl / fingerprint
const fs = require('fs')
const secure = {
  key: fs.readFileSync(path.join(__dirname, '..', 'sec', 'client-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '..', 'sec', 'client-crt.pem')),
  ca: fs.readFileSync(path.join(__dirname, '..', 'sec', 'ca-crt.pem')),
  rejectUnauthorized: false // take care, can be dangerous in production!
}

let grapes, worker, client
describe('RPC integration', () => {
  before(async function () {
    this.timeout(20000)

    grapes = createGrapes()
    await grapes.start()

    worker = createWorker({
      env: 'development',
      wtype: 'wrk-ext-eos-sign-api',
      apiPort: 8721,
      serviceRoot: path.join(__dirname, '..'),
      chain: 'side'
    }, grapes)

    await worker.start()

    client = createClient(worker, { secure })
  })

  after(async function () {
    this.timeout(5000)

    await client.stop()
    await worker.stop()
    await grapes.stop()
  })

  it('discards outdated messages', (done) => {
    const query = {
      action: 'sign',
      args: [ { tx: 'foo', exp: '2019-06-27T14:51:27.000' } ]
    }

    client.request(query, (err, data) => {
      if (err) throw err

      assert.deepStrictEqual(data, { outdated: true })

      done()
    })
  }).timeout(7000)
})
