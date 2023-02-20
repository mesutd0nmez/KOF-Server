import PacketHeader from '../core/enums/packetHeader.js'
import ConfigurationRequestType from '../core/enums/configurationRequestType.js'
import AppType from '../core/enums/appType.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import ConfigurationModel from '../models/configuration.js'
import fs from 'fs'

class Configuration extends Event {
  constructor(socket) {
    super(socket, {
      header: PacketHeader.CONFIGURATION,
      authorization: true,
    })
  }

  async recv(packet) {
    const type = packet.readUnsignedByte()
    const appType = packet.readUnsignedByte()

    switch (type) {
      case ConfigurationRequestType.LOAD:
        {
          let configurationCollection = await ConfigurationModel.findOne({
            user_id: this.options.user_id,
            app_type: appType,
          })

          if (!configurationCollection) {
            switch (appType) {
              case AppType.LOADER:
                {
                  const defaultConfigRawData = fs.readFileSync(
                    './data/configs/loader.json'
                  )

                  const defaultConfig = JSON.parse(defaultConfigRawData)

                  await ConfigurationModel.create({
                    user_id: this.options.user_id,
                    app_type: appType,
                    configuration: defaultConfig,
                  }).then((createdConfiguration) => {
                    configurationCollection = createdConfiguration
                    console.info(
                      `Configuration: User default configuration created`
                    )
                  })
                }
                break
            }
          }

          if (configurationCollection) {
            console.info(`Configuration: User configuration loaded`)
            this.send(
              type,
              JSON.stringify(configurationCollection.configuration)
            )
          } else {
            console.info(
              `Configuration: Unable to load due to technical problem`
            )
          }
        }
        break
      case ConfigurationRequestType.SAVE:
        {
          const configurationRawData = packet.readString(true)

          let configurationCollection = await ConfigurationModel.findOne({
            user_id: this.options.user_id,
            app_type: appType,
          })

          if (configurationCollection) {
            const configuration = JSON.parse(configurationRawData)

            configurationCollection.configuration = configuration
            configurationCollection.save()

            console.info(`Configuration: User configuration saved`)
          } else {
            console.info(
              `Configuration: Save failed for user not found, connection destroying`
            )
            this.socket.destroy()
          }
        }
        break
    }
  }

  async send(type, configuration) {
    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)

    packet.writeUnsignedByte(type)

    switch (type) {
      case ConfigurationRequestType.LOAD:
        {
          packet.writeString(configuration, true)
        }
        break
    }

    this.socket.emit('send', packet.raw)
  }
}

export default Configuration
