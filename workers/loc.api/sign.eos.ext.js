'use strict'

const async = require('async')
const { Api } = require('bfx-wrk-api')
const _ = require('lodash')

const {
  sign,
  addSerializedTx
} = require('../util')

class ExtSignEosMultisig extends Api {
  sign (space, data, cb) {
    const { signer, requiredKeys } = this.ctx

    async.waterfall([
      (next) => {
        sign(data, signer, (err, signed) => {
          if (err && err.message === 'ERR_OUTDATED_TX') {
            return next(err)
          }

          if (err && err.message === 'ERR_TX_ALREADY_SIGNED') {
            return next(null, data)
          }

          if (err) return next(err)

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

      if (err) {
        console.error(err)
      }

      cb(null, response)
    })
  }

  _sendTxToChain (data, cb) {
    const { signatures, transfer } = addSerializedTx(data)

    transfer.signatures = signatures
    this.ctx.rpc.push_transaction(transfer)
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

        cb(err)
      })
  }

  _republishTx (tx, cb) {
    const opts = {
      timeout: 300000,
      limit: 1
    }

    const delay = Math.floor(Math.random() * 6000) + 1000
    setTimeout(() => {
      this.ctx.grc_bfx.map(
        `rest:ext:eos-multisig-${this.ctx.chain}`,
        'sign',
        [tx],
        opts,
        cb
      )
    }, delay)
  }
}

module.exports = ExtSignEosMultisig
