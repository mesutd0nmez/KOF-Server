import PacketHeader from '../core/enums/packetHeader.js'
import Event from '../core/event.js'
import Jimp from 'jimp'
import fs from 'fs'

class Screenshot extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.SCREENSHOT,
      authorization: false,
      rateLimitOpts: {
        points: 8,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    try {
      const imageBuffer = packet.read()

      Jimp.read(imageBuffer.buffer)
        .then((image) => {
          image
            .getBufferAsync(Jimp.MIME_PNG)
            .then(async (image) => {
              const fileName =
                Date.now().toString(36) +
                Math.random().toString(36).substr(2, 5)

              await fs.writeFileSync(
                `./data/screenshots/${fileName}.png`,
                image
              )

              this.server.serverLogger.info(
                `Screenshot Saved: ${fileName}.png`,
                {
                  metadata: this.socket.metadata,
                }
              )
            })
            .catch((error) => {
              this.server.serverLogger.error(error, {
                metadata: this.socket.metadata,
              })
            })
        })
        .catch((error) => {
          this.server.serverLogger.error(error, {
            metadata: this.socket.metadata,
          })
        })
    } catch (error) {
      this.server.serverLogger.error(error, {
        metadata: this.socket.metadata,
      })
    }
  }
}

export default Screenshot
