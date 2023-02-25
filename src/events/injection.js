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
          this.socket.accountIndex = packet.readInt()

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
          const processId = packet.readUnsignedInt()

          if (started != 0) {
            this.server.injections.push({
              userId: this.socket.user._id,
              clientId: this.socket.client._id,
              accountIndex: this.socket.accountIndex,
              processId: processId,
              injectionTime: Math.floor(Date.now() / 1000),
            })

            console.info(`Injection: pid(${processId}) completed`)
          } else {
            console.info(`Injection: pid(${processId}) failed`)
          }
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
