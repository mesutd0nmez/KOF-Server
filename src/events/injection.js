import PacketHeader from '../core/enums/packetHeader.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import fs from 'fs'
import PlatformType from '../core/enums/platformType.js'

class Injection extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.INJECTION,
      authorization: true,
      subscribed: true,
      rateLimitOpts: {
        points: 8,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    try {
      const platform = packet.readUnsignedByte()

      let defaultAdapter = null

      switch (platform) {
        case PlatformType.CNKO:
        case PlatformType.USKO:
        case PlatformType.KOKO:
        case PlatformType.STKO:
          {
            defaultAdapter = await fs.readFileSync(
              `./data/libraries/Adapter.dll`
            )
          }
          break
      }

      if (defaultAdapter) {
        this.server.serverLogger.info(
          `Injection: Library to be injection has been sent`,
          {
            metadata: this.socket.metadata,
          }
        )

        const packet = new ByteBuffer()

        packet.writeUnsignedByte(this.options.header)

        packet.writeUnsignedInt(defaultAdapter.length)
        packet.write(defaultAdapter)

        this.socket.emit('send', packet.raw, true)
      } else {
        this.server.serverLogger.info(
          `Injection: Unable to injection due to technical problem`,
          {
            metadata: this.socket.metadata,
          }
        )
      }
    } catch (error) {
      this.server.serverLogger.error(error, {
        metadata: this.socket.metadata,
      })
    }
  }
}

export default Injection
