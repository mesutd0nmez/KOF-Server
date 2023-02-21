import PacketHeader from '../core/enums/packetHeader.js'
import LoginType from '../core/enums/loginType.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import UserModel from '../models/user.js'
import ClientModel from '../models/client.js'
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

    let token = null
    let clientHardwareInfo = {}
    let socket = this.socket

    switch (type) {
      case LoginType.GENERIC:
        {
          const email = packet.readString(true)
          const password = packet.readString(true)

          clientHardwareInfo.systemName = packet.readString(true)
          clientHardwareInfo.serialNumber = packet.readString(true)
          clientHardwareInfo.processorId = packet.readString(true)
          clientHardwareInfo.computerHardwareId = packet.readString(true)

          socket.user = await UserModel.findOne({ email: email })

          if (socket.user) {
            if (!(await bcrypt.compare(password, socket.user.password))) {
              socket.user = null
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
                socket.user = createdUser
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

          clientHardwareInfo.systemName = packet.readString(true)
          clientHardwareInfo.serialNumber = packet.readString(true)
          clientHardwareInfo.processorId = packet.readString(true)
          clientHardwareInfo.computerHardwareId = packet.readString(true)

          const decoded = jwt.verify(token, process.env.TOKEN_KEY)
          socket.user = await UserModel.findOne({ _id: decoded.userId })

          if (!socket.user) {
            console.info(`Login: There is no user with this token`)
          }
        } catch (err) {
          console.info(err)
          socket.user = null
          console.info(`Login: Invalid token`)
        }
        break
    }

    if (socket.user) {
      console.info(`Login: ${socket.user.email} - logging in`)

      const findedClient = await ClientModel.findOne({
        systemName: clientHardwareInfo.systemName,
        serialNumber: clientHardwareInfo.serialNumber,
        processorId: clientHardwareInfo.processorId,
        computerHardwareId: clientHardwareInfo.computerHardwareId,
      })

      if (!findedClient) {
        await ClientModel.create({
          userId: socket.user._id,
          systemName: clientHardwareInfo.systemName,
          serialNumber: clientHardwareInfo.serialNumber,
          processorId: clientHardwareInfo.processorId,
          computerHardwareId: clientHardwareInfo.computerHardwareId,
          ip: socket.remoteAddress,
        }).then((client) => {
          socket.client = client
          console.info(
            `Login: ${socket.user.email} - client ${client._id} created`
          )
        })
      } else {
        if (!socket.user._id.equals(findedClient.userId)) {
          console.info(
            `Login: ${socket.user.email} - client ${findedClient._id} registered another user (${findedClient.userId} != ${socket.user._id}), socket destroying`
          )

          return socket.destroy()
        }

        findedClient.ip = socket.remoteAddress

        await findedClient.save()

        socket.client = findedClient

        console.info(
          `Login: ${socket.user.email} - client ${socket.client._id}`
        )
      }

      switch (type) {
        case LoginType.GENERIC: {
          console.info(clientHardwareInfo)
          console.info(`Login: ${socket.user.email} - signing session token`)

          token = jwt.sign({ userId: socket.user._id }, process.env.TOKEN_KEY, {
            expiresIn: '365d',
          })

          console.info(
            `Login: ${socket.user.email} - session token signed, sending to client`
          )
          this.socket.token = token
          return this.send(type, 1, token)
        }

        case LoginType.TOKEN: {
          console.info(
            `Login: ${socket.user.email} - token validation success, user authorized`
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

    this.socket.emit('send', packet.raw)
  }
}

export default Login
