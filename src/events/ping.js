import PacketHeader from '../core/enums/packetHeader.js'
import Event from '../core/event.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import SessionModel from '../models/session.js'

class Ping extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.PING,
      authorization: true,
      rateLimitOpts: {
        points: 1000,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    this.socket.lastPongTime = Date.now()

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
    this.socket.lastPingTime = Date.now()

    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)
    packet.writeUnsignedInt(this.socket.lastPingTime / 1000)

    this.socket.emit('send', packet.raw)
  }
}

export default Ping
