import PacketHeader from '../core/enums/packetHeader.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import fs from 'fs'
import PlatformType from '../core/enums/platformType.js'

class Injection extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.POINTER,
      authorization: true,
      rateLimitOpts: {
        points: 8,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    try {
      let defaultPointerFile = null

      const platform = packet.readUnsignedByte()

      switch (platform) {
        case PlatformType.USKO:
          {
            defaultPointerFile = await fs.readFileSync(
              `./data/pointers/usko.ini`
            )
          }
          break

        case PlatformType.CNKO:
          {
            defaultPointerFile = await fs.readFileSync(
              `./data/pointers/cnko.ini`
            )
          }
          break

        case PlatformType.KOKO:
          {
            defaultPointerFile = await fs.readFileSync(
              `./data/pointers/koko.ini`
            )
          }
          break

        case PlatformType.STKO:
          {
            defaultPointerFile = await fs.readFileSync(
              `./data/pointers/stko.ini`
            )
          }
          break
      }

      if (defaultPointerFile) {
        this.server.serverLogger.info(`Pointer: List sended`, {
          metadata: this.socket.metadata,
        })
        this.send(defaultPointerFile, defaultPointerFile.length)
      } else {
        this.server.serverLogger.info(
          `Pointer: Unable to send pointer due to technical problem`,
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

  async send(buffer, bufferLength) {
    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)

    packet.writeUnsignedInt(bufferLength)
    packet.write(buffer)

    this.socket.emit('send', packet.raw, true)
  }
}

export default Injection
