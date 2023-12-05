import PacketHeader from '../core/enums/packetHeader.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import fs from 'fs'

class Update extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.UPDATE,
      authorization: true,
      rateLimitOpts: {
        points: 1000,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    try {
      let updateFile = await fs.readFileSync(`./data/updates/Update.zip`)
      this.send(updateFile, updateFile.length)
    } catch (error) {
      console.info(error)
    }
  }

  async send(buffer, bufferLength) {
    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)
    packet.writeUnsignedInt(bufferLength)

    packet.write(buffer)

    this.socket.emit('send', packet.raw)
  }
}

export default Update
