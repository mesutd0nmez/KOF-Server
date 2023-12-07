import PacketHeader from '../core/enums/packetHeader.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import { createHash } from '../utils/cryption.js'
import SessionModel from '../models/session.js'
import VersionModel from '../models/version.js'
import winston from 'winston'

class Ready extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.READY,
      authorization: false,
      rateLimitOpts: {
        points: 50,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    this.socket.processId = packet.readUnsignedInt()
    this.socket.fileCRC = packet.readUnsignedInt()

    let versionInfo = await VersionModel.findOne({
      crc: this.socket.fileCRC,
    })

    if (process.env.NODE_ENV != 'development') {
      if (!versionInfo) {
        winston.warn(`Possible file integrity activity suspicion`, {
          metadata: {
            processId: this.socket.processId,
            crc: this.socket.fileCRC,
            ip: this.socket.remoteAddress,
          },
        })
        return this.socket.destroy()
      }
    }

    this.socket.connectionReadyTime = Date.now()
    this.socket.ready = true

    this.socket.data = await SessionModel.create({
      socketId: this.socket.id,
      ip: this.socket.remoteAddress,
      processId: this.socket.processId,
      fileCRC: this.socket.fileCRC,
    })

    await this.send()

    this.socket.generateSeed(this.socket.id + this.socket.processId)
    this.socket.initialVector = createHash(
      'md5',
      createHash(
        'sha256',
        this.socket.seed.toString() + '.' + process.env.IV_SALT_KEY
      )
    )

    winston.info(`Socket: Ready`, {
      metadata: {
        processId: this.socket.processId,
        crc: this.socket.fileCRC,
        ip: this.socket.remoteAddress,
      },
    })
  }

  async send() {
    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)
    packet.writeUnsignedInt(this.socket.id)
    this.socket.emit('send', packet.raw)
  }
}

export default Ready
