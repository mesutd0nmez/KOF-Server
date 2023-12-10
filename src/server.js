import net from 'net'
import { glob } from 'glob'
import path from 'path'
import EventEmitter from 'events'
import { ByteBuffer } from './utils/byteBuffer.js'
import PacketHeader from './core/enums/packetHeader.js'
import { createHash, encrypt, decrypt } from './utils/cryption.js'
import { clearTimeout } from 'timers'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import express from 'express'
import cors from 'cors'
import winston from 'winston'
import winstonMongo from 'winston-mongodb'

import SessionModel from './models/session.js'

import adminMiddleware from './middleware/admin.js'
import authLoginRouter from './routes/auth/login.js'
import adminPointerRouter from './routes/admin/pointer.js'
import adminVersionRouter from './routes/admin/version.js'
import adminLibraryRouter from './routes/admin/library.js'
import adminUserRouter from './routes/admin/user.js'
class Server extends EventEmitter {
  constructor(options) {
    super()
    this.options = options
    this.server = null
    this.eventPromises = []

    this.streamHeader = 0xaa55
    this.streamFooter = 0x55aa

    this.encryptionKey = createHash('sha256', process.env.ENCRYPTION_KEY)

    this.socketIdCounter = 0

    this.connectionRateLimitOpts = {
      points: 3,
      duration: 1,
    }

    this.connectionRateLimiter = new RateLimiterMemory(
      this.connectionRateLimitOpts
    )

    winston.add(
      new winston.transports.MongoDB({
        db: process.env.MONGODB_URL,
        collection: 'logs',
        level: 'silly',
        options: { useUnifiedTopology: true },
      })
    )

    winston.add(
      new winston.transports.Console({
        level: process.env.NODE_ENV == 'development' ? 'silly' : 'error',
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      })
    )

    winston.add(
      new winston.transports.File({
        filename: './logs/error.log',
        level: 'error',
      })
    )

    winston.add(
      new winston.transports.File({
        filename: './logs/combined.log',
        level: 'silly',
      })
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
    winston.info(`Connection: ${socket.remoteAddress}:${socket.remotePort}`)

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

    socket.lastPongTime = 0
    socket.lastPingTime = 0

    socket.recvBuffer = Buffer.alloc(0)

    socket.responseTime = 0

    socket.fileCRC = 0xffffffff

    socket.generateSeed = (a) => {
      var t = (a += 0x6d2b79f5)
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      socket.seed = (t ^ (t >>> 14)) >>> 0
    }

    socket.generateSeed(((1881 * 2023) / 2009) << 16)
    socket.initialVector = createHash(
      'md5',
      createHash(
        'sha256',
        socket.seed.toString() + '.' + process.env.IV_SALT_KEY
      )
    )

    await Promise.all(this.eventPromises).then((moduleList) => {
      moduleList.forEach((module) => {
        const event = new module.default(this, socket)

        event.rateLimiter = new RateLimiterMemory(event.options.rateLimitOpts)

        socket.recv.on(event.options.header, (data) => {
          event.handleRecv(data)
        })

        socket.send.on(event.options.header, (...args) => {
          event.handleSend(...args)
        })
      })
    })

    socket.waitingReadyTimeoutId = 0
    socket.waitingReadyTimeout = () => {
      if (socket.connectionReadyTime == 0) {
        winston.warn(
          `Client not sended ready packet, is suspicious socket. Connection destroying`,
          {
            metadata: {
              user: socket.user ? socket.user.id : null,
              client: socket.client ? socket.client.id : null,
              processId: socket.processId,
              crc: socket.fileCRC,
              ip: socket.remoteAddress,
            },
          }
        )
        socket.destroy()
      }
    }

    socket.waitingReadyTimeoutId = setTimeout(socket.waitingReadyTimeout, 15000)

    socket.pingIntervalId = 0
    socket.pingInterval = () => {
      socket.send.emit(PacketHeader.PING)
    }
  }

  async createServer() {
    if (this.server) {
      winston.error(`Server already running`)
      return
    }

    await this.buildEvents()

    const result = await SessionModel.deleteMany({})

    winston.info(`Server: Deleted ${result.deletedCount} old session data`)

    this.server = net.createServer((socket) => {
      //socket.setKeepAlive(true, 1800000)
      //socket.setNoDelay(true)
    })

    this.server.listen(this.options.port, () => {
      winston.info(`Server: Running on port - ${this.options.port}`)
    })

    this.server.on('connection', (socket) => {
      this.connectionRateLimiter
        .consume(socket.remoteAddress, 1)
        .then(() => {
          this.initializeSocket(socket)

          socket.on('data', (data) => {
            try {
              const startDelimeter = data.slice(0, 2)

              if (
                socket.recvBuffer.length == 0 &&
                !startDelimeter.equals(Buffer.from([0x55, 0xaa]))
              ) {
                winston.warn(
                  'Process packet failed, packet not starting with 0xaa55',
                  {
                    metadata: {
                      user: socket.user ? socket.user.id : null,
                      client: socket.client ? socket.client.id : null,
                      processId: socket.processId,
                      crc: socket.fileCRC,
                      ip: socket.remoteAddress,
                      packet: data.toString('hex'),
                    },
                  }
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
              winston.error(error, {
                metadata: {
                  user: socket.user ? socket.user.id : null,
                  client: socket.client ? socket.client.id : null,
                  processId: socket.processId,
                  crc: socket.fileCRC,
                  ip: socket.remoteAddress,
                },
              })
            }
          })

          socket.on('recv', async (data) => {
            try {
              const startDelimeter = data.slice(0, 2)
              const endDelimeter = data.slice(data.length - 2, data.length)

              if (!startDelimeter.equals(Buffer.from([0x55, 0xaa]))) {
                winston.warn('Process packet failed, StreamHeader != 0xaa55', {
                  metadata: {
                    user: socket.user ? socket.user.id : null,
                    client: socket.client ? socket.client.id : null,
                    processId: socket.processId,
                    crc: socket.fileCRC,
                    ip: socket.remoteAddress,
                  },
                })
                return
              }

              if (!endDelimeter.equals(Buffer.from([0xaa, 0x55]))) {
                winston.warn('Process packet failed, StreamFooter != 0x55aa', {
                  metadata: {
                    user: socket.user ? socket.user.id : null,
                    client: socket.client ? socket.client.id : null,
                    processId: socket.processId,
                    crc: socket.fileCRC,
                    ip: socket.remoteAddress,
                  },
                })
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
              const size = decryptedPacket.readUnsignedInt()

              if (flag) {
                //const packetCommpressed = decryptedPacket.read()
                //const uncompressedPacket = lzf.decompress(packetCommpressed.raw)
                //decryptedPacket = new ByteBuffer(Array.from(uncompressedPacket))
              }

              const packetHeader = decryptedPacket.readByte()

              if (decryptedPacket.available > 0) {
                const packetBody = decryptedPacket.read()
                socket.recv.emit(packetHeader, new ByteBuffer(packetBody))
              } else {
                socket.recv.emit(packetHeader)
              }
            } catch (error) {
              winston.error(error, {
                metadata: {
                  user: socket.user ? socket.user.id : null,
                  client: socket.client ? socket.client.id : null,
                  processId: socket.processId,
                  crc: socket.fileCRC,
                  ip: socket.remoteAddress,
                },
              })
            }
          })

          socket.on('send', (data, compress = false) => {
            try {
              const packet = new ByteBuffer()

              //Stream Header
              packet.writeUnsignedShort(this.streamHeader)

              const encryptionPacket = new ByteBuffer()

              //Packet
              if (compress && data.length >= 512) {
                //encryptionPacket.writeUnsignedByte(1) //compression flag
                //encryptionPacket.writeUnsignedInt(data.length) //raw packet size
                //var compressedData = lzf.compress(data)
                //encryptionPacket.writeUnsignedInt(compressedData.length) //compressed packet size
                //encryptionPacket.write(compressedData) //compressed data
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
              winston.error(error, {
                metadata: {
                  user: socket.user ? socket.user.id : null,
                  client: socket.client ? socket.client.id : null,
                  processId: socket.processId,
                  crc: socket.fileCRC,
                  ip: socket.remoteAddress,
                },
              })
            }
          })

          socket.on('close', async () => {
            try {
              winston.info(
                'Close: ' + socket.remoteAddress + ':' + socket.remotePort,
                {
                  metadata: {
                    user: socket.user ? socket.user.id : null,
                    client: socket.client ? socket.client.id : null,
                    processId: socket.processId,
                    crc: socket.fileCRC,
                    ip: socket.remoteAddress,
                  },
                }
              )

              if (socket.data) {
                await SessionModel.findByIdAndDelete(socket.data.id)
              }
            } catch (error) {
              winston.error(error, {
                metadata: {
                  user: socket.user ? socket.user.id : null,
                  client: socket.client ? socket.client.id : null,
                  processId: socket.processId,
                  crc: socket.fileCRC,
                  ip: socket.remoteAddress,
                },
              })
            }

            clearTimeout(socket.waitingReadyTimeoutId)
            clearTimeout(socket.pingIntervalId)
            socket.removeAllListeners()
            socket.recv.removeAllListeners()
            socket.send.removeAllListeners()
          })

          socket.on('error', async (error) => {
            try {
              if (socket.data) {
                await SessionModel.findByIdAndDelete(socket.data.id)
              }

              winston.error(
                'Error: ' +
                  socket.remoteAddress +
                  ':' +
                  socket.remotePort +
                  ' - ' +
                  error.code,
                {
                  metadata: {
                    user: socket.user ? socket.user.id : null,
                    client: socket.client ? socket.client.id : null,
                    processId: socket.processId,
                    crc: socket.fileCRC,
                    ip: socket.remoteAddress,
                  },
                }
              )
            } catch (error) {
              winston.error(error, {
                metadata: {
                  user: socket.user ? socket.user.id : null,
                  client: socket.client ? socket.client.id : null,
                  processId: socket.processId,
                  crc: socket.fileCRC,
                  ip: socket.remoteAddress,
                },
              })
            }

            clearTimeout(socket.waitingReadyTimeoutId)
            clearTimeout(socket.pingIntervalId)
            socket.removeAllListeners()
            socket.recv.removeAllListeners()
            socket.send.removeAllListeners()
          })
        })
        .catch(() => {
          winston.warn(
            `${socket.remoteAddress} - Connection create rate limited, socket destroying`,
            {
              metadata: {
                user: socket.user ? socket.user.id : null,
                client: socket.client ? socket.client.id : null,
                processId: socket.processId,
                crc: socket.fileCRC,
                ip: socket.remoteAddress,
              },
            }
          )
          socket.destroy()
        })
    })
  }

  async createWebServer() {
    this.express = express()

    this.express.use(cors())
    this.express.use(express.json())
    this.express.use(express.urlencoded({ extended: false }))
    this.express.use(express.static(path.resolve('./public')))

    this.express.set('trust proxy', true)

    //Routes
    this.express.use('/auth/login', authLoginRouter)
    this.express.use('/admin/pointer', adminMiddleware, adminPointerRouter)
    this.express.use('/admin/version', adminMiddleware, adminVersionRouter)
    this.express.use('/admin/library', adminMiddleware, adminLibraryRouter)
    this.express.use('/admin/user', adminMiddleware, adminUserRouter)

    this.express.listen(process.env.WEB_PORT, () => {
      winston.info(`Web: Running on port - ${process.env.WEB_PORT}`)
    })
  }
}

export { Server }
