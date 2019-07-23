'use strict'

const Grenache = require('grenache-nodejs-http')
const Link = require('grenache-nodejs-link')

const link = new Link({
  grape: 'http://127.0.0.1:30001'
})
link.start()

link.lookup('rest:ext:eos-multisig-main', console.log)

const Peer = Grenache.PeerRPCClient
const peer = new Peer(link, {})
peer.init()

const payload = {
  tx: 'EFD7145D65066DE414CA0000000001C0339BCEC8AEA65B00D4A44961A3A2BA01C0339BCEC8AEA65B00000000A8ED3232080C0000000000000000',
  exp: '2019-06-27T14:51:27.000'
}

const query = {
  action: 'sign',
  args: [ payload ]
}

peer.map('rest:ext:eos-multisig-main', query, { timeout: 10000 }, (err, data) => {
  console.log(err)
  console.log(data)
})
