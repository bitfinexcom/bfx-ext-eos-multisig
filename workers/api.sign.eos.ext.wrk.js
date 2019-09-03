'use strict'

const { WrkApi } = require('bfx-wrk-api')

const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')
const { Numeric } = require('eosjs')

const LRU = require('lru')

const async = require('async')
const _ = require('lodash')
const util = require('util')
const eos = require('eosjs')

const {
  setupRpc,
  createTx,
  getTimestamp,
  sign
} = require('./util')

const TABLE_PENDING_TRANSFER = 'pndtransfers'
const TABLE_STATE = 'state'
const TABLE_RELEASE_DONE = 'pndreldones'

const state = {
  side: {},
  main: {}
}

class WrkExtEosSignMultisigApi extends WrkApi {
  constructor (conf, ctx) {
    super(conf, ctx)

    this.loadConf('eosmultisig.ext', 'ext')

    this.caches = {
      'side': {},
      'main': {}
    }

    this.init()
    this.start()
  }

  init () {
    super.init()

    this.setInitFacs([
      ['fac', 'bfx-facs-db-sqlite', 'main', 'main', {
        name: this.prefix,
        persist: true
      }],
      ['fac', 'bfx-facs-monitor-tx', 'main', 'main', {}]
    ])

    this.rpcs = {
      main: {
        ...this._setupRpc('main')
      },
      side: {
        ...this._setupRpc('side')
      }
    }
  }

  _start0 (cb) {
    this.txMonitor = this.monitorTx_main

    this.mapRequests = util.promisify(this.grc_bfx.map).bind(this.grc_bfx)
    this.sign = util.promisify(sign).bind(sign)

    this.monitorTx = util.promisify(
      this.monitorTx_main.monitorTx
    ).bind(this.monitorTx_main)

    this.signers = {
      main: this.setupSigner('main'),
      side: this.setupSigner('side')
    }

    this.contracts = {
      main: this.conf.ext.main.eos.contract,
      side: this.conf.ext.side.eos.contract
    }

    this.process()

    cb()
  }

  _setupRpc (chain) {
    const {
      httpEndpoint,
      contract,
      authorization
    } = this.conf.ext[chain].eos

    const { getTableRows, rpc, api } = setupRpc({ httpEndpoint, contract })

    return { getTableRows, rpc, api, contract, authorization }
  }

  getCache (chain, action) {
    if (this.caches[chain][action]) {
      return this.caches[chain][action]
    }

    const c5min = new LRU({
      max: 500,
      maxAge: 300000
    })

    this.caches[chain][action] = c5min

    return this.caches[chain][action]
  }

  getChain (des) {
    const account = des.actions[0].account
    const { main, side } = this.contracts

    if (account === main) {
      return 'main'
    }

    if (account === side) {
      return 'side'
    }

    console.error(des)
    throw new Error('FATAL_ERR_NO_MATCH')
  }

  getGrcServices () {
    const { grcBaseName } = this.conf.ext

    return [`${grcBaseName}`]
  }

  setupSigner (chain) {
    const chainConf = this.conf.ext[chain]
    const chainId = chainConf.eos.chainId

    const requiredKeysLeg = chainConf.requiredKeys
    const requiredKeys = Numeric.convertLegacyPublicKeys(requiredKeysLeg)

    const privateKey = this.getKey(chain)
    const signatureProvider = new JsSignatureProvider([ privateKey ])
    const availableKeys = signatureProvider.availableKeys

    const signer = {
      chainId,
      signatureProvider,
      availableKeys,
      requiredKeys,
      requiredKeysLeg
    }

    return signer
  }

  getPluginCtx (type) {
    const ctx = super.getPluginCtx(type)

    switch (type) {
      case 'api_bfx':
        ctx.signers = this.signers
        ctx.chain = this.ctx.chain
        ctx.rpcs = this.rpcs
        ctx.getCache = this.getCache.bind(this)
        ctx.grcBaseName = this.conf.ext.grcBaseName
        ctx.getChain = this.getChain.bind(this)

        break
    }

    return ctx
  }

  async process () {
    this._process('main', 'side')
    setTimeout(() => {
      this._process('side', 'main')
    }, 2000)
  }

