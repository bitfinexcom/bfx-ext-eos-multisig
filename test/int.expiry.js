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
    const tx = {
      publicKeys: [ 'PUB_K1_8Pb2CCFCF6ahveSub4LVPhqyzLo3Xg5YF2QXpnPHSU51xBt96a' ],
      signatures: [ 'SIG_K1_KkFEMConFYb5FEzRxcnx4osXa9vsoekYeSd79zo3nHNbASm2mY8f1KbgioXPZPFQYjJM2vUc68vn9QemZjUoUC6FDGV4AS' ],
      tx: '8DA8395DA1A7F9BD67E30000000001C0339BCEC8AEA65BA0264D572D3CCDCD01C0339BCEC8AEA65B000000C01BAEB26120D40100000000000030420857619DB1CA80A4BF0700000000085553445400000000',
      exp: '2019-06-27T14:51:27.000',
      id: 'D40100000000000030420857619DB1CA80A4BF07000000000855534454000000'
    }

    const query = {
      action: 'sign',
      args: [ tx ]
    }

    client.request(query, (err, data) => {
      if (err) throw err

      assert.deepStrictEqual(data, { outdated: true })

      done()
    })
  }).timeout(7000)
})
