const repl = require('repl')
const events = require('events')
const fs = require('fs')
const path = require('path')

const WebSocket = require('ws')

const ee = new events.EventEmitter()
const wss = new WebSocket.Server({ port: 81 })

const bridgedFns = fs.readFileSync(path.resolve(__dirname, 'bridged.txt')).toString().split('\n').splice(1)

console.log('Waiting for connection..')

let connection

function sendMsg (cmd, args = []) {
  connection.send(JSON.stringify({
    cmd,
    args
  }))
}

const fns = {
  sp: 'gotsp',
  bridge: 'bridged',
  bridges: 'bridges',
  call: 'call',
  gc: 'gcran'
}

function handle (input, context, filename, callback) {
  let tmp = input.replace(/\n$/, '')

  if (!tmp) {
    return callback()
  }

  let args = tmp.split(' ')
  let cmd = args.shift()

  let returnFn = fns[cmd]

  if (!returnFn) {
    return callback(null, 'unknown cmd')
  }

  ee.once(returnFn, function (response) {
    return callback(null, response)
  })

  sendMsg(cmd, args)
}

const r = repl.start({
  prompt: '',
  eval: handle
})

r.pause()
r.setPrompt('switch> ')

wss.on('connection', function (ws) {
  connection = ws
  console.log('Got connection')

  bridgedFns.forEach(function (fn) {
    if (!fn) return
    const args = fn.split(' ')
    ws.send(JSON.stringify({
      cmd: 'bridge',
      args: args
    }))
    console.log('Bridged', args[0])
  })

  r.resume()
  r.write('\n')

  ws.on('close', function () {
    console.log('\nSwitch disconnected...')
    r.pause()
  })

  ws.on('message', function (data) {
    data = JSON.parse(data)
    const type = data.type
    const response = data.response
    ee.emit(type, response)
  })
})
