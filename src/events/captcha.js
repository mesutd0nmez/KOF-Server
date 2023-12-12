import PacketHeader from '../core/enums/packetHeader.js'
import Event from '../core/event.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import createBitmapFile from '../utils/bitmap.js'
import axios from 'axios'
import Jimp from 'jimp'
import winston from 'winston'

class Captcha extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.CAPTCHA,
      authorization: true,
      rateLimitOpts: {
        points: 16,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    const imageBufferLength = packet.readUnsignedInt()
    const imageOriginalBuffer = packet.read()

    const captchaImage = await createBitmapFile({
      imageData: imageOriginalBuffer.toArray(),
    })

    Jimp.read(captchaImage)
      .then((image) => {
        image
          .getBufferAsync(Jimp.MIME_PNG)
          .then((image) => {
            axios
              .post(
                process.env.TRUECAPTCHA_API_URL,
                {
                  userid: process.env.TRUECAPTCHA_API_USER,
                  apikey: process.env.TRUECAPTCHA_API_KEY,
                  data: image.toString('base64'),
                  len_str: 4,
                  numeric: false,
                  case: 'mixed',
                },
                {
                  headers: {
                    'Content-Type': 'application/json',
                  },
                }
              )
              .then((response) => {
                if (response.data && response.data.success) {
                  return this.send(1, response.data.result)
                } else {
                  winston.error('Captcha API invalid response', {
                    metadata: response,
                  })
                }
              })
              .catch((error) => {
                winston.error(error)
              })
          })
          .catch((err) => {
            winston.error(err)
          })
      })
      .catch((error) => {
        winston.error(error)
      })
  }

  async send(status, result) {
    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)
    packet.writeUnsignedByte(status)
    packet.writeString(result, true)

    this.socket.emit('send', packet.raw)
  }
}

export default Captcha
