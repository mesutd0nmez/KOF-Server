import PacketHeader from '../core/enums/packetHeader.js'
import Event from '../core/event.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import SessionModel from '../models/session.js'
import winston from 'winston'

class Ping extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.PING,
      authorization: true,
      rateLimitOpts: {
        points: 16,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    this.socket.lastPongTime = Date.now()

    const pingMs = this.socket.lastPongTime - this.socket.lastPingTime

    if (process.env.NODE_ENV == 'development') {
      winston.info(`Ping: ${this.socket.remoteAddress} ${pingMs}ms`, {
        metadata: {
          user: this.socket.user ? this.socket.user.id : null,
          client: this.socket.client ? this.socket.client.id : null,
          processId: this.socket.processId,
          crc: this.socket.fileCRC,
          ip: this.socket.remoteAddress,
        },
      })
    }

    if (pingMs > 1000) {
      winston.warn(
        `Ping: ${this.socket.remoteAddress} ${pingMs}ms high ping, maybe locked process or network stability problem`,
        {
          metadata: {
            user: this.socket.user ? this.socket.user.id : null,
            client: this.socket.client ? this.socket.client.id : null,
            processId: this.socket.processId,
            crc: this.socket.fileCRC,
            ip: this.socket.remoteAddress,
          },
        }
      )
    }

    if (process.env.NODE_ENV != 'development') {
      const timeDifference = this.socket.lastPongTime - this.socket.lastPingTime

      if (timeDifference > 30000) {
        winston.warn(
          'Time difference in last ping process is more than 30 seconds. Possible locked process or network stability problem, socket destroyed',
          {
            metadata: {
              user: this.socket.user ? this.socket.user.id : null,
              client: this.socket.client ? this.socket.client.id : null,
              processId: this.socket.processId,
              crc: this.socket.fileCRC,
              ip: this.socket.remoteAddress,
            },
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

    this.socket.data = await SessionModel.findOneAndUpdate(
      { _id: this.socket.data.id },
      {
        $set: {
          characterName: characterName,
          characterX: characterX,
          characterY: characterY,
          characterMapIndex: characterMapIndex,
        },
      },
      { new: true }
    )
  }

  async send() {
    if (process.env.NODE_ENV == 'development') {
      winston.info(`Ping: ${this.socket.remoteAddress} Requested`, {
        metadata: {
          user: this.socket.user ? this.socket.user.id : null,
          client: this.socket.client ? this.socket.client.id : null,
          processId: this.socket.processId,
          crc: this.socket.fileCRC,
          ip: this.socket.remoteAddress,
        },
      })
    }

    if (process.env.NODE_ENV != 'development') {
      if (this.socket.lastPingTime != 0 && this.socket.lastPongTime == 0) {
        winston.warn(
          'Time difference in last ping process is more than 30 seconds. Possible locked process or network stability problem, socket destroyed',
          {
            metadata: {
              user: this.socket.user ? this.socket.user.id : null,
              client: this.socket.client ? this.socket.client.id : null,
              processId: this.socket.processId,
              crc: this.socket.fileCRC,
              ip: this.socket.remoteAddress,
            },
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
    } else {
      packet.writeUnsignedInt(0)
    }

    this.socket.emit('send', packet.raw)
  }
}

export default Ping
