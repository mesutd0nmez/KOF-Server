import PacketHeader from '../core/enums/packetHeader.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import fs from 'fs'
import PlatformType from '../core/enums/platformType.js'
import AppType from '../core/enums/appType.js'

class Injection extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.POINTER,
      authorization: true,
      rateLimitOpts: {
        points: 5,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    const appType = packet.readUnsignedByte()

    let defaultPointerFile = null

    switch (appType) {
      case AppType.LOADER:
        {
          try {
            defaultPointerFile = await fs.readFileSync(
              `./data/pointers/loader.ini`
            )
          } catch (error) {
            console.info(error)
          }
        }
        break
      case AppType.BOT:
        {
          const platform = packet.readUnsignedByte()

          switch (platform) {
            case PlatformType.USKO:
              {
                try {
                  defaultPointerFile = await fs.readFileSync(
                    `./data/pointers/usko.ini`
                  )
                } catch (error) {
                  console.info(error)
                }
              }
              break

            case PlatformType.CNKO:
              {
                try {
                  defaultPointerFile = await fs.readFileSync(
                    `./data/pointers/cnko.ini`
                  )
                } catch (error) {
                  console.info(error)
                }
              }
              break

            case PlatformType.KOKO:
              {
                try {
                  defaultPointerFile = await fs.readFileSync(
                    `./data/pointers/koko.ini`
                  )
                } catch (error) {
                  console.info(error)
                }
              }
              break

            case PlatformType.STKO:
              {
                try {
                  defaultPointerFile = await fs.readFileSync(
                    `./data/pointers/stko.ini`
                  )
                } catch (error) {
                  console.info(error)
                }
              }
              break
          }
        }
        break
    }

    if (defaultPointerFile) {
      console.info(`Pointer: List sended`)
      this.send(defaultPointerFile, defaultPointerFile.length)
    } else {
      console.info(`Pointer: Unable to send pointer due to technical problem`)
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
