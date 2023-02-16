import net from 'net'
import glob from 'glob'
import path from 'path'
import EventEmitter from 'events'
import { ByteBuffer } from './utils/byteBuffer.js'

class Server extends EventEmitter {
  constructor(options) {
    super()
    this.options = options
    this.server = null
    this.sockets = []
    this.eventPromises = []
  }

  async buildEvents() {
    this.eventPromises = []

    await glob
      .sync(path.join('./src/events', '*.js').replace(/\\/g, '/'))
      .forEach(async (file) => {
        this.eventPromises.push(
          new Promise((resolve) => {
            resolve(import(`../${file}`))
          })
        )
      })
  }

  async createServer() {
    if (this.server) {
      console.info('Server already running')
      return
    }

    await this.buildEvents()

    this.server = net.createServer()

    this.server.listen(this.options.port, () => {
      console.log('TCP Server is running on port ' + this.options.port + '.')
    })

    let sockets = this.sockets
    let promises = this.eventPromises

    this.server.on('connection', async function (socket) {
      console.log(
        'CONNECTED: ' + socket.remoteAddress + ':' + socket.remotePort
      )

      socket.token = null
      socket.recv = new EventEmitter()
      socket.send = new EventEmitter()

      await Promise.all(promises).then((moduleList) => {
        moduleList.forEach((module) => {
          const event = new module.default(socket)

          socket.recv.on(event.options.header, (data) => {
            event.handleRecv(data)
          })

          socket.send.on(event.options.header, (...args) => {
            event.handleSend(...args)
          })
        })
      })

      socket.on('data', function (data) {
        socket.emit('recv', data)
      })

      socket.on('recv', async (data) => {
        let packet = new ByteBuffer(Array.from(data))

        const packetHeader = packet.readByte()
        const packetBody = packet.read()

        socket.recv.emit(packetHeader, new ByteBuffer(packetBody))
      })

      socket.on('close', function () {
        console.log('CLOSED: ' + socket.remoteAddress + ':' + socket.remotePort)

        let index = sockets.findIndex(function (o) {
          return (
            o.remoteAddress === socket.remoteAddress &&
            o.remotePort === socket.remotePort
          )
        })

        if (index !== -1) sockets.splice(index, 1)

        socket.recv.removeAllListeners()
        socket.send.removeAllListeners()
      })

      socket.on('error', function (error) {
        console.log(
          'ERROR: ' +
            socket.remoteAddress +
            ':' +
            socket.remotePort +
            ' - ' +
            error.code
        )
      })

      sockets.push(socket)
    })
  }
}

export { Server }
