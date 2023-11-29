import PacketHeader from '../core/enums/packetHeader.js'
import Event from '../core/event.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
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
    const clientTime = packet.readUnsignedInt()
    this.socket.lastPongTime = Date.now()
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
