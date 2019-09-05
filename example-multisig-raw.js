'use strict'

const { Api, JsonRpc } = require('eosjs')
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')
const fetch = require('node-fetch')
const { TextEncoder, TextDecoder } = require('util')

const {
  chainId,
  key1,
  key2,
  httpEndpoint,
  contract,
  authorization
} = require('./config/examples.json')

const sigProviderKey1 = new JsSignatureProvider([key1])
const sigProviderKey2 = new JsSignatureProvider([key2])

function getApi (kp) {
  const rpc = new JsonRpc(httpEndpoint, { fetch })

  const api = new Api({
    rpc,
    signatureProvider: kp,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder()
  })

  return api
}

;(async () => {
  const data = {
    quantity: '0.10000000 EOS',
    account: 'testuser1512'
  }

  const source = 'testuser1511'

  try {
    const api = getApi(null)

    const { account, quantity } = data
    const transfer = await api.transact({
      actions: [{
        account: contract,
        name: 'transfer',
        authorization: authorization,
        data: {
          from: source,
          to: account,
          quantity: quantity,
          memo: ''
        }
      }]
    }, {
      blocksBehind: 3,
      expireSeconds: 30,
      broadcast: false,
      sign: false
    })

    const a = await sign(transfer, sigProviderKey1)
    const b = await sign(a, sigProviderKey2)

    const rpc = new JsonRpc(httpEndpoint, { fetch })
    const res = await rpc.push_transaction(b)
    console.log(res)
  } catch (e) {
    console.error(e)
  }

  async function sign (transfer, signatureProvider) {
    const keys = await signatureProvider.getAvailableKeys()
    transfer.requiredKeys = keys
    transfer.chainId = chainId

    const sigs = transfer.signatures || null
    const signed = await signatureProvider.sign(transfer)

    if (sigs) {
      signed.signatures = signed.signatures.concat(sigs)
    }

    return signed
  }
})()
