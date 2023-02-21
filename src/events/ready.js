import PacketHeader from '../core/enums/packetHeader.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import { createHash } from '../utils/cryption.js'

class Ready extends Event {
  constructor(socket) {
    super(socket, {
      header: PacketHeader.READY,
      authorization: false,
    })
  }

  async recv(packet) {
    const processId = packet.readUnsignedInt()

    this.socket.generateSeed(processId)

    this.socket.initialVector = createHash(
      'md5',
      createHash(
        'sha256',
        this.socket.seed.toString() + '.' + process.env.SALT_KEY
      )
    )
    console.info(
      `Ready: Seed - ${
        this.socket.seed
      } | IV - ${this.socket.initialVector.toString('hex')}`
    )

    const socketId = this.socket.generateSocketId()

    await this.send(socketId)

    this.socket.id = socketId
  }

  async send(socketId) {
    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)
    packet.writeUnsignedInt(socketId)

    this.socket.emit('send', packet.raw)
  }
}

export default Ready
