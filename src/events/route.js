import PacketHeader from '../core/enums/packetHeader.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import fs from 'fs'
import path from 'path'
import winston from 'winston'

class Route extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.ROUTE,
      authorization: true,
      rateLimitOpts: {
        points: 16,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    try {
      if (!this.socket.user) {
        return
      }

      const userRoutePath = `./data/routes/${this.socket.user.id}`

      const type = packet.readUnsignedByte()

      switch (type) {
        case 0: //Load
          {
            try {
              const files = await fs.readdirSync(userRoutePath)
              const routeFiles = await files.filter((file) =>
                file.endsWith('.json')
              )

              const sendPacket = new ByteBuffer()

              sendPacket.writeUnsignedByte(this.options.header)
              sendPacket.writeUnsignedInt(routeFiles.length) // Route File Count

              await routeFiles.map(async (routeFile) => {
                try {
                  const content = await fs.readFileSync(
                    userRoutePath + '/' + routeFile
                  )

                  sendPacket.writeUnsignedInt(content.length) // Route File Length
                  sendPacket.write(content) // Route File Buffer
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
              })

              this.socket.emit('send', sendPacket.raw)
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

        case 1: //Save
          {
            const fileName = packet.readString(true)
            const fileLength = packet.readUnsignedInt()
            const fileData = packet.read(fileLength)

            try {
              await fs.access(userRoutePath, fs.constants.F_OK, async (err) => {
                if (err) {
                  await fs.mkdir(userRoutePath, (err) => {})
                }
              })
              var rawFileData = JSON.stringify(fileData.raw)
              if (JSON.parse(rawFileData)) {
                await fs.writeFileSync(
                  userRoutePath + '/' + fileName + '.json',
                  fileData.raw
                )
              }
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

        case 2: //Delete
          {
            const fileName = packet.readString(true)

            try {
              await fs.unlink(userRoutePath + '/' + fileName)
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
}

export default Route
