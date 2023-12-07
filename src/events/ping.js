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
        points: 50,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    this.socket.lastPongTime = Date.now()

    if (process.env.NODE_ENV != 'development') {
      const timeDifference = this.socket.lastPongTime - this.socket.lastPingTime

      if (timeDifference > 15000) {
        winston.warn(
          'Time difference in last ping process is more than 15 seconds. Possible suspend activity or connection problem, socket destroyed',
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
    if (this.socket.lastPingTime != 0 && this.socket.lastPongTime == 0) {
      winston.warn(
        'Time difference in last ping process is more than 15 seconds. Possible suspend activity or connection problem, socket destroyed',
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

    this.socket.lastPongTime = 0
    this.socket.lastPingTime = Date.now()

    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)
    packet.writeUnsignedInt(this.socket.lastPingTime / 1000)

    this.socket.emit('send', packet.raw)
  }
}

export default Ping