  async _getLastIrreversibleBlockData (localRpc, remoteRpc) {
    const localInfo = await localRpc.rpc.get_info()
    const remoteInfo = await remoteRpc.rpc.get_info()
    const localIb = await localRpc.rpc.get_block(localInfo.last_irreversible_block_num)
    const remoteIb = await remoteRpc.rpc.get_block(remoteInfo.last_irreversible_block_num)

    return {
      remote: {
        last_irreversible_block_num: remoteInfo.last_irreversible_block_num,
        last_irreversible_block_timestamp: remoteIb.timestamp
      },
      local: {
        last_irreversible_block_num: localInfo.last_irreversible_block_num,
        last_irreversible_block_timestamp: localIb.timestamp
      }
    }
  }

  async _process (local, remote) {
    const localRpc = this.rpcs[local]
    const remoteRpc = this.rpcs[remote]

    async.auto({
      pendingLocal: async () => {
        const data = await localRpc.getTableRows({ table: TABLE_PENDING_TRANSFER })

        if (!data.rows || data.rows.length === 0) {
          throw new ProcessingError('TABLE_PENDING_TRANSFER_NO_TRANSFER')
        }

        if (JSON.stringify(state[local].plocal) !== JSON.stringify(data.rows)) {
          state[local].plocal = data.rows
          console.log(local, 'pndtransfers', JSON.stringify(data.rows))
        }

        return data.rows
      },

      lastIrreversibleBlockTimes: ['pendingLocal', async () => {
        const res = await this._getLastIrreversibleBlockData(localRpc, remoteRpc)
        return res
      }],

      stateRemote: ['lastIrreversibleBlockTimes', async () => {
        const data = await remoteRpc.getTableRows({ table: TABLE_STATE, limit: 1 })

        if (JSON.stringify(state[local].plocal) !== JSON.stringify(data.rows)) {
          state[local].plocal = data.rows
          console.log(local, 'pndtransfers', JSON.stringify(data.rows))
        }

        const res = {
          nextTransId: data.rows[0].nextrelid || 1,
          lastDoneReleaseDoneId: data.rows[0].lstreldoneid || 0
        }

        if (typeof res.nextTransId !== 'number' || typeof res.lastDoneReleaseDoneId !== 'number') {
          throw new Error('STATE_TABLE_INVALID_DATA')
        }

        return res
      }],

      pendingRelDone: ['lastIrreversibleBlockTimes', 'pendingLocal', 'stateRemote', async (res) => {
        const rTime = getTimestamp(
          res.lastIrreversibleBlockTimes.remote.last_irreversible_block_timestamp
        )
        const data = await remoteRpc.getTableRows({ table: TABLE_RELEASE_DONE })

        if (JSON.stringify(state[remote].preldone) !== JSON.stringify(data.rows)) {
          state[remote].preldone = data.rows
          console.log(remote, 'pendingRelDone', JSON.stringify(data.rows))
        }

        let nextRelDoneId = 0

        // the `releasedone` action removes all rows from the `pndreldones` with
        // ids less than or equal to the id sent in the `releasedone` command
        // so we just end the iteration with the highest id found
        _.forEach(data.rows, (entry) => {
          const { id, time } = entry
          const tMil = time * 1000

          console.log('rtime', rTime, tMil)
          if (rTime < tMil) {
            console.log('pendingRelDone abort:', id, rTime, '<', tMil)
            return false
          }

          nextRelDoneId = id
        })

        // also skip nextRelDoneId 0 (not found)
        if (!nextRelDoneId) {
          const lrdid = res.stateRemote.lastDoneReleaseDoneId
          return { lastDoneReleaseDoneId: lrdid }
        }

        await this.sendTx(remote, 'releasedone', { id: nextRelDoneId })

        return { lastDoneReleaseDoneId: nextRelDoneId }
      }],

      processPendingTransfers: ['pendingRelDone', (res, next) => {
        const lTime = getTimestamp(
          res.lastIrreversibleBlockTimes.local.last_irreversible_block_timestamp
        )

        console.log(local, 'processPendingTransfers', JSON.stringify(res))
        console.log('processing', res.pendingLocal)

        let { nextTransId } = res.stateRemote
        let { lastDoneReleaseDoneId } = res.pendingRelDone

        const pendingTransfers = res.pendingLocal
        async.eachSeries(pendingTransfers, async (entry) => {
          console.log('---> nextTransId, lastDoneReleaseDoneId', nextTransId, lastDoneReleaseDoneId)
          const { id, time, account, quantity, memo } = entry
          const tMil = time * 1000

          console.log('ltime', lTime, tMil)
          if (lTime < tMil) {
            console.log('pendingTransfers abort:', id, lTime, '<', tMil)
            throw new ProcessingError('ERR_PND_TRANSFERS')
          }

          if (id < nextTransId) {
            if (id <= lastDoneReleaseDoneId) {
              console.log('confirming transfer id:', id)
              await this.sendTx(local, 'transferdone', { id, account, quantity })
            }
          } else if (id === nextTransId) {
            console.log('releasing id:', id)
            await this.sendTx(remote, 'release', { id, account, quantity, memo })

            nextTransId = nextTransId + 1
            console.log('nextTransId', nextTransId)
          }
        }, (err) => {
          if (err) return next(err)

          next()
        })
      }]
    }, (err, res) => {
      if (err && err.message.includes('ERR_GRAPE_LOOKUP_EMPTY')) {
        console.error('ERR_GRAPE_LOOKUP_EMPTY')
        setTimeout(() => {
          this._process(local, remote)
        }, 1000 * 20)

        return
      }

      if (err && err.type !== 'PROCESSING_ERROR') {
        console.error(err)
        if (res) console.error(res)
      }

      const delay = Math.floor(Math.random() * (5000 - 2000) + 2000)
      setTimeout(() => {
        this._process(local, remote)
      }, delay)
    })
  }

