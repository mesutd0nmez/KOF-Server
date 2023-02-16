import PacketHeader from '../core/enums/packetHeader.js'
import LoginType from '../core/enums/loginType.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import UserModel from '../models/user.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

class Login extends Event {
  constructor(socket) {
    super(socket, {
      header: PacketHeader.LOGIN,
      authorization: false,
    })
  }

  async recv(packet) {
    const type = packet.readUnsignedByte()

    let user = null
    let token = null
    switch (type) {
      case LoginType.GENERIC:
        {
          const email = packet.readString(true)
          const password = packet.readString(true)

          user = await UserModel.findOne({ email: email })

          if (user) {
            if (!(await bcrypt.compare(password, user.password))) {
              user = null
              console.info(`Login: ${email} - password does not match`)
            }
          } else {
            if (process.env.AUTO_REGISTRATION == 1) {
              console.info(
                `Login: ${email} - not found, auto registration in progress`
              )

              const hashedPassword = await bcrypt.hash(password, 10)

              await UserModel.create({
                email: email,
                password: hashedPassword,
              }).then((createdUser) => {
                user = createdUser
                console.info(`Login: ${createdUser.email} - created`)
              })
            } else {
              console.info(`Login: ${email} - not found`)
            }
          }
        }
        break
      case LoginType.TOKEN:
        try {
          token = packet.readString(true)
          const decoded = jwt.verify(token, process.env.TOKEN_KEY)
          user = await UserModel.findOne({ _id: decoded.user_id })

          if (!user) {
            console.info(`Login: There is no user with this token`)
          }
        } catch (err) {
          console.info(err)
          user = null
          console.info(`Login: Invalid token`)
        }
        break
    }

    if (user) {
      console.info(`Login: ${user.email} - logging in`)

      switch (type) {
        case LoginType.GENERIC: {
          console.info(`Login: ${user.email} - signing session token`)

          token = jwt.sign({ user_id: user._id }, process.env.TOKEN_KEY, {
            expiresIn: '365d',
          })

          console.info(
            `Login: ${user.email} - session token signed, sending to client`
          )
          this.socket.token = token
          return this.send(type, 1, token)
        }
        case LoginType.TOKEN: {
          console.info(
            `Login: ${user.email} - token validation success, user authorized`
          )
          this.socket.token = token
          return this.send(type, 1)
        }
      }
    }

    this.send(type, 0)
  }

  async send(type, status, token = '') {
    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)

    packet.writeUnsignedByte(type)
    packet.writeUnsignedByte(status)

    if (token != '') {
      packet.writeString(token, true)
    }

    this.socket.write(packet.raw)
  }
}

export default Login
