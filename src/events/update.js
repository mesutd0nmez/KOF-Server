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
        points: 8,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    try {
      const updateFile = await fs.readFileSync(`./data/updates/Update.zip`)
      const updaterFile = await fs.readFileSync(`./data/updates/Updater.exe`)

      const packet = new ByteBuffer()

      packet.writeUnsignedByte(this.options.header)
      packet.writeUnsignedInt(updateFile.length)
      packet.write(updateFile)
      packet.writeUnsignedInt(updaterFile.length)
      packet.write(updaterFile)

      this.socket.emit('send', packet.raw)
    } catch (error) {
      this.server.serverLogger.error(error, {
        metadata: this.socket.metadata,
      })
    }
  }
}

export default Update
