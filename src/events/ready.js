import PacketHeader from '../core/enums/packetHeader.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import { createHash } from '../utils/cryption.js'

class Ready extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.READY,
      authorization: false,
      rateLimitOpts: {
        points: 5,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    this.socket.processId = packet.readUnsignedInt()

    this.socket.connectionReadyTime = Date.now()
    this.socket.ready = true

    this.socket.pingIntervalId = setInterval(this.socket.pingInterval, 60000)

    await this.send()

    this.socket.generateSeed(this.socket.id + this.socket.processId)
    this.socket.initialVector = createHash(
      'md5',
      createHash(
        'sha256',
        this.socket.seed.toString() + '.' + process.env.IV_SALT_KEY
      )
    )
  }

  async send() {
    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)
    packet.writeUnsignedInt(this.socket.id)
    this.socket.emit('send', packet.raw)
  }
}

export default Ready
