import PacketHeader from '../core/enums/packetHeader.js'
import ConfigurationRequestType from '../core/enums/configurationRequestType.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import ConfigurationModel from '../models/configuration.js'
import SessionModel from '../models/session.js'
import fs from 'fs'
import winston from 'winston'
class Configuration extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.CONFIGURATION,
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
      case ConfigurationRequestType.LOAD:
        {
          const platform = packet.readUnsignedByte()
          const serverIndex = packet.readUnsignedByte()
          const characterName = packet.readString(true)

          this.socket.data = await SessionModel.findOneAndUpdate(
            { _id: this.socket.data.id },
            {
              $set: {
                platform: platform,
                characterServerId: serverIndex + 1,
                characterName: characterName,
              },
            },
            { new: true }
          )

          let configurationCollection = await ConfigurationModel.findOne({
            userId: this.options.userId,
            platform: platform,
            server: serverIndex + 1,
            name: characterName,
          })

          let configurationData = ''

          if (!configurationCollection) {
            await ConfigurationModel.create({
              userId: this.options.userId,
              platform: platform,
              server: serverIndex + 1,
              name: characterName,
            }).then(async (createdConfiguration) => {
              configurationCollection = createdConfiguration

              await fs.writeFileSync(
                `./data/configurations/${configurationCollection.id}.ini`,
                configurationData
              )

              winston.info(
                `Configuration: ${characterName} - User default configuration created`,
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
            })
          } else {
            try {
              if (
                fs.existsSync(
                  `./data/configurations/${configurationCollection.id}.ini`
                )
              ) {
                configurationData = await fs.readFileSync(
                  `./data/configurations/${configurationCollection.id}.ini`
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

            winston.info(
              `Configuration: ${characterName} - User configuration loaded`,
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

          this.send(type, configurationData)
        }
        break
      case ConfigurationRequestType.SAVE:
        {
          const platform = packet.readUnsignedByte()
          const serverIndex = packet.readUnsignedByte()
          const characterName = packet.readString(true)
          const configurationLength = packet.readUnsignedInt()
          const configurationData = packet.read(configurationLength)

          this.socket.data = await SessionModel.findOneAndUpdate(
            { _id: this.socket.data.id },
            {
              $set: {
                platform: platform,
                characterServerId: serverIndex + 1,
                characterName: characterName,
              },
            },
            { new: true }
          )

          let configurationCollection = await ConfigurationModel.findOne({
            userId: this.options.userId,
            platform: platform,
            server: serverIndex + 1,
            name: characterName,
          })

          if (!configurationCollection) {
            await ConfigurationModel.create({
              userId: this.options.userId,
              platform: platform,
              server: serverIndex + 1,
              name: characterName,
            }).then(async (createdConfiguration) => {
              configurationCollection = createdConfiguration
              winston.info(
                `Configuration: ${characterName} - User default configuration created`,
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
            })
          }

          await fs.writeFileSync(
            `./data/configurations/${configurationCollection.id}.ini`,
            configurationData.raw
          )

          if (process.env.NODE_ENV == 'development') {
            winston.info(
              `Configuration: ${characterName} - User configuration saved`,
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
    }
  }

  async send(type, configuration) {
    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)
    packet.writeUnsignedByte(type)

    if (configuration) {
      packet.writeUnsignedInt(configuration.length)
      packet.write(configuration)
    }

    this.socket.emit('send', packet.raw)
  }
}

export default Configuration
