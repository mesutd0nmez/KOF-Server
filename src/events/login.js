import PacketHeader from '../core/enums/packetHeader.js'
import LoginType from '../core/enums/loginType.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import UserModel from '../models/user.js'
import ClientModel from '../models/client.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import validator from 'validator'
import SessionModel from '../models/session.js'
import VersionModel from '../models/version.js'

class Login extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.LOGIN,
      authorization: false,
      rateLimitOpts: {
        points: 1000,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    const type = packet.readUnsignedByte()

    let token = null
    let clientHardwareInfo = {}
    let socket = this.socket
    let statusMessage = 'Bilinmeyen Hata'

    switch (type) {
      case LoginType.GENERIC:
        {
          const email = packet.readString(true)
          const password = packet.readString(true)

          if (!email || !password) return

          if (process.env.NODE_ENV !== 'development') {
            if (email === 'me@kofbot.com') return
          }

          if (!validator.isEmail(email)) {
            console.info(`Login: ${email} - is not valid email`)
            return
          }

          clientHardwareInfo.systemName = packet.readString(true)
          clientHardwareInfo.uuid = packet.readString(true)
          clientHardwareInfo.systemSerialNumber = packet.readString(true)
          clientHardwareInfo.gpu = packet.readString(true)

          socket.user = await UserModel.findOne({ email: email })

          if (socket.user) {
            if (!(await bcrypt.compare(password, socket.user.password))) {
              socket.user = null
              console.info(`Login: ${email} - password does not match`)
              statusMessage = 'Aktivasyon bilgileri hatali'
            }
          } else {
            if (process.env.AUTO_REGISTRATION == 1) {
              console.info(
                `Login: ${email} - not found, auto registration in progress`
              )

              const hashedPassword = await bcrypt.hash(password, 10)

              const today = new Date()
              const futureDate = new Date()
              futureDate.setDate(today.getDate() + 3)

              await UserModel.create({
                email: email,
                password: hashedPassword,
                subscriptionEndAt: futureDate,
              }).then((createdUser) => {
                socket.user = createdUser
                console.info(`Login: ${createdUser.email} - created`)
              })
            } else {
              console.info(`Login: ${email} - not found`)
              statusMessage = 'Aktivasyon basarisiz'
            }
          }
        }
        break
      case LoginType.TOKEN:
        try {
          token = packet.readString(true)

          if (!token) return

          clientHardwareInfo.systemName = packet.readString(true)
          clientHardwareInfo.uuid = packet.readString(true)
          clientHardwareInfo.systemSerialNumber = packet.readString(true)
          clientHardwareInfo.gpu = packet.readString(true)

          const decoded = jwt.verify(token, process.env.TOKEN_KEY)
          socket.user = await UserModel.findOne({ _id: decoded.userId })

          if (!socket.user) {
            console.info(`Login: There is no user with this token`)
            statusMessage = 'Aktivasyon basarisiz'
          }
        } catch (err) {
          console.info(err)
          socket.user = null
          console.info(`Login: Invalid token`)
          statusMessage = 'Aktivasyon basarisiz'
        }
        break
    }

    if (socket.user) {
      console.info(`Login: ${socket.user.email} - logging in`)

      socket.user.updatedAt = Date.now()
      socket.user.save()

      const today = new Date()
      const subscriptionEndAt = new Date(socket.user.subscriptionEndAt)

      if (today > subscriptionEndAt) {
        console.info(
          `Login: ${socket.user.email} - Account has subscription time end`
        )

        return this.send({
          type: type,
          status: 0,
          message: 'Abonelik sureniz doldu',
        })
      }

      let findedClient = await ClientModel.findOne({
        systemName: clientHardwareInfo.systemName,
        uuid: clientHardwareInfo.uuid,
        systemSerialNumber: clientHardwareInfo.systemSerialNumber,
        gpu: clientHardwareInfo.gpu,
      })

      if (!findedClient) {
        if (socket.user.credit == 0) {
          console.info(
            `Login: ${socket.user.email} - Account has no credit limit for create new client`
          )

          return this.send({
            type: type,
            status: 0,
            message: 'Aktivasyon icin yeterli kredi yok',
          })
        }

        await ClientModel.create({
          userId: socket.user._id,
          systemName: clientHardwareInfo.systemName,
          uuid: clientHardwareInfo.uuid,
          systemSerialNumber: clientHardwareInfo.systemSerialNumber,
          gpu: clientHardwareInfo.gpu,
          ip: socket.remoteAddress,
        }).then(async (client) => {
          socket.client = client

          socket.data.clientId = socket.client.id
          await socket.data.save()

          if (socket.user.credit != -1) {
            socket.user.credit--
            socket.user.save()
          }

          console.info(
            `Login: ${socket.user.email} - client ${client._id} created`
          )
        })
      } else {
        if (!socket.user._id.equals(socket.user.id)) {
          console.info(
            `Login: ${socket.user.email} - client ${findedClient._id} registered another user (${findedClient.userId} != ${socket.user._id}), socket destroying`
          )

          return this.send({
            type: type,
            status: 0,
            message: 'Daha once aktivasyon yapildi',
          })
        }

        findedClient.ip = socket.remoteAddress
        findedClient.updatedAt = Date.now()

        await findedClient.save()

        socket.client = findedClient

        console.info(
          `Login: ${socket.user.email} - client ${socket.client._id}`
        )
      }

      this.socket.data = await SessionModel.findOneAndUpdate(
        { _id: this.socket.data.id },
        {
          $set: {
            userId: socket.user.id,
            clientId: socket.client.id,
          },
        },
        { new: true }
      )

      switch (type) {
        case LoginType.GENERIC: {
          console.info(`Login: ${socket.user.email} - signing session token`)

          token = jwt.sign({ userId: socket.user._id }, process.env.TOKEN_KEY, {
            expiresIn: '365d',
          })

          console.info(
            `Login: ${socket.user.email} - session token signed, sending to client`
          )

          this.socket.token = token

          let versionInfo = await VersionModel.findOne({
            status: 1,
            crc: this.socket.fileCRC,
          }).sort({ updatedAt: -1 })

          if (versionInfo) {
            return this.send({ type: type, status: 1, token: token })
          } else {
            return this.send({ type: type, status: 2, token: token })
          }
        }

        case LoginType.TOKEN: {
          console.info(
            `Login: ${socket.user.email} - token validation success, user authorized`
          )

          this.socket.token = token

          let versionInfo = await VersionModel.findOne({
            status: 1,
            crc: this.socket.fileCRC,
          }).sort({ updatedAt: -1 })

          if (versionInfo) {
            return this.send({ type: type, status: 1, token: token })
          } else {
            return this.send({ type: type, status: 2, token: token })
          }
        }
      }
    }

    this.send({ type: type, status: 0, message: statusMessage })
  }

  async send({
    type = LoginType.GENERIC,
    status = 0,
    token = '',
    message = '',
  }) {
    const packet = new ByteBuffer()

    packet.writeUnsignedByte(this.options.header)

    packet.writeUnsignedByte(type)
    packet.writeUnsignedByte(status)

    if (status == 0) {
      packet.writeString(message, true)
    }

    if (status == 1) {
      if (token != '') {
        packet.writeString(token, true)
      }
    }

    this.socket.emit('send', packet.raw)
  }
}

export default Login
