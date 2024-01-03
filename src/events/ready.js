import PacketHeader from '../core/enums/packetHeader.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import { createHash } from '../utils/cryption.js'
import VersionModel from '../models/version.js'

class Ready extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.READY,
      authorization: false,
      rateLimitOpts: {
        points: 8,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    try {
      this.socket.metadata.processId = packet.readUnsignedInt()
      this.socket.metadata.fileName = packet.readString(true)
      this.socket.metadata.fileCRC = packet.readUnsignedInt()
      this.socket.metadata.client.systemName = packet.readString(true)
      this.socket.metadata.client.uuid = packet.readString(true)
      this.socket.metadata.client.systemSerialNumber = packet.readString(true)
      this.socket.metadata.client.gpu = packet.readString(true)

      let versionInfo = await VersionModel.findOne({
        fileName: this.socket.metadata.fileName,
        crc: this.socket.metadata.fileCRC,
      })

      if (process.env.NODE_ENV != 'development') {
        if (!versionInfo) {
          this.server.serverLogger.warn(`Possible file integrity activity`, {
            metadata: this.socket.metadata,
          })

          return this.socket.destroy()
        }
      }

      this.socket.ready = true

      await this.send()

      this.socket.generateSeed(this.socket.id + this.socket.metadata.processId)
      this.socket.initialVector = createHash(
        'md5',
        createHash(
          'sha256',
          this.socket.seed.toString() + '.' + process.env.IV_SALT_KEY
        )
      )

      this.server.serverLogger.info(`Socket: Ready`, {
        metadata: this.socket.metadata,
      })
    } catch (error) {
      this.server.serverLogger.error(error, {
        metadata: this.socket.metadata,
      })
    }
  }

  async send() {
    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)
    packet.writeUnsignedInt(this.socket.id)
    this.socket.emit('send', packet.raw)
  }
}

export default Ready
