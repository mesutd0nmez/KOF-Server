import PacketHeader from '../core/enums/packetHeader.js'
import Event from '../core/event.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import UserModel from '../models/user.js'

class Ping extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.PING,
      authorization: true,
      rateLimitOpts: {
        points: 8,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    try {
      this.socket.lastPongTime = Date.now()

      const pingMs = this.socket.lastPongTime - this.socket.lastPingTime

      if (process.env.NODE_ENV == 'development') {
        this.server.serverLogger.info(
          `Ping: ${this.socket.remoteAddress.replace(
            '::ffff:',
            ''
          )} ${pingMs}ms`,
          {
            metadata: this.socket.metadata,
          }
        )
      }

      if (pingMs > 1000) {
        this.server.serverLogger.warn(
          `Ping: ${this.socket.remoteAddress.replace(
            '::ffff:',
            ''
          )} ${pingMs}ms high ping, maybe locked process or network stability problem`,
          {
            metadata: this.socket.metadata,
          }
        )
      }

      if (process.env.NODE_ENV != 'development') {
        const timeDifference =
          this.socket.lastPongTime - this.socket.lastPingTime

        if (timeDifference > 30000) {
          this.server.serverLogger.warn(
            'Time difference in last ping process is more than 30 seconds. Possible locked process or network stability problem, socket destroyed',
            {
              metadata: this.socket.metadata,
            }
          )

          return this.socket.destroy()
        }
      }

      this.socket.lastPingTime = 0

      const characterName = packet.readString(true)
      const characterX = packet.readFloat()
      const characterY = packet.readFloat()
      const characterMapIndex = packet.readUnsignedByte()
    } catch (error) {
      this.server.serverLogger.error(error, {
        metadata: this.socket.metadata,
      })
    }
  }

  async send() {
    if (process.env.NODE_ENV == 'development') {
      this.server.serverLogger.info(
        `Ping: ${this.socket.remoteAddress.replace('::ffff:', '')} Requested`,
        {
          metadata: this.socket.metadata,
        }
      )
    }

    if (process.env.NODE_ENV != 'development') {
      if (this.socket.lastPingTime != 0 && this.socket.lastPongTime == 0) {
        this.server.serverLogger.warn(
          'Time difference in last ping process is more than 30 seconds. Possible locked process or network stability problem, socket destroyed',
          {
            metadata: this.socket.metadata,
          }
        )

        return this.socket.destroy()
      }
    }

    this.socket.lastPongTime = 0
    this.socket.lastPingTime = Date.now()

    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)

    if (this.socket.user) {
      packet.writeUnsignedInt(
        this.socket.user.subscriptionEndAt.getTime() / 1000
      )
      packet.writeInt(this.socket.user.credit)
    } else {
      packet.writeUnsignedInt(0)
      packet.writeInt(0)
    }

    this.socket.emit('send', packet.raw)
  }
}

export default Ping
