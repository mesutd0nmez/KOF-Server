import PacketHeader from '../core/enums/packetHeader.js'
import LoginType from '../core/enums/loginType.js'
import { ByteBuffer } from '../utils/byteBuffer.js'
import Event from '../core/event.js'
import UserModel from '../models/user.js'
import ClientModel from '../models/client.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import validator from 'validator'
import VersionModel from '../models/version.js'

class Login extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.LOGIN,
      authorization: false,
      rateLimitOpts: {
        points: 2,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    try {
      const type = packet.readUnsignedByte()

      let token = null
      let user = null

      switch (type) {
        case LoginType.GENERIC:
          {
            const email = packet.readString(true)
            const password = packet.readString(true)

            if (!email || !password) return

            if (!validator.isEmail(email)) {
              this.server.serverLogger.warn(
                `Login: ${email} - is not valid email`,
                {
                  metadata: this.socket.metadata,
                }
              )

              return this.send({
                type: type,
                status: 0,
                message: 'Aktivasyon bilgileri hatali',
              })
            }

            user = await UserModel.findOne({ email: email })

            if (user) {
              if (!(await bcrypt.compare(password, user.password))) {
                user = null
                this.server.serverLogger.warn(
                  `Login: ${email} - password does not match`,
                  {
                    metadata: this.socket.metadata,
                  }
                )
                return this.send({
                  type: type,
                  status: 0,
                  message: 'Aktivasyon bilgileri hatali',
                })
              }
              token = jwt.sign({ userId: user._id }, process.env.TOKEN_KEY, {
                expiresIn: '15d',
              })
            } else {
              if (process.env.AUTO_REGISTRATION == 1) {
                this.server.serverLogger.warn(
                  `Login: ${email} - not found, auto registration in progress`,
                  {
                    metadata: this.socket.metadata,
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
                  user = createdUser
                  this.server.serverLogger.info(
                    `Login: ${createdUser.email} - created`,
                    {
                      metadata: this.socket.metadata,
                    }
                  )
                  token = jwt.sign(
                    { userId: user._id },
                    process.env.TOKEN_KEY,
                    {
                      expiresIn: '15d',
                    }
                  )
                })
              } else {
                this.server.serverLogger.warn(`Login: ${email} - not found`, {
                  metadata: this.socket.metadata,
                })

                return this.send({
                  type: type,
                  status: 0,
                  message: 'Aktivasyon basarisiz',
                })
              }
            }
          }
          break
        case LoginType.TOKEN:
          try {
            token = packet.readString(true)

            if (!token)
              return this.send({
                type: type,
                status: 0,
                message: 'Aktivasyon basarisiz',
              })

            const decoded = jwt.verify(token, process.env.TOKEN_KEY)
            user = await UserModel.findOne({ _id: decoded.userId })

            if (!user) {
              this.server.serverLogger.warn(
                `Login: There is no user with this token`,
                {
                  metadata: this.socket.metadata,
                }
              )

              return this.send({
                type: type,
                status: 0,
                message: 'Aktivasyon basarisiz',
              })
            }
          } catch (err) {
            this.server.serverLogger.error(err, {
              metadata: this.socket.metadata,
            })

            user = null

            return this.send({
              type: type,
              status: 0,
              message: 'Aktivasyon basarisiz',
            })
          }
          break
      }

      if (user) {
        user.updatedAt = Date.now()
        user.save()

        let client = await ClientModel.findOne({
          systemName: this.socket.metadata.client.systemName,
          uuid: this.socket.metadata.client.uuid,
          systemSerialNumber: this.socket.metadata.client.systemSerialNumber,
          gpu: this.socket.metadata.client.gpu,
        })

        if (!client) {
          if (user.credit == 0) {
            this.server.serverLogger.warn(
              `Login: ${user.email} - Account has no credit limit for create new client`,
              {
                metadata: this.socket.metadata,
              }
            )

            return this.send({
              type: type,
              status: 0,
              message: 'Aktivasyon icin yeterli kredi yok',
            })
          }

          await ClientModel.create({
            userId: user._id,
            systemName: this.socket.metadata.client.systemName,
            uuid: this.socket.metadata.client.uuid,
            systemSerialNumber: this.socket.metadata.client.systemSerialNumber,
            gpu: this.socket.metadata.client.gpu,
            ip: this.socket.remoteAddress.replace('::ffff:', ''),
          }).then(async (createdClient) => {
            client = createdClient

            if (user.credit != -1) {
              if (user.credit < -1) {
                user.credit = -1
              } else {
                user.credit--
              }

              user.save()
            }

            this.server.serverLogger.info(
              `Login: ${user.email} - client ${client._id} created`,
              {
                metadata: this.socket.metadata,
              }
            )
          })
        }

        if (!client) {
          return this.send({
            type: type,
            status: 0,
            message: 'Aktivasyon basarisiz',
          })
        }

        if (!client.userId.equals(user._id)) {
          this.server.serverLogger.warn(
            `Login: ${user.email} - client ${client._id} registered another user (${client.userId} != ${user._id})`,
            {
              metadata: this.socket.metadata,
            }
          )

          return this.send({
            type: type,
            status: 0,
            message: 'Daha once aktivasyon yapildi',
          })
        }

        let activeClientSession = this.server.clients.get(client._id)

        if (activeClientSession) {
          this.server.serverLogger.warn(
            `Login: ${user.email} - client ${client._id} another client session active)`,
            {
              metadata: this.socket.metadata,
            }
          )

          return this.send({
            type: type,
            status: 0,
            message: 'Client baska yerde calisiyor',
          })
        }

        this.server.serverLogger.info(
          `Login: ${user.email} - client ${client._id} login`,
          {
            metadata: this.socket.metadata,
          }
        )

        client.ip = this.socket.remoteAddress.replace('::ffff:', '')
        client.updatedAt = Date.now()

        await client.save()

        this.socket.metadata.userId = user._id
        this.socket.metadata.clientId = client._id

        this.server.users.set(this.socket.metadata.userId, this.socket)
        this.server.clients.set(this.socket.metadata.clientId, this.socket)

        const versionInfo = await VersionModel.findOne({
          status: 1,
          crc: this.socket.metadata.fileCRC,
        })

        return this.send({
          type: type,
          status: versionInfo ? 1 : 2,
          token: token,
          subscriptionEndAt: user.subscriptionEndAt.getTime(),
          credit: user.credit,
        })
      }
    } catch (error) {
      this.server.serverLogger.error(error, {
        metadata: this.socket.metadata,
      })
    }
  }

  async send({
    type = LoginType.GENERIC,
    status = 0,
    token = '',
    message = '',
    subscriptionEndAt = 0,
    credit = 0,
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
      packet.writeUnsignedInt(subscriptionEndAt / 1000)
      packet.writeInt(credit)
    }

    this.socket.emit('send', packet.raw)
  }
}

export default Login
