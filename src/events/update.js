import PacketHeader from '../core/enums/packetHeader.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import fs from 'fs'
import winston from 'winston'

class Update extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.UPDATE,
      authorization: true,
      rateLimitOpts: {
        points: 50,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    try {
      let updateFile = await fs.readFileSync(`./data/updates/Update.zip`)
      this.send(updateFile, updateFile.length)
    } catch (error) {
      winston.error(error, {
        metadata: {
          user: this.socket.user ? this.socket.user.id : null,
          client: this.socket.client ? this.socket.client.id : null,
          processId: this.socket.processId,
          crc: this.socket.fileCRC,
          ip: this.socket.remoteAddress,
        },
      })
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
