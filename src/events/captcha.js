import PacketHeader from '../core/enums/packetHeader.js'
import Event from '../core/event.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import axios from 'axios'
import sharp from 'sharp'
import winston from 'winston'

class Captcha extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.CAPTCHA,
      authorization: true,
      rateLimitOpts: {
        points: 50,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    const imageBufferLength = packet.readUnsignedInt()
    const imageOriginalLength = packet.readUnsignedInt()
    const imageOriginalBuffer = packet.read(imageBufferLength - 8)

    sharp(imageOriginalBuffer.raw, {
      raw: { width: 256, height: 64, channels: 3 },
    })
      .toFormat('png')
      .flip(true) //IDK
      .toBuffer()
      .then((jpegBuffer) => {
        axios
          .post(
            process.env.TRUECAPTCHA_API_URL,
            {
              userid: process.env.TRUECAPTCHA_API_USER,
              apikey: process.env.TRUECAPTCHA_API_KEY,
              data: jpegBuffer.toString('base64'),
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
              return this.send(0, '0000')
            }
          })
          .catch((error) => {
            winston.error(error)
            return this.send(0, '0000')
          })
      })
      .catch((error) => {
        winston.error(error)
        return this.send(0, '0000')
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
