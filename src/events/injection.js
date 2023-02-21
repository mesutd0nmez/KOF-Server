import PacketHeader from '../core/enums/packetHeader.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import fs from 'fs'
import PlatformType from '../core/enums/platformType.js'
import InjectionRequestType from '../core/enums/injectionRequestType.js'

class Injection extends Event {
  constructor(socket) {
    super(socket, {
      header: PacketHeader.INJECTION,
      authorization: true,
    })
  }

  async recv(packet) {
    const type = packet.readUnsignedByte()

    switch (type) {
      case InjectionRequestType.REQUEST:
        {
          const platform = packet.readUnsignedByte()

          let defaultLibrary = null

          switch (platform) {
            case PlatformType.USKO:
              {
                try {
                  defaultLibrary = await fs.readFileSync(
                    `./data/libraries/usko.dll`
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
                    `./data/libraries/cnko.dll`
                  )
                } catch (error) {
                  console.info(error)
                }
              }
              break
          }

          if (defaultLibrary) {
            console.info(`Injection: Library to be injected has been sent`)
            this.send(defaultLibrary, defaultLibrary.length)
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
          const accountIndex = packet.readUnsignedShort()
          const processId = packet.readUnsignedInt()

          console.info(`${started} - ${accountIndex} - ${processId}`)
        }
        break
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
