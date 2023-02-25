import PacketHeader from '../core/enums/packetHeader.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'

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

  async recv() {
    if (!this.socket.pingRequested) {
      console.info(
        `Not requested ping, suspicious socket connection destroying`
      )

      return this.socket.destroy()
    }

    this.socket.lastPongTime = Date.now()
    this.socket.pingRequested = false

    this.socket.responseTime =
      this.socket.lastPongTime - this.socket.lastPingTime

    console.info(`Ping: Response time - ${this.socket.responseTime}ms`)
  }

  async send() {
    if (this.socket.pingRequested) {
      if (Date.now() - this.socket.lastPingTime >= 60000) {
        console.info(
          `Pong was not sent in the appropriate time interval (60s), socket connection destroying`
        )

        return this.socket.destroy()
      }
    } else {
      const packet = new ByteBuffer()

      packet.writeUnsignedByte(this.options.header)

      this.socket.lastPingTime = Date.now()
      this.socket.pingRequested = true

      this.socket.emit('send', packet.raw)
    }
  }
}

export default Ping
