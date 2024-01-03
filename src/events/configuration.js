import PacketHeader from '../core/enums/packetHeader.js'
import ConfigurationRequestType from '../core/enums/configurationRequestType.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import ConfigurationModel from '../models/configuration.js'
import fs from 'fs'

class Configuration extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.CONFIGURATION,
      authorization: true,
      rateLimitOpts: {
        points: 8,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    try {
      const type = packet.readUnsignedByte()

      switch (type) {
        case ConfigurationRequestType.LOAD:
          {
            const platform = packet.readUnsignedByte()
            const serverIndex = packet.readUnsignedByte()
            const characterName = packet.readString(true)

            let configurationCollection = await ConfigurationModel.findOne({
              userId: this.socket.metadata.userId,
              platform: platform,
              server: serverIndex + 1,
              name: characterName,
            })

            let configurationData = ''

            if (!configurationCollection) {
              await ConfigurationModel.create({
                userId: this.socket.metadata.userId,
                platform: platform,
                server: serverIndex + 1,
                name: characterName,
              }).then(async (createdConfiguration) => {
                configurationCollection = createdConfiguration

                await fs.writeFileSync(
                  `./data/configurations/${configurationCollection.id}.ini`,
                  configurationData
                )

                this.server.serverLogger.info(
                  `Configuration: ${characterName} - User default configuration created`,
                  {
                    metadata: this.socket.metadata,
                  }
                )
              })
            } else {
              if (
                fs.existsSync(
                  `./data/configurations/${configurationCollection.id}.ini`
                )
              ) {
                configurationData = await fs.readFileSync(
                  `./data/configurations/${configurationCollection.id}.ini`
                )
              }

              this.server.serverLogger.info(
                `Configuration: ${characterName} - User configuration loaded`,
                {
                  metadata: this.socket.metadata,
                }
              )
            }

            const sendPacket = new ByteBuffer()

            sendPacket.writeUnsignedByte(this.options.header)
            sendPacket.writeUnsignedByte(type)

            sendPacket.writeUnsignedInt(configurationData.length)
            sendPacket.write(configurationData)

            this.socket.emit('send', sendPacket.raw, true)
          }
          break
        case ConfigurationRequestType.SAVE:
          {
            const platform = packet.readUnsignedByte()
            const serverIndex = packet.readUnsignedByte()
            const characterName = packet.readString(true)
            const configurationLength = packet.readUnsignedInt()
            const configurationData = packet.read(configurationLength)

            let configurationCollection = await ConfigurationModel.findOne({
              userId: this.socket.metadata.userId,
              platform: platform,
              server: serverIndex + 1,
              name: characterName,
            })

            if (!configurationCollection) {
              await ConfigurationModel.create({
                userId: this.socket.metadata.userId,
                platform: platform,
                server: serverIndex + 1,
                name: characterName,
              }).then(async (createdConfiguration) => {
                configurationCollection = createdConfiguration
                this.server.serverLogger.info(
                  `Configuration: ${characterName} - User default configuration created`,
                  {
                    metadata: this.socket.metadata,
                  }
                )
              })
            }

            await fs.writeFileSync(
              `./data/configurations/${configurationCollection.id}.ini`,
              configurationData.raw
            )

            if (process.env.NODE_ENV == 'development') {
              this.server.serverLogger.info(
                `Configuration: ${characterName} - User configuration saved`,
                {
                  metadata: this.socket.metadata,
                }
              )
            }
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

export default Configuration
