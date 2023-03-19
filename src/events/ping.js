import PacketHeader from '../core/enums/packetHeader.js'
import Event from '../core/event.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
class Ping extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.PING,
      authorization: true,
      rateLimitOpts: {
        points: 5,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    if (!this.socket.pingRequested) {
      console.info(
        `Not requested ping, suspicious socket connection destroying`
      )

      return this.socket.destroy()
    }

    const clientTime = packet.readUnsignedInt()

    this.socket.lastPongTime = Date.now()
    this.socket.pingRequested = false

    this.socket.responseTime =
      this.socket.lastPongTime - this.socket.lastPingTime

    console.info(
      `Ping: Server time - ${Math.ceil(this.socket.lastPongTime / 1000)}`
    )
    console.info(`Ping: Client time - ${clientTime}`)
    console.info(`Ping: Response time - ${this.socket.responseTime}ms`)
  }

  async send() {
    this.socket.lastPingTime = Date.now()

    this.socket.pingRequested = true

    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)
    packet.writeUnsignedInt(this.socket.lastPingTime / 1000)

    this.socket.emit('send', packet.raw)
  }
}

export default Ping
