'use strict'

const async = require('async')
const { Api } = require('bfx-wrk-api')
const _ = require('lodash')

const {
  sign,
  addSerializedTx
} = require('../util')

class ExtSignEosMultisig extends Api {
  _getCache (chain, des) {
    const { getCache } = this.ctx

    const action = des.actions[0].name
    return getCache(chain, action)
  }

  sign (space, data, cb) {
    const { signers, rpcs, getChain } = this.ctx

    const dataRepopulated = addSerializedTx(data)
    const des = rpcs[data.cHint].api.deserializeTransaction(
      dataRepopulated.transfer.serializedTransaction
    )

    const chain = getChain(des)
    const signer = signers[chain]
    const { requiredKeys } = signer

    const actionCache = this._getCache(chain, des)
    const id = des.actions[0].data
    const ltx = actionCache.get(id)

    // did we already cache it?
    if (!ltx) {
      console.log('tx not cached locally, skipping')
      return cb(null, { no_cache: true })
    }

    async.waterfall([
      (next) => {
        sign(data, signer, (err, signed) => {
          if (err && err.message === 'ERR_OUTDATED_TX') {
            // remove outdated
            actionCache.remove(id)
            return next(err)
          }

          if (err && err.message === 'ERR_TX_ALREADY_SIGNED') {
            return next(err)
          }

          if (err) return next(err)

          next(null, signed)
        })
      },
      (signed, next) => {
        const diff = _.difference(requiredKeys, signed.publicKeys)
        if (diff.length === 0) {
          this._sendTxToChain(chain, signed, (err) => {
            if (err) return next(err)

            return next(null, { sentToChain: true })
          })

          return
        }

        this._republishTx(signed, (err) => {
          if (err) return next(err)

          return next(null, { republished: true })
        })
      }
    ], (err, response) => {
      if (err && err.message === 'ERR_OUTDATED_TX') {
        return cb(null, { outdated: true })
      }

      if (err && err.message === 'ERR_DUPLICATE_TX') {
        return cb(null, { duplicate: true })
      }

      if (err && err.message === 'ERR_TX_ALREADY_SIGNED') {
        return cb(null, { duplicate: true })
      }

      if (err && err.message === 'ERR_DUPLICATE_TX_INV_ID') {
        return cb(null, { duplicate: true })
      }
      if (err) {
        console.error(err)
      }

      cb(null, response)
    })
  }

  _sendTxToChain (chain, data, cb) {
    const localRpc = this.ctx.rpcs[chain]

    const { signatures, transfer } = addSerializedTx(data)

    transfer.signatures = signatures
    localRpc.rpc.push_transaction(transfer)
      .then((res) => {
        cb(null, { tx: res })
      })
      .catch((err) => {
        if (err.json && err.json.error && err.json.error.code === 3040005) {
          return cb(new Error('ERR_OUTDATED_TX'))
        }

        if (err.json && err.json.error && err.json.error.code === 3040008) {
          return cb(new Error('ERR_DUPLICATE_TX'))
        }

        if (err.json && err.json.error && err.json.error.code === 3050003) {
          return cb(new Error('ERR_DUPLICATE_TX_INV_ID'))
        }

        cb(err)
      })
  }

  _republishTx (tx, cb) {
    const opts = {
      timeout: 10000
    }

    this.ctx.grc_bfx.map(
      this.ctx.grcBaseName,
      'sign',
      [tx],
      opts,
      cb
    )
  }
}

module.exports = ExtSignEosMultisig
