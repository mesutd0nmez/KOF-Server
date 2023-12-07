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
import winston from 'winston'

class Login extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.LOGIN,
      authorization: false,
      rateLimitOpts: {
        points: 50,
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
            winston.warn(`Login: ${email} - is not valid email`, {
              metadata: {
                user: socket.user ? socket.user.id : null,
                client: socket.client ? socket.client.id : null,
                processId: socket.processId,
                crc: socket.fileCRC,
                ip: socket.remoteAddress,
              },
            })
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
              winston.warn(`Login: ${email} - password does not match`, {
                metadata: {
                  user: socket.user ? socket.user.id : null,
                  client: socket.client ? socket.client.id : null,
                  processId: socket.processId,
                  crc: socket.fileCRC,
                  ip: socket.remoteAddress,
                },
              })
              statusMessage = 'Aktivasyon bilgileri hatali'
            }
          } else {
            if (process.env.AUTO_REGISTRATION == 1) {
              winston.warn(
                `Login: ${email} - not found, auto registration in progress`,
                {
                  metadata: {
                    user: socket.user ? socket.user.id : null,
                    client: socket.client ? socket.client.id : null,
                    processId: socket.processId,
                    crc: socket.fileCRC,
                    ip: socket.remoteAddress,
                  },
                }
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
                winston.info(`Login: ${createdUser.email} - created`, {
                  metadata: {
                    user: socket.user ? socket.user.id : null,
                    client: socket.client ? socket.client.id : null,
                    processId: socket.processId,
                    crc: socket.fileCRC,
                    ip: socket.remoteAddress,
                  },
                })
              })
            } else {
              winston.warn(`Login: ${email} - not found`, {
                metadata: {
                  user: socket.user ? socket.user.id : null,
                  client: socket.client ? socket.client.id : null,
                  processId: socket.processId,
                  crc: socket.fileCRC,
                  ip: socket.remoteAddress,
                },
              })
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
            winston.warn(`Login: There is no user with this token`, {
              metadata: {
                user: socket.user ? socket.user.id : null,
                client: socket.client ? socket.client.id : null,
                processId: socket.processId,
                crc: socket.fileCRC,
                ip: socket.remoteAddress,
              },
            })
            statusMessage = 'Aktivasyon basarisiz'
          }
        } catch (err) {
          winston.error(err, {
            metadata: {
              user: socket.user ? socket.user.id : null,
              client: socket.client ? socket.client.id : null,
              processId: socket.processId,
              crc: socket.fileCRC,
              ip: socket.remoteAddress,
            },
          })
          socket.user = null
          statusMessage = 'Aktivasyon basarisiz'
        }
        break
    }

    if (socket.user) {
      winston.info(`Login: ${socket.user.email} - logging in`, {
        metadata: {
          user: socket.user ? socket.user.id : null,
          client: socket.client ? socket.client.id : null,
          processId: socket.processId,
          crc: socket.fileCRC,
          ip: socket.remoteAddress,
        },
      })

      socket.user.updatedAt = Date.now()
      socket.user.save()

      const today = new Date()
      const subscriptionEndAt = new Date(socket.user.subscriptionEndAt)

      if (today > subscriptionEndAt) {
        winston.warn(
          `Login: ${socket.user.email} - Account has subscription time end`,
          {
            metadata: {
              user: socket.user ? socket.user.id : null,
              client: socket.client ? socket.client.id : null,
              processId: socket.processId,
              crc: socket.fileCRC,
              ip: socket.remoteAddress,
            },
          }
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
          winston.warn(
            `Login: ${socket.user.email} - Account has no credit limit for create new client`,
            {
              metadata: {
                user: socket.user ? socket.user.id : null,
                client: socket.client ? socket.client.id : null,
                processId: socket.processId,
                crc: socket.fileCRC,
                ip: socket.remoteAddress,
              },
            }
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

          winston.info(
            `Login: ${socket.user.email} - client ${client._id} created`,
            {
              metadata: {
                user: socket.user ? socket.user.id : null,
                client: socket.client ? socket.client.id : null,
                processId: socket.processId,
                crc: socket.fileCRC,
                ip: socket.remoteAddress,
              },
            }
          )
        })
      } else {
        if (!socket.user._id.equals(socket.user.id)) {
          winston.warn(
            `Login: ${socket.user.email} - client ${findedClient._id} registered another user (${findedClient.userId} != ${socket.user._id})`,
            {
              metadata: {
                user: socket.user ? socket.user.id : null,
                client: socket.client ? socket.client.id : null,
                processId: socket.processId,
                crc: socket.fileCRC,
                ip: socket.remoteAddress,
              },
            }
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

        winston.info(
          `Login: ${socket.user.email} - client ${socket.client._id}`,
          {
            metadata: {
              user: socket.user ? socket.user.id : null,
              client: socket.client ? socket.client.id : null,
              processId: socket.processId,
              crc: socket.fileCRC,
              ip: socket.remoteAddress,
            },
          }
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
          winston.info(`Login: ${socket.user.email} - signing session token`, {
            metadata: {
              user: socket.user ? socket.user.id : null,
              client: socket.client ? socket.client.id : null,
              processId: socket.processId,
              crc: socket.fileCRC,
              ip: socket.remoteAddress,
            },
          })

          token = jwt.sign({ userId: socket.user._id }, process.env.TOKEN_KEY, {
            expiresIn: '365d',
          })

          winston.info(
            `Login: ${socket.user.email} - session token signed, sending to client`,
            {
              metadata: {
                user: socket.user ? socket.user.id : null,
                client: socket.client ? socket.client.id : null,
                processId: socket.processId,
                crc: socket.fileCRC,
                ip: socket.remoteAddress,
              },
            }
          )

          this.socket.token = token

          let versionInfo = await VersionModel.findOne({
            status: 1,
            crc: this.socket.fileCRC,
          })

          if (versionInfo) {
            return this.send({ type: type, status: 1, token: token })
          } else {
            return this.send({ type: type, status: 2, token: token })
          }
        }

        case LoginType.TOKEN: {
          winston.info(
            `Login: ${socket.user.email} - token validation success, user authorized`,
            {
              metadata: {
                user: socket.user ? socket.user.id : null,
                client: socket.client ? socket.client.id : null,
                processId: socket.processId,
                crc: socket.fileCRC,
                ip: socket.remoteAddress,
              },
            }
          )

          this.socket.token = token

          let versionInfo = await VersionModel.findOne({
            status: 1,
            crc: this.socket.fileCRC,
          })

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

    if (status == 1 || status == 2) {
      packet.writeString(token, true)
    }

    this.socket.emit('send', packet.raw)
  }
}

export default Login
