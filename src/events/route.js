import PacketHeader from '../core/enums/packetHeader.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import fs from 'fs'

class Route extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.ROUTE,
      authorization: true,
      rateLimitOpts: {
        points: 8,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    try {
      const userRoutePath = `./data/routes/${this.socket.metadata.userId}`

      const type = packet.readUnsignedByte()

      switch (type) {
        case 0: //Load
          {
            await fs.access(userRoutePath, fs.constants.F_OK, async (err) => {
              if (err) {
                await fs.mkdir(userRoutePath, (err) => {})
              }
            })

            const files = await fs.readdirSync(userRoutePath)
            const routeFiles = await files.filter((file) =>
              file.endsWith('.json')
            )

            const sendPacket = new ByteBuffer()

            sendPacket.writeUnsignedByte(this.options.header)
            sendPacket.writeUnsignedInt(routeFiles.length) // Route File Count

            await routeFiles.map(async (routeFile) => {
              const content = await fs.readFileSync(
                userRoutePath + '/' + routeFile
              )

              sendPacket.writeUnsignedInt(content.length) // Route File Length
              sendPacket.write(content) // Route File Buffer
            })

            this.socket.emit('send', sendPacket.raw, true)
          }
          break

        case 1: //Save
          {
            const fileName = packet.readString(true)
            const fileLength = packet.readUnsignedInt()
            const fileData = packet.read(fileLength)

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
          }
          break

        case 2: //Delete
          {
            const fileName = packet.readString(true)

            await fs.unlink(userRoutePath + '/' + fileName)
          }
          break
      }
    } catch (error) {
      this.server.serverLogger.error(error, {
        metadata: this.socket.metadata,
      })
    }
  }
}

export default Route
