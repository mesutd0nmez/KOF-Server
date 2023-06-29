import net from 'net'
import glob from 'glob'
import path from 'path'
import EventEmitter from 'events'
import { ByteBuffer } from './utils/byteBuffer.js'
import Snappy from 'snappy'
import { createHash, encrypt, decrypt } from './utils/cryption.js'
import { clearTimeout } from 'timers'
import { RateLimiterMemory } from 'rate-limiter-flexible'
class Server extends EventEmitter {
  constructor(options) {
    super()
    this.options = options
    this.server = null
    this.sockets = []
    this.eventPromises = []

    this.streamHeader = 0xaa55
    this.streamFooter = 0x55aa

    this.encryptionKey = createHash('sha256', process.env.ENCRYPTION_KEY)

    this.socketIdCounter = 0

    this.connectionRateLimitOpts = {
      points: 5,
      duration: 1,
    }

    this.connectionRateLimiter = new RateLimiterMemory(
      this.connectionRateLimitOpts
    )
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

  async initializeSocket(socket) {
    socket.setKeepAlive(true)
    socket.setNoDelay(true)

    console.log(`Socket: ${socket.remoteAddress}:${socket.remotePort}`)

    if (this.socketIdCounter == 65535) {
      this.socketIdCounter = 0
    }

    socket.generateSocketId = () => {
      return this.socketIdCounter++
    }

    socket.ready = false
    socket.connectionTime = Date.now()
    socket.connectionReadyTime = 0
    socket.id = socket.generateSocketId()
    socket.processId = -1
    socket.token = null
    socket.user = null
    socket.client = null
    socket.recv = new EventEmitter()
    socket.send = new EventEmitter()

    socket.recvBuffer = Buffer.alloc(0)

    socket.responseTime = 0

    socket.waitingReadyTimeoutId = 0

    socket.generateSeed = (a) => {
      var t = (a += 0x6d2b79f5)
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      socket.seed = (t ^ (t >>> 14)) >>> 0
    }

    socket.generateSeed(((1881 * 1923) / 1993) << 16)
    socket.initialVector = createHash(
      'md5',
      createHash(
        'sha256',
        socket.seed.toString() + '.' + process.env.IV_SALT_KEY
      )
    )

    await Promise.all(this.eventPromises).then(async (moduleList) => {
      moduleList.forEach(async (module) => {
        const event = new module.default(this, socket)

        event.rateLimiter = new RateLimiterMemory(event.options.rateLimitOpts)

        socket.recv.on(event.options.header, async (data) => {
          event.handleRecv(data)
        })

        socket.send.on(event.options.header, async (...args) => {
          event.handleSend(...args)
        })
      })
    })

    socket.waitingReadyTimeout = () => {
      if (socket.connectionReadyTime == 0) {
        console.info(
          `Client not sended ready packet, is suspicious socket. Connection destroying`
        )
        socket.destroy()
      }
    }

    socket.waitingReadyTimeoutId = setTimeout(socket.waitingReadyTimeout, 15000)
  }

  async createServer() {
    if (this.server) {
      console.info(`Server already running`)
      return
    }

    await this.buildEvents()

    this.server = net.createServer()

    this.server.listen(this.options.port, () => {
      console.log(`Server: Running on port - ${this.options.port}`)
      console.log(
        `Server: Encryption Key - ${this.encryptionKey.toString('hex')}`
      )
    })

    let sockets = this.sockets

    this.server.on('connection', async (socket) => {
      this.connectionRateLimiter
        .consume(socket.remoteAddress, 1)
        .then(() => {
          this.initializeSocket(socket)

          socket.on('data', async (data) => {
            try {
              const startDelimeter = data.slice(0, 2)

              if (
                socket.recvBuffer.length == 0 &&
                !startDelimeter.equals(Buffer.from([0x55, 0xaa]))
              ) {
                console.info(
                  'Process packet failed, packet not starting with 0xaa55, connection destroying'
                )
                return
              }

              if (data.length < 10) {
                console.info(
                  'Process packet failed, packet size need minimum 9, connection destroying'
                )
                return
              }

              const endDelimeter = data.slice(data.length - 2, data.length)

              socket.recvBuffer = Buffer.concat([socket.recvBuffer, data])

              if (endDelimeter.equals(Buffer.from([0xaa, 0x55]))) {
                socket.emit('recv', socket.recvBuffer)
                socket.recvBuffer = Buffer.alloc(0)
              }
            } catch (error) {
              console.info(error)
            }
          })

          socket.on('recv', async (data) => {
            try {
              const startDelimeter = data.slice(0, 2)
              const endDelimeter = data.slice(data.length - 2, data.length)

              if (!startDelimeter.equals(Buffer.from([0x55, 0xaa]))) {
                console.info('Process packet failed, StreamHeader != 0xaa55')
                return
              }

              if (!endDelimeter.equals(Buffer.from([0xaa, 0x55]))) {
                console.info('Process packet failed, StreamFooter != 0x55aa')
                return
              }

              //Decrypt Packet
              const decryptionBuffer = decrypt(
                data.slice(2, data.length - 2),
                this.encryptionKey,
                socket.initialVector
              )

              let decryptedPacket = new ByteBuffer(Array.from(decryptionBuffer))

              //Compression Flag
              const flag = decryptedPacket.readUnsignedByte()

              //Raw packet size
              decryptedPacket.readUnsignedInt()

              if (flag) {
                //Compressed packet size
                decryptedPacket.readUnsignedInt()

                const packetCommpressed = decryptedPacket.read()

                let uncompressedPacket = await Snappy.uncompress(
                  packetCommpressed.raw
                )

                decryptedPacket = new ByteBuffer(uncompressedPacket)
              }

              const packetHeader = decryptedPacket.readByte()

              if (decryptedPacket.available > 0) {
                const packetBody = decryptedPacket.read()
                socket.recv.emit(packetHeader, new ByteBuffer(packetBody))
              } else {
                socket.recv.emit(packetHeader)
              }
            } catch (error) {
              console.info(error)
            }
          })

          socket.on('send', async (data, compress = false) => {
            try {
              const packet = new ByteBuffer()

              //Stream Header
              packet.writeUnsignedShort(this.streamHeader)

              const encryptionPacket = new ByteBuffer()

              //Packet
              if (compress && data.length > 256) {
                encryptionPacket.writeUnsignedByte(1) //compression flag
                encryptionPacket.writeUnsignedInt(data.length) //raw packet size

                const compressedData = await Snappy.compress(data)

                encryptionPacket.writeUnsignedInt(compressedData.length) //compressed packet size
                encryptionPacket.write(compressedData) //compressed data
              } else {
                encryptionPacket.writeUnsignedByte(0) //compression flag
                encryptionPacket.writeUnsignedInt(data.length) //raw packet size

                encryptionPacket.write(data) //raw data
              }

              //Encrypt Packet
              const encryptedPacket = encrypt(
                encryptionPacket.raw,
                this.encryptionKey,
                socket.initialVector
              )

              //Write Encrypted Packet
              packet.write(encryptedPacket)

              //Stream Footer
              packet.writeUnsignedShort(this.streamFooter)

              socket.write(packet.raw)
            } catch (error) {
              console.info(error)
            }
          })

          socket.on('close', async () => {
            try {
              console.log(
                'Close: ' + socket.remoteAddress + ':' + socket.remotePort
              )

              let index = sockets.findIndex(function (o) {
                return o.id === socket.id
              })

              if (index !== -1) sockets.splice(index, 1)

              clearTimeout(socket.waitingReadyTimeoutId)
              socket.removeAllListeners()
              socket.recv.removeAllListeners()
              socket.send.removeAllListeners()
            } catch (error) {
              console.info(error)
            }
          })

          socket.on('error', async (error) => {
            console.log(
              'Error: ' +
                socket.remoteAddress +
                ':' +
                socket.remotePort +
                ' - ' +
                error.code
            )
          })

          sockets.push(socket)
        })
        .catch(() => {
          console.info(`Connection rate limited, socket destroying`)
          socket.destroy()
        })
    })
  }
}

export { Server }
