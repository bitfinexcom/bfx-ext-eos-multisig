'use strict'

const async = require('async')

const { Api, JsonRpc } = require('eosjs')
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')
const { TextEncoder, TextDecoder } = require('util')

const fetch = require('node-fetch')
const TABLE_PENDING_TRANSFER = 'pndtransfers'

const {
  testkeys,
  testHttpEndpointSide,
  testHttpEndpointMain
} = require('./config/examples.json')

const {
  setupRpc
} = require('./workers/util')

function setup (httpEndpoint, kp, contract) {
  const rpc = new JsonRpc(httpEndpoint, { fetch })

  const api = new Api({
    rpc,
    signatureProvider: kp,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder()
  })

  const { getTableRows } = setupRpc({ httpEndpoint, contract })

  return { api, rpc, getTableRows }
}

const signatureProvider = new JsSignatureProvider(testkeys)
const users = [
  ['testuser1111', '1.16000000 IQX'],
  ['testuser1112', '1.28000000 LEO'],
  ['testuser1113', '1.30000000 USDT'],
  ['testuser1114', '1.30000000 IQX']
]

const rpcs = {
  side: setup(testHttpEndpointSide, signatureProvider, 'finexsidegtw'),
  main: setup(testHttpEndpointMain, signatureProvider, 'finexmaingtw')
}

function getBalances (rpcs, users, cb = () => {}) {
  const tasks = users.map((user) => {
    return async function bTask () {
      const [ username ] = user

      const sideb = await rpcs.side.rpc.get_currency_balance('eosio.token', username)
      const mainb = await rpcs.main.rpc.get_currency_balance('efinextether', username)

      return [username, { side: sideb, main: mainb }]
    }
  })

  async.parallel(tasks, (err, res) => {
    if (err) {
      return cb(err)
    }

    cb(null, res)
  })
}

function sendTokens (api, users, data, cb = () => {}) {
  const tasks = users.map((el) => {
    const [user, quantity] = el
    const { account, to } = data

    return async function task (cb) {
      const result = await api.transact({
        actions: [{
          account: account,
          name: 'transfer',
          authorization: [{
            actor: user,
            permission: 'active'
          }],
          data: {
            from: user,
            to: to,
            quantity: quantity,
            memo: ''
          }
        }]
      }, {
        blocksBehind: 3,
        expireSeconds: 30
      })

      return result
    }
  })

  async.parallel(tasks, (err, res) => {
    if (err) {
      console.error(err)
      return cb(err)
    }

    console.log('finished')
    cb(null, res)
  })
}

const waitPromise = (delay) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, delay)
  })
}

async.waterfall([
  function _getBalances (next) {
    getBalances(rpcs, users, (err, res) => {
      if (err) return next(err)
      console.log(' -- balances start:')
      console.log(JSON.stringify(res, null, 2))

      next()
    })
  },
  function work (next) {
    const mainToSide = {
      account: 'efinextether',
      to: 'finexmaingtw'
    }

    const tmpUsers = [users[0], users[1]]
    sendTokens(rpcs.main.api, tmpUsers, mainToSide, (err, res) => {
      if (err) return next(err)
      console.log('work1')
      next()
    })
  },
  function work2 (next) {
    const mainToSide = {
      account: 'efinextether',
      to: 'finexmaingtw'
    }

    const tmpUsers = [users[2], users[3]]
    setTimeout(() => {
      sendTokens(rpcs.main.api, tmpUsers, mainToSide, (err, res) => {
        if (err) return next(err)
        console.log('work2')

        next()
      })
    }, 3000)
  },
  function watch (next) {
    console.log('watch')

    let pside, pmain
    setTimeout(() => {
      async.until(
        () => {
          if (!pside || !pside.rows) return false

          return pside.rows.length === 0 && pmain.rows.length === 0
        },
        async () => {
          pside = await rpcs.side.getTableRows({ table: TABLE_PENDING_TRANSFER })
          pmain = await rpcs.main.getTableRows({ table: TABLE_PENDING_TRANSFER })

          await waitPromise(200)
        },
        (err) => {
          if (err) return next(err)

          next()
        }
      )
    }, 200)
  },
  function _getNewBalances (next) {
    getBalances(rpcs, users, (err, res) => {
      if (err) return next(err)

      console.log(' -- new balances:')
      console.log(JSON.stringify(res, null, 2))

      next()
    })
  }
], (err) => {
  if (err) {
    console.error(err)
    return
  }

  console.log('done')
})
