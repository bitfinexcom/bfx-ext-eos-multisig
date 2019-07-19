/* eslint-env mocha */

'use strict'

const assert = require('assert')
const ecc = require('eosjs-ecc')

const {
  isValidTx,
  getKeysForSign,
  signTx,
  addSerializedTx,
  getTimestamp
} = require('../workers/util.js')

const {
  hcEntry
} = require('./fixtures.js')

const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')

describe('unit util', () => {
  it('getTimeStamp - invalid time', () => {
    assert.throws(() => {
      getTimestamp('20183-07-17T16:11:31.500Z')
    })
  })

  it('getTimeStamp - valid time', () => {
    assert.strictEqual(getTimestamp('2018-07-17T16:11:31.500Z'), 1531843891500)
  })

  it('getTimeStamp - invalid time', () => {
    assert.throws(() => {
      getTimestamp(null)
    })
  })

  it('isValidTx - outdated', (done) => {
    isValidTx({ exp: '2019-06-11T17:44:30.000' }, (err) => {
      assert.ok(err)
      done()
    })
  })

  it('isValidTx - future', (done) => {
    isValidTx({ exp: '2050-06-13T14:14:20.000' }, (err) => {
      assert.strictEqual(err, null)
      done()
    })
  })

  it('getKeysForSign - not signed yet', (done) => {
    const key1 = ecc.seedPrivate('secret')
    const key2 = ecc.seedPrivate('secret2')

    const pubKeys = [
      'PUB_K1_83msFTj6yv5U91KkiRxHcDZUXJkR6xwC9EjbqqwFqhFa4dGVak',
      'PUB_K1_7Co6okBDuaHhV6eGnsP3eLN6dz5HsdEwtSsoj64XnX7H6R2hWg'
    ]

    const signatureProvider = new JsSignatureProvider([key1, key2])

    const data = {}
    getKeysForSign(data, signatureProvider, (err, res) => {
      if (err) throw err

      assert.deepStrictEqual(res, pubKeys)
      done()
    })
  })

  it('getKeysForSign - fully signed', (done) => {
    const key1 = ecc.seedPrivate('secret')
    const key2 = ecc.seedPrivate('secret2')

    const pubKeys = [
      'PUB_K1_83msFTj6yv5U91KkiRxHcDZUXJkR6xwC9EjbqqwFqhFa4dGVak',
      'PUB_K1_7Co6okBDuaHhV6eGnsP3eLN6dz5HsdEwtSsoj64XnX7H6R2hWg'
    ]

    const signatureProvider = new JsSignatureProvider([key1, key2])

    const data = { publicKeys: pubKeys }
    getKeysForSign(data, signatureProvider, (err, res) => {
      if (err) throw err

      assert.deepStrictEqual(res, [])
      done()
    })
  })

  it('getKeysForSign - partially signed', (done) => {
    const key1 = ecc.seedPrivate('secret')
    const key2 = ecc.seedPrivate('secret2')

    const pubKeys = [
      'PUB_K1_83msFTj6yv5U91KkiRxHcDZUXJkR6xwC9EjbqqwFqhFa4dGVak',
      'PUB_K1_7Co6okBDuaHhV6eGnsP3eLN6dz5HsdEwtSsoj64XnX7H6R2hWg'
    ]

    const signatureProvider = new JsSignatureProvider([key1, key2])

    const data = { publicKeys: [pubKeys[0]] }
    getKeysForSign(data, signatureProvider, (err, res) => {
      if (err) throw err

      assert.deepStrictEqual(res, [pubKeys[1]])
      done()
    })
  })

  it('getKeysForSign - other signed', (done) => {
    const key1 = ecc.seedPrivate('secret')
    const key2 = ecc.seedPrivate('secret2')

    const pubKeys = [
      'PUB_K1_83msFTj6yv5U91KkiRxHcDZUXJkR6xwC9EjbqqwFqhFa4dGVak',
      'PUB_K1_7Co6okBDuaHhV6eGnsP3eLN6dz5HsdEwtSsoj64XnX7H6R2hWg'
    ]

    const signatureProvider = new JsSignatureProvider([key1, key2])

    const data = { publicKeys: ['a', 'b'] }

    getKeysForSign(data, signatureProvider, (err, res) => {
      if (err) throw err

      assert.deepStrictEqual(res, pubKeys)
      done()
    })
  })

  it('signTx', (done) => {
    const key1 = ecc.seedPrivate('secret')
    const pubKeys1 = [
      'PUB_K1_83msFTj6yv5U91KkiRxHcDZUXJkR6xwC9EjbqqwFqhFa4dGVak'
    ]

    const key2 = ecc.seedPrivate('secret2')
    const pubKeys2 = [
      'PUB_K1_7Co6okBDuaHhV6eGnsP3eLN6dz5HsdEwtSsoj64XnX7H6R2hWg'
    ]

    const signer1 = {
      signatureProvider: new JsSignatureProvider([key1]),
      chainId: 'f16e7cc107ee685a7faf16bfd517d1f87a161ce4d3d39110e8f1a0a2d82a761d'
    }

    const signer2 = {
      signatureProvider: new JsSignatureProvider([key2]),
      chainId: 'f16e7cc107ee685a7faf16bfd517d1f87a161ce4d3d39110e8f1a0a2d82a761d'
    }

    const tx = addSerializedTx(hcEntry)
    signTx(tx, signer1, pubKeys1, (err, res) => {
      if (err) throw err

      assert.deepStrictEqual(res.publicKeys, pubKeys1)
      assert.strictEqual(res.signatures.length, 1)
      assert.strictEqual(res.id, 204)
      assert.strictEqual(res.exp, '2019-06-14T10:21:35.000')

      signTx(addSerializedTx(res), signer2, pubKeys2, (err, res2) => {
        if (err) throw err

        assert.deepStrictEqual(res2.publicKeys, [pubKeys1[0], pubKeys2[0]])
        assert.strictEqual(res2.tx, hcEntry.tx)
        assert.strictEqual(res2.signatures.length, 2)
        assert.strictEqual(res2.exp, '2019-06-14T10:21:35.000')
        done()
      })
    })
  })
})