  getKey (chain) {
    if (this.ctx.key && this.ctx.env === 'development') {
      return this.ctx.key
    }

    if (this.ctx.key) {
      throw new Error('ERR_KEY_DEV: keys via commandline not possible in production')
    }

    const key = this.conf.ext[chain].eos.privateKey
    return key
  }

  async sendTx (node, action, payload) {
    console.log('send tx', node)

    const rpc = this.rpcs[node]
    const tx = await createTx(
      rpc.api,
      rpc.contract,
      action,
      payload,
      rpc.authorization
    )

    const des = rpc.api.deserializeTransaction(
      tx.serializedTransaction
    )

    const id = des.actions[0].data

    const cache = this.getCache(node, action)
    if (cache.peek(id)) {
      return
    }

    if (node === 'main' && action === 'release') {
      // https://github.com/EOSIO/eosjs/issues/578
      const { quantity, account } = payload
      let [ amount, currency ] = quantity.split(' ')

      currency = currency.trim()
      if (!currency) {
        throw new Error('ERR_WRONG_FORMAT')
      }

      const args = {
        user: account,
        token: currency,
        amount: +amount
      }

      const res = await this.monitorTx(args)
      res.users.forEach((msg) => {
        this._sendAlarm(msg)
      })

      res.global.forEach((msg) => {
        this._sendAlarm(msg)
      })
    }

    const entry = {
      tx: eos.Serialize.arrayToHex(tx.serializedTransaction),
      exp: des.expiration,
      id,
      cHint: node
    }

    const res = await this.sign(entry, this.signers[node])
    cache.set(id, res)

    await this._mapTx(node, res)
  }

  _sendAlarm (msg) {
    const { alarms } = this.conf.ext

    this.grc_bfx.req(
      alarms.grc,
      alarms.action,
      [{ channel: alarms.channel, text: msg }],
      { timeout: 10000 },
      (err) => { if (err) console.error(err) }
    )
  }

  _mapTx (node, tx) {
    const opts = {
      timeout: 10000
    }

    const { grcBaseName } = this.conf.ext
    console.log('pushing to', `${grcBaseName}`)
    console.log('tx', tx)

    return this.mapRequests(
      grcBaseName,
      'sign',
      [tx],
      opts
    )
  }
}

class ProcessingError extends Error {
  constructor (...params) {
    super(...params)
    this.type = 'PROCESSING_ERROR'
  }
}

module.exports = WrkExtEosSignMultisigApi
