import PacketHeader from '../core/enums/packetHeader.js'
import ConfigurationRequestType from '../core/enums/configurationRequestType.js'
import AppType from '../core/enums/appType.js'
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
        points: 5,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    const type = packet.readUnsignedByte()
    const appType = packet.readUnsignedByte()

    switch (appType) {
      case AppType.BOT:
        {
          switch (type) {
            case ConfigurationRequestType.LOAD:
              {
                const platform = packet.readUnsignedByte()
                const serverIndex = packet.readUnsignedByte()
                const characterName = packet.readString(true)

                let configurationCollection = await ConfigurationModel.findOne({
                  userId: this.options.userId,
                  appType: appType,
                  platform: platform,
                  server: serverIndex,
                  name: characterName,
                })

                if (!configurationCollection) {
                  await ConfigurationModel.create({
                    userId: this.options.userId,
                    appType: appType,
                    platform: platform,
                    server: serverIndex,
                    name: characterName,
                    configuration: null,
                  }).then((createdConfiguration) => {
                    configurationCollection = createdConfiguration
                    console.info(
                      `Configuration: User default configuration created`
                    )
                  })
                } else {
                  console.info(`Configuration: User configuration loaded`)
                }

                this.send(type, configurationCollection.configuration)
              }
              break
            case ConfigurationRequestType.SAVE:
              {
                const platform = packet.readUnsignedByte()
                const serverIndex = packet.readUnsignedByte()
                const characterName = packet.readString(true)
                const configurationData = packet.readString(true)

                await ConfigurationModel.updateOne(
                  {
                    userId: this.options.userId,
                    appType: appType,
                    platform: platform,
                    server: serverIndex,
                    name: characterName,
                  },
                  { configuration: configurationData },
                  { upsert: true }
                )

                console.info(`Configuration: User configuration saved`)
              }
              break
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
      packet.writeString(configuration, true)
    }

    this.socket.emit('send', packet.raw, true)
  }
}

export default Configuration
