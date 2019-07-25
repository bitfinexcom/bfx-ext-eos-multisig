'use strict'

const async = require('async')
const { Api } = require('bfx-wrk-api')
const _ = require('lodash')

const {
  sign,
  addSerializedTx,
  getKeysForSign
} = require('../util')

class ExtSignEosMultisig extends Api {
  _getActionCache (des) {
    const { getLocalCache } = this.ctx

    const action = des.actions[0].name
    return getLocalCache(action)
  }

  sign (space, data, cb) {
    const { signer, rpc } = this.ctx
    const { requiredKeys, availableKeys } = signer

    const dataRepopulated = addSerializedTx(data)
    const des = rpc.api.deserializeTransaction(
      dataRepopulated.transfer.serializedTransaction
    )

    // did we already sign it?
    const requiredFromUs = getKeysForSign(availableKeys, data)
    if (requiredFromUs.length === 0) {
      console.log('skipping already signed tx')
      return cb(null, { duplicate: true })
    }

    const actionCache = this._getActionCache(des)
    const id = des.actions[0].data

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

          actionCache.set(id, data)

          next(null, signed)
        })
      },
      (signed, next) => {
        const diff = _.difference(requiredKeys, signed.publicKeys)
        if (diff.length === 0) {
          this._sendTxToChain(signed, (err) => {
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

  _sendTxToChain (data, cb) {
    const localRpc = this.ctx.rpc
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
      `rest:ext:eos-multisig-${this.ctx.chain}`,
      'sign',
      [tx],
      opts,
      cb
    )
  }
}

module.exports = ExtSignEosMultisig
