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

  async send() {}
}

export default Ping
