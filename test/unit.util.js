/* eslint-env mocha */

'use strict'

const assert = require('assert')
const ecc = require('eosjs-ecc')

const {
  isValidTx,
  getKeysForSign,
  signTx,
  addSerializedTx,
  getTimestamp,
  isTx
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

  it('isTx - all valid', () => {
    const tx = {
      expiration: '2050-07-26T13:48:29.000',
      ref_block_num: 29595,
      ref_block_prefix: 3916965506,
      max_net_usage_words: 0,
      max_cpu_usage_ms: 0,
      delay_sec: 0,
      context_free_actions: [],
      actions: [{
        account: 'finexsidegtw',
        name: 'releasedone',
        authorization: [{ actor: 'finexsidegtw', permission: 'gateway' }],
        data: '2F02000000000000'
      }],
      transaction_extensions: []
    }

    const res = isTx(tx)
    assert.strictEqual(res, true)
  })

  it('isTx - date invalid', () => {
    const tx = {
      expiration: '2000-07-26T13:48:29.000',
      ref_block_num: 29595,
      ref_block_prefix: 3916965506,
      max_net_usage_words: 0,
      max_cpu_usage_ms: 0,
      delay_sec: 0,
      context_free_actions: [],
      actions: [{
        account: 'finexsidegtw',
        name: 'releasedone',
        authorization: [{ actor: 'finexsidegtw', permission: 'gateway' }],
        data: '2F02000000000000'
      }],
      transaction_extensions: []
    }

    const res = isTx(tx)
    assert.strictEqual(res, false)
  })

  it('isTx - actions invalid', () => {
    const tx = {
      expiration: '2000-07-26T13:48:29.000',
      ref_block_num: 29595,
      ref_block_prefix: 3916965506,
      max_net_usage_words: 0,
      max_cpu_usage_ms: 0,
      delay_sec: 0,
      context_free_actions: [],
      actions: [1, {
        account: 'finexsidegtw',
        name: 'releasedone',
        authorization: [{ actor: 'finexsidegtw', permission: 'gateway' }],
        data: '2F02000000000000'
      }],
      transaction_extensions: []
    }

    assert.throws(() => {
      isTx(tx)
    }, new Error('ERR_FATAL_INVALID_TX'))
  })

  it('isTx - context_free_actions invalid', () => {
    const tx = {
      expiration: '2000-07-26T13:48:29.000',
      ref_block_num: 29595,
      ref_block_prefix: 3916965506,
      max_net_usage_words: 0,
      max_cpu_usage_ms: 0,
      delay_sec: 0,
      context_free_actions: [1],
      actions: [{
        account: 'finexsidegtw',
        name: 'releasedone',
        authorization: [{ actor: 'finexsidegtw', permission: 'gateway' }],
        data: '2F02000000000000'
      }],
      transaction_extensions: []
    }

    assert.throws(() => {
      isTx(tx)
    }, new Error('ERR_FATAL_INVALID_TX'))
  })

  it('isTx - context_free_data invalid', () => {
    const tx = {
      expiration: '2000-07-26T13:48:29.000',
      ref_block_num: 29595,
      ref_block_prefix: 3916965506,
      max_net_usage_words: 0,
      max_cpu_usage_ms: 0,
      delay_sec: 0,
      context_free_actions: [],
      context_free_data: [],
      actions: [{
        account: 'finexsidegtw',
        name: 'releasedone',
        authorization: [{ actor: 'finexsidegtw', permission: 'gateway' }],
        data: '2F02000000000000'
      }],
      transaction_extensions: []
    }

    assert.throws(() => {
      isTx(tx)
    }, new Error('ERR_FATAL_INVALID_TX'))
  })

  it('isTx - transaction_extensions invalid', () => {
    const tx = {
      expiration: '2000-07-26T13:48:29.000',
      ref_block_num: 29595,
      ref_block_prefix: 3916965506,
      max_net_usage_words: 0,
      max_cpu_usage_ms: 0,
      delay_sec: 0,
      context_free_actions: [],
      actions: [{
        account: 'finexsidegtw',
        name: 'releasedone',
        authorization: [{ actor: 'finexsidegtw', permission: 'gateway' }],
        data: '2F02000000000000'
      }],
      transaction_extensions: [1]
    }

    assert.throws(() => {
      isTx(tx)
    }, new Error('ERR_FATAL_INVALID_TX'))
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

  it('getKeysForSign - not signed yet', () => {
    const key1 = ecc.seedPrivate('secret')
    const key2 = ecc.seedPrivate('secret2')

    const pubKeys = [
      'PUB_K1_83msFTj6yv5U91KkiRxHcDZUXJkR6xwC9EjbqqwFqhFa4dGVak',
      'PUB_K1_7Co6okBDuaHhV6eGnsP3eLN6dz5HsdEwtSsoj64XnX7H6R2hWg'
    ]

    const signatureProvider = new JsSignatureProvider([key1, key2])

    const data = {}
    const res = getKeysForSign(signatureProvider.availableKeys, data)
    assert.deepStrictEqual(res, pubKeys)
  })

  it('getKeysForSign - fully signed', () => {
    const key1 = ecc.seedPrivate('secret')
    const key2 = ecc.seedPrivate('secret2')

    const pubKeys = [
      'PUB_K1_83msFTj6yv5U91KkiRxHcDZUXJkR6xwC9EjbqqwFqhFa4dGVak',
      'PUB_K1_7Co6okBDuaHhV6eGnsP3eLN6dz5HsdEwtSsoj64XnX7H6R2hWg'
    ]

    const signatureProvider = new JsSignatureProvider([key1, key2])

    const data = { publicKeys: pubKeys }
    const res = getKeysForSign(signatureProvider.availableKeys, data)

    assert.deepStrictEqual(res, [])
  })

  it('getKeysForSign - partially signed', () => {
    const key1 = ecc.seedPrivate('secret')
    const key2 = ecc.seedPrivate('secret2')

    const pubKeys = [
      'PUB_K1_83msFTj6yv5U91KkiRxHcDZUXJkR6xwC9EjbqqwFqhFa4dGVak',
      'PUB_K1_7Co6okBDuaHhV6eGnsP3eLN6dz5HsdEwtSsoj64XnX7H6R2hWg'
    ]

    const signatureProvider = new JsSignatureProvider([key1, key2])

    const data = { publicKeys: [pubKeys[0]] }
    const res = getKeysForSign(signatureProvider.availableKeys, data)

    assert.deepStrictEqual(res, [pubKeys[1]])
  })

  it('getKeysForSign - other signed', () => {
    const key1 = ecc.seedPrivate('secret')
    const key2 = ecc.seedPrivate('secret2')

    const pubKeys = [
      'PUB_K1_83msFTj6yv5U91KkiRxHcDZUXJkR6xwC9EjbqqwFqhFa4dGVak',
      'PUB_K1_7Co6okBDuaHhV6eGnsP3eLN6dz5HsdEwtSsoj64XnX7H6R2hWg'
    ]

    const signatureProvider = new JsSignatureProvider([key1, key2])

    const data = { publicKeys: ['a', 'b'] }
    const res = getKeysForSign(signatureProvider.availableKeys, data)

    assert.deepStrictEqual(res, pubKeys)
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
