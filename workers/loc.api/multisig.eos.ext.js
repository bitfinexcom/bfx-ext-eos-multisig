'use strict'

const { Api } = require('bfx-wrk-api')

class ExtEosMultisig extends Api {
  space (service, msg) {
    const space = super.space(service, msg)
    return space
  }

  getHelloWorld (space, args, cb) {
    const name = args.name
    const res = 'Hello ' + name

    cb(null, res)
  }
}

module.exports = ExtEosMultisig
