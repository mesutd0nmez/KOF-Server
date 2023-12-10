import PacketHeader from '../core/enums/packetHeader.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import fs from 'fs'
import PlatformType from '../core/enums/platformType.js'
import InjectionRequestType from '../core/enums/injectionRequestType.js'
import winston from 'winston'
class Injection extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.INJECTION,
      authorization: true,
      rateLimitOpts: {
        points: 16,
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
            case PlatformType.CNKO:
            case PlatformType.USKO:
            case PlatformType.KOKO:
            case PlatformType.STKO:
              {
                try {
                  defaultLibrary = await fs.readFileSync(
                    `./data/libraries/Adapter.dll`
                  )
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
              break
          }

          if (defaultLibrary) {
            winston.info(`Injection: Library to be injected has been sent`, {
              metadata: {
                user: this.socket.user ? this.socket.user.id : null,
                client: this.socket.client ? this.socket.client.id : null,
                processId: this.socket.processId,
                crc: this.socket.fileCRC,
                ip: this.socket.remoteAddress,
              },
            })
            this.send(processId, defaultLibrary, defaultLibrary.length)
          } else {
            winston.info(
              `Injection: Unable to injection due to technical problem`,
              {
                metadata: {
                  user: this.socket.user ? this.socket.user.id : null,
                  client: this.socket.client ? this.socket.client.id : null,
                  processId: this.socket.processId,
                  crc: this.socket.fileCRC,
                  ip: this.socket.remoteAddress,
                },
              }
            )
          }
        }
        break
      case InjectionRequestType.REPORT:
        {
          const started = packet.readUnsignedByte()
          const processId = packet.readUnsignedInt()

          if (started != 0) {
            winston.info(`Injection: pid(${processId}) completed`, {
              metadata: {
                user: this.socket.user ? this.socket.user.id : null,
                client: this.socket.client ? this.socket.client.id : null,
                processId: this.socket.processId,
                crc: this.socket.fileCRC,
                ip: this.socket.remoteAddress,
              },
            })
          } else {
            winston.info(`Injection: pid(${processId}) failed`, {
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
        break
    }
  }

  async send(processId, buffer, bufferLength) {
    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)

    packet.writeUnsignedInt(processId)
    packet.writeUnsignedInt(bufferLength)
    packet.write(buffer)

    this.socket.emit('send', packet.raw)
  }
}

export default Injection
