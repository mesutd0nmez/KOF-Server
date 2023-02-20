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
    const processId = packet.readUnsignedBigInt()

    this.socket.generateSeed(parseInt(processId))
    this.socket.initialVector = createHash('md5', this.socket.seed.toString())

    console.info(`Ready: Socket ready with process id ${processId}`)
    console.info(
      `Ready: Seed - ${
        this.socket.seed
      } | IV - ${this.socket.initialVector.toString('hex')}`
    )

    this.send()
  }

  async send() {
    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)

    this.socket.emit('send', packet.raw)
  }
}

export default Ready
