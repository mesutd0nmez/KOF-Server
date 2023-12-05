import PacketHeader from '../core/enums/packetHeader.js'
import ConfigurationRequestType from '../core/enums/configurationRequestType.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import ConfigurationModel from '../models/configuration.js'
import SessionModel from '../models/session.js'

class Configuration extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.CONFIGURATION,
      authorization: true,
      rateLimitOpts: {
        points: 1000,
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

          if (!configurationCollection) {
            await ConfigurationModel.create({
              userId: this.options.userId,
              platform: platform,
              server: serverIndex + 1,
              name: characterName,
              configuration: null,
            }).then((createdConfiguration) => {
              configurationCollection = createdConfiguration
              console.info(`Configuration: User default configuration created`)
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

          await ConfigurationModel.updateOne(
            {
              userId: this.options.userId,
              platform: platform,
              server: serverIndex + 1,
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

  async send(type, configuration) {
    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)

    packet.writeUnsignedByte(type)

    if (configuration) {
      packet.writeString(configuration, true)
    }

    this.socket.emit('send', packet.raw)
  }
}

export default Configuration
