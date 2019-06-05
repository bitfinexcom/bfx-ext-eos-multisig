'use strict'

const { WrkApi } = require('bfx-wrk-api')

class WrkExtEosMultisigApi extends WrkApi {
  constructor (conf, ctx) {
    super(conf, ctx)

    this.loadConf('eosmultisig.ext', 'ext')

    this.init()
    this.start()
  }

  getPluginCtx (type) {
    const ctx = super.getPluginCtx(type)

    switch (type) {
      case 'api_bfx':
        // ctx.foo = 'bar'
        break
    }

    return ctx
  }

  init () {
    super.init()

    // contains all args passed to worker.js - also custom ones
    // console.log(this.ctx)
  }
}

module.exports = WrkExtEosMultisigApi
