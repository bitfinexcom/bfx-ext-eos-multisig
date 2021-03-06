'use strict'

const { TextEncoder, TextDecoder } = require('util')

const { Api, JsonRpc } = require('eosjs')
const eos = require('eosjs')
const fetch = require('node-fetch')

const dns = require('date-fns')
const _ = require('lodash')
const async = require('async')

exports.isTx = isTx
function isTx (des) {
  if (des.actions.length !== 1 ||
    des.context_free_actions.length !== 0 ||
    des.context_free_data ||
    des.transaction_extensions.length !== 0) {
    console.error('ERR_FATAL_INVALID_TX', des)
    throw new Error('ERR_FATAL_INVALID_TX')
  }

  if (!dns.isFuture(des.expiration)) {
    return false
  }

  return true
}

exports.getTimestamp = getTimestamp
function getTimestamp (date) {
  if (typeof date !== 'string') {
    throw new Error('FATAL_DATE_INVALID')
  }

  const ts = new Date(date).getTime()

  if (Number.isNaN(ts)) {
    throw new Error('FATAL_DATE_INVALID')
  }

  return ts
}

exports.getApi = getApi
function getApi (httpEndpoint, keyProvider) {
  const rpc = new JsonRpc(httpEndpoint, { fetch })

  const api = new Api({
    rpc,
    signatureProvider: keyProvider,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder()
  })

  return api
}

exports.createTx = createTx
function createTx (api, contract, action, data, auth) {
  return api.transact({
    actions: [{
      account: contract,
      name: action,
      authorization: auth,
      data: data
    }]
  }, {
    blocksBehind: 3,
    expireSeconds: 30,
    broadcast: false,
    sign: false
  })
}

exports.signTx = signTx
function signTx (data, signer, reqKeys, cb) {
  const { signatureProvider, chainId } = signer
  const { transfer, tx, exp, signatures, publicKeys, id, cHint } = data

  transfer.requiredKeys = reqKeys
  transfer.chainId = chainId

  const sigs = signatures || []
  const pubKeys = publicKeys || []
  signatureProvider
    .sign(transfer)
    .then((signed) => {
      const res = {
        publicKeys: pubKeys.concat(reqKeys),
        signatures: signed.signatures.concat(sigs),
        tx: tx,
        exp: exp,
        id,
        cHint
      }

      cb(null, res)
    })
    .catch((err) => { cb(err) })
}

exports.sign = sign
function sign (data, signer, cb) {
  async.waterfall([
    (cb) => {
      isValidTx(data, cb)
    },
    (cb) => {
      const keys = getKeysForSign(signer.signatureProvider.availableKeys, data)
      cb(null, keys)
    },
    (reqKeys, cb) => {
      if (reqKeys.length === 0) {
        return cb(new Error('ERR_TX_ALREADY_SIGNED'))
      }

      const tx = addSerializedTx(data)
      signTx(tx, signer, reqKeys, cb)
    }
  ], (err, signedTx) => {
    if (err && err.message === 'ERR_OUTDATED_TX') {
      console.log('skipped outdated tx')
      return cb(err)
    }

    if (err && err.message === 'ERR_TX_ALREADY_SIGNED') {
      console.log('skipped already signed tx')
      return cb(err)
    }

    if (err) {
      console.error(err)
      return cb(err)
    }

    return cb(null, signedTx)
  })
}

exports.getKeysForSign = getKeysForSign
function getKeysForSign (availableKeys, data) {
  if (!data.publicKeys) {
    return availableKeys
  }

  const missing = _.difference(availableKeys, data.publicKeys)
  if (missing.length) {
    return missing
  }

  return []
}

exports.isValidTx = isValidTx
function isValidTx (data, cb) {
  if (!dns.isFuture(data.exp)) {
    return cb(new Error('ERR_OUTDATED_TX'))
  }

  return cb(null)
}

exports.addSerializedTx = addSerializedTx
function addSerializedTx (data) {
  data.transfer = {
    serializedTransaction: eos.Serialize.hexToUint8Array(data.tx)
  }

  return data
}

exports.setupRpc = setupRpc
function setupRpc (conf) {
  const rpc = new JsonRpc(conf.httpEndpoint, { fetch })
  const api = getApi(conf.httpEndpoint, null)

  const def = {
    json: true,
    code: conf.contract,
    scope: conf.contract,
    table: null,
    limit: 10,
    reverse: false
  }

  const c = _.assign({}, def, conf)

  function getTableRows (opts) {
    const args = _.assign({}, c, opts)

    return rpc.get_table_rows(args)
  }

  return { getTableRows, rpc, api }
}
