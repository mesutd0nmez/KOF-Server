import net from 'net'
import { glob } from 'glob'
import path from 'path'
import EventEmitter from 'events'
import { clearTimeout } from 'timers'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import express from 'express'
import cors from 'cors'
import winston from 'winston'
import 'winston-daily-rotate-file'

import morgan from 'morgan'
import Snappy from 'snappy'
import lzf from 'lzfjs'

import { ByteBuffer } from './utils/byteBuffer.js'
import PacketHeader from './core/enums/packetHeader.js'
import { createHash, encrypt, decrypt } from './utils/cryption.js'

import adminMiddleware from './middleware/admin.js'
import authLoginRouter from './routes/v1/auth/login.js'
import adminUsersRouter from './routes/v1/admin/users.js'
import adminFirewallRouter from './routes/v1/admin/firewall.js'
import adminMaintenanceRouter from './routes/v1/admin/maintenance.js'
import storePurchaseRouter from './routes/v1/store/purchase.js'

class Server extends EventEmitter {
  constructor(options) {
    super()
    this.options = options
    this.server = null
    this.eventPromises = []
    this.bufferSize = 32 * (1024 * 1024) //32MB

    this.sessions = new Map()
    this.users = new Map()
    this.clients = new Map()
    this.ipBlock = new Set()

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

    this.serverLogger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          level: process.env.NODE_ENV == 'development' ? 'silly' : 'error',
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        new winston.transports.DailyRotateFile({
          level: 'silly',
          filename: './logs/server-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '32m',
          maxFiles: '14d',
        }),
        new winston.transports.DailyRotateFile({
          level: 'error',
          filename: './logs/server-error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '32m',
          maxFiles: '14d',
        }),
      ],
    })

    this.webLogger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          level: process.env.NODE_ENV == 'development' ? 'silly' : 'error',
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        new winston.transports.DailyRotateFile({
          level: 'silly',
          filename: './logs/web-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '32m',
          maxFiles: '14d',
        }),
        new winston.transports.DailyRotateFile({
          level: 'error',
          filename: './logs/web-error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '32m',
          maxFiles: '14d',
        }),
      ],
    })

    this.reportLogger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          level: process.env.NODE_ENV == 'development' ? 'silly' : 'error',
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        new winston.transports.DailyRotateFile({
          level: 'silly',
          filename: './logs/server-report-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '32m',
          maxFiles: '14d',
        }),
      ],
    })

    this.vitalLogger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          level: process.env.NODE_ENV == 'development' ? 'silly' : 'error',
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        new winston.transports.DailyRotateFile({
          level: 'silly',
          filename: './logs/server-vital-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '32m',
          maxFiles: '14d',
        }),
      ],
    })
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
    this.serverLogger.info(
      `Connection: ${socket.remoteAddress.replace('::ffff:', '')}:${
        socket.remotePort
      }`
    )

    socket.ready = false
    socket.id = this.socketIdCounter++

    socket.recv = new EventEmitter()
    socket.send = new EventEmitter()

    socket.recvBuffer = Buffer.alloc(0)

    socket.lastPongTime = 0
    socket.lastPingTime = 0

    socket.user = {}

    socket.metadata = {
      processId: -1,
      userId: '',
      clientId: '',
      fileCRC: 0xffffffff,
      fileName: '',
      ipAddress: socket.remoteAddress.replace('::ffff:', ''),
      client: {
        systemName: '',
        uuid: '',
        systemSerialNumber: '',
        gpu: '',
        hwid: '',
      },
    }

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

    socket.readyTimeoutId = 0
    socket.readyTimeout = () => {
      if (socket.ready == false) {
        this.serverLogger.warn(
          `Client not sended ready packet, is suspicious socket. Connection destroying`,
          {
            metadata: socket.metadata,
          }
        )
        socket.destroy()
      }
    }

    socket.readyTimeoutId = setTimeout(socket.readyTimeout, 15000)

    socket.pingIntervalId = 0
    socket.pingInterval = () => {
      socket.send.emit(PacketHeader.PING)
    }

    socket.pingIntervalId = setInterval(socket.pingInterval, 30000)

    this.sessions.set(socket.id, socket)
  }

  async createServer() {
    if (this.server) {
      this.serverLogger.error(`Server already running`)
      return
    }

    await this.buildEvents()

    this.server = net.createServer((socket) => {
      //socket.setKeepAlive(true, 1800000)
      //socket.setNoDelay(true)
    })

    this.server.listen(this.options.port, () => {
      this.serverLogger.info(`Server: Running on port - ${this.options.port}`)
    })

    this.server.on('connection', (socket) => {
      if (this.ipBlock.has(socket.remoteAddress.replace('::ffff:', ''))) {
        this.serverLogger.warn(
          `${socket.remoteAddress.replace(
            '::ffff:',
            ''
          )} is in blocked ip list, connection destroying`,
          {
            metadata: socket.metadata,
          }
        )
        return socket.destroy()
      }
      this.connectionRateLimiter
        .consume(socket.remoteAddress.replace('::ffff:', ''), 1)
        .then(() => {
          this.initializeSocket(socket)

          socket.on('data', (data) => {
            try {
              if (data.length > this.bufferSize) {
                this.serverLogger.warn(
                  `Received message to long, data.length(${data.length}) > bufferSize(${this.bufferSize})`,
                  {
                    metadata: socket.metadata,
                  }
                )
                socket.recvBuffer = Buffer.alloc(0)
                return
              }

              const startDelimeter = data.slice(0, 2)

              if (
                socket.recvBuffer.length == 0 &&
                !startDelimeter.equals(Buffer.from([0x55, 0xaa]))
              ) {
                this.serverLogger.warn(
                  'Process packet failed, packet not starting with 0xaa55',
                  {
                    metadata: socket.metadata,
                  }
                )
                socket.recvBuffer = Buffer.alloc(0)
                return
              }

              const endDelimeter = data.slice(data.length - 2, data.length)

              socket.recvBuffer = Buffer.concat([socket.recvBuffer, data])

              if (socket.recvBuffer.length > this.bufferSize) {
                this.serverLogger.warn(
                  `Received buffer message to long, socket.recvBuffer.length(${data.length}) > bufferSize(${this.bufferSize})`,
                  {
                    metadata: socket.metadata,
                  }
                )
                socket.recvBuffer = Buffer.alloc(0)
                return
              }

              if (endDelimeter.equals(Buffer.from([0xaa, 0x55]))) {
                socket.emit('recv', socket.recvBuffer)
                socket.recvBuffer = Buffer.alloc(0)
              }
            } catch (error) {
              this.serverLogger.error(error, {
                metadata: socket.metadata,
              })
            }
          })

          socket.on('recv', async (data) => {
            try {
              const startDelimeter = data.slice(0, 2)
              const endDelimeter = data.slice(data.length - 2, data.length)

              if (!startDelimeter.equals(Buffer.from([0x55, 0xaa]))) {
                this.serverLogger.warn(
                  'Process packet failed, StreamHeader != 0xaa55',
                  {
                    metadata: socket.metadata,
                  }
                )
                return
              }

              if (!endDelimeter.equals(Buffer.from([0xaa, 0x55]))) {
                this.serverLogger.warn(
                  'Process packet failed, StreamFooter != 0x55aa',
                  {
                    metadata: socket.metadata,
                  }
                )
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
                if (process.env.COMPRESSION_METHOD == 'snappy') {
                  const packetCommpressed = decryptedPacket.read()
                  const uncompressedPacket = await Snappy.uncompress(
                    packetCommpressed.raw
                  )
                  decryptedPacket = new ByteBuffer(
                    Array.from(uncompressedPacket)
                  )
                } else {
                  const packetCommpressed = decryptedPacket.read()
                  const uncompressedPacket = lzf.decompress(
                    packetCommpressed.raw
                  )
                  decryptedPacket = new ByteBuffer(
                    Array.from(uncompressedPacket)
                  )
                }
              }

              const packetHeader = decryptedPacket.readByte()

              if (decryptedPacket.available > 0) {
                const packetBody = decryptedPacket.read()
                socket.recv.emit(packetHeader, new ByteBuffer(packetBody))
              } else {
                socket.recv.emit(packetHeader)
              }
            } catch (error) {
              this.serverLogger.error(error, {
                metadata: socket.metadata,
              })
            }
          })

          socket.on('send', async (data, compress = false) => {
            try {
              const packet = new ByteBuffer()

              //Stream Header
              packet.writeUnsignedShort(this.streamHeader)

              const encryptionPacket = new ByteBuffer()

              //Packet
              if (compress && data.length >= 512) {
                if (process.env.COMPRESSION_METHOD == 'snappy') {
                  encryptionPacket.writeUnsignedByte(1) //compression flag
                  encryptionPacket.writeUnsignedInt(data.length) //raw packet size
                  const compressedData = await Snappy.compress(data)
                  encryptionPacket.write(compressedData) //compressed data
                } else {
                  encryptionPacket.writeUnsignedByte(1) //compression flag
                  encryptionPacket.writeUnsignedInt(data.length) //raw packet size
                  var compressedData = lzf.compress(data)
                  encryptionPacket.write(compressedData) //compressed data
                }
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
              this.serverLogger.error(error, {
                metadata: socket.metadata,
              })
            }
          })

          socket.on('close', async () => {
            this.sessions.delete(socket.id, socket)
            this.users.delete(socket.metadata.userId)
            this.clients.delete(socket.metadata.clientId)

            try {
              this.serverLogger.info(
                'Close: ' +
                  socket.remoteAddress.replace('::ffff:', '') +
                  ':' +
                  socket.remotePort,
                {
                  metadata: socket.metadata,
                }
              )
            } catch (error) {
              this.serverLogger.error(error, {
                metadata: socket.metadata,
              })
            }

            clearTimeout(socket.waitingReadyTimeoutId)
            clearTimeout(socket.pingIntervalId)
            socket.removeAllListeners()
            socket.recv.removeAllListeners()
            socket.send.removeAllListeners()
          })

          socket.on('error', async (error) => {
            this.sessions.delete(socket.id)
            this.users.delete(socket.metadata.userId)
            this.clients.delete(socket.metadata.clientId)

            try {
              this.serverLogger.error(
                'Error: ' +
                  socket.remoteAddress.replace('::ffff:', '') +
                  ':' +
                  socket.remotePort +
                  ' - ' +
                  error.code,
                {
                  metadata: socket.metadata,
                }
              )
            } catch (error) {
              this.serverLogger.error(error, {
                metadata: socket.metadata,
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
          this.serverLogger.warn(
            `${socket.remoteAddress.replace(
              '::ffff:',
              ''
            )} - Connection create rate limited, socket destroying`,
            {
              metadata: socket.metadata,
            }
          )
        })
    })
  }

  async createWebServer() {
    this.express = express()

    const morganMiddleware = morgan(
      ':method :url :status :res[content-length] - :response-time ms',
      {
        stream: {
          write: (message) => this.webLogger.http(message.trim()),
        },
      }
    )

    this.express.use(morganMiddleware)

    this.express.server = this
    this.express.logger = this.webLogger

    this.express.use(cors())
    this.express.use(express.json())
    this.express.use(express.urlencoded({ extended: false }))
    this.express.use(express.static(path.resolve('./public')))

    this.express.set('trust proxy', true)

    //Public Routes
    this.express.use('/v1/auth/login', authLoginRouter)
    this.express.use('/v1/store/purchase', storePurchaseRouter)

    //Admin Routes
    this.express.use('/v1/admin/users', adminMiddleware, adminUsersRouter)
    this.express.use('/v1/admin/firewall', adminMiddleware, adminFirewallRouter)
    this.express.use(
      '/v1/admin/maintenance',
      adminMiddleware,
      adminMaintenanceRouter
    )

    this.express.listen(process.env.WEB_PORT, () => {
      this.webLogger.info(`Web: Running on port - ${process.env.WEB_PORT}`)
    })
  }
}

export { Server }
