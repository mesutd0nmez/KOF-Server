import PacketHeader from '../core/enums/packetHeader.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import fs from 'fs'
import PlatformType from '../core/enums/platformType.js'
import InjectionRequestType from '../core/enums/injectionRequestType.js'

class Injection extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.INJECTION,
      authorization: true,
      rateLimitOpts: {
        points: 5,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    const type = packet.readUnsignedByte()

    switch (type) {
      case InjectionRequestType.REQUEST:
        {
          const platform = packet.readUnsignedByte()
          const processId = packet.readUnsignedInt()

          let defaultLibrary = null

          switch (platform) {
            case PlatformType.USKO:
              {
                try {
                  defaultLibrary = await fs.readFileSync(
                    `./data/libraries/KOF.dll`
                  )
                } catch (error) {
                  console.info(error)
                }
              }
              break

            case PlatformType.CNKO:
              {
                try {
                  defaultLibrary = await fs.readFileSync(
                    `./data/libraries/KOF.dll`
                  )
                } catch (error) {
                  console.info(error)
                }
              }
              break
          }

          if (defaultLibrary) {
            console.info(`Injection: Library to be injected has been sent`)
            this.send(processId, defaultLibrary, defaultLibrary.length)
          } else {
            console.info(
              `Injection: Unable to injection due to technical problem`
            )
          }
        }
        break
      case InjectionRequestType.REPORT:
        {
          const started = packet.readUnsignedByte()
          const processId = packet.readUnsignedInt()

          if (started != 0) {
            console.info(`Injection: pid(${processId}) completed`)
          } else {
            console.info(`Injection: pid(${processId}) failed`)
          }
        }
        break
    }
  }

  async send(processId, buffer, bufferLength) {
    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)

    packet.writeUnsignedInt(processId)
    packet.writeUnsignedInt(bufferLength)
    packet.write(buffer)

    this.socket.emit('send', packet.raw, true)
  }
}

export default Injection
