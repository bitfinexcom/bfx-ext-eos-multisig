'use strict'

const { WrkApi } = require('bfx-wrk-api')

const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig')
const { Numeric, JsonRpc } = require('eosjs')
const fetch = require('node-fetch')

class WrkExtEosSignMultisigApi extends WrkApi {
  constructor (conf, ctx) {
    super(conf, ctx)

    this.loadConf('eosmultisig.ext', 'ext')

    this.init()
    this.start()
  }

  init () {
    super.init()
  }

  getGrcServices () {
    const { grcBaseName } = this.conf.ext

    return [`${grcBaseName}-${this.ctx.chain}`]
  }

  getPluginCtx (type) {
    const ctx = super.getPluginCtx(type)

    switch (type) {
      case 'api_bfx':
        const chainConf = this.conf.ext[this.ctx.chain]
        const {
          eos,
          requiredKeys
        } = chainConf

        const { chainId } = eos

        const privateKey = this.getKey()
        const signatureProvider = new JsSignatureProvider([ privateKey ])
        ctx.signer = {
          chainId,
          signatureProvider
        }
        ctx.chain = this.ctx.chain
        ctx.requiredKeys = Numeric.convertLegacyPublicKeys(requiredKeys)
        ctx.rpc = new JsonRpc(eos.httpEndpoint, { fetch })
        break
    }

    return ctx
  }

  getKey () {
    if (this.ctx.key && this.ctx.env === 'development') {
      return this.ctx.key
    }

    if (this.ctx.key) {
      throw new Error('ERR_KEY_DEV: keys via commandline not possible in production')
    }

    const key = this.conf.ext[this.ctx.chain].eos.privateKey
    return key
  }
}

module.exports = WrkExtEosSignMultisigApi
