import PacketHeader from '../core/enums/packetHeader.js'
import Event from '../core/event.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import axios from 'axios'

class Captcha extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.CAPTCHA,
      authorization: true,
      rateLimitOpts: {
        points: 1000,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    const imageBase64 = packet.readString(true)

    axios
      .post(
        process.env.TRUECAPTCHA_API_URL,
        {
          userid: process.env.TRUECAPTCHA_API_USER,
          apikey: process.env.TRUECAPTCHA_API_KEY,
          data: imageBase64,
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
