import UserModel from '../models/user.js'

class Event {
  constructor(server, socket, options) {
    Object.defineProperty(this, 'server', { value: server })
    Object.defineProperty(this, 'socket', { value: socket })
    this.options = options
  }

  async middleWareRecv() {
    if (this.options.authorization) {
      this.socket.user = await UserModel.findOne({
        _id: this.socket.metadata.userId,
      })

      if (!this.socket.user) {
        return false
      }

      if (this.options.subscribed) {
        const currentDate = new Date()
        const subscriptionEndAt = new Date(this.socket.user.subscriptionEndAt)

        if (currentDate > subscriptionEndAt) {
          return false
        }
      }
    }

    return true
  }

  handleRecv(packet) {
    try {
      this.rateLimiter
        .consume(this.socket.remoteAddress.replace('::ffff:', ''), 1)
        .then(async () => {
          if (await this.middleWareRecv()) {
            this.recv(packet)
          } else {
            this.server.serverLogger.warn(
              `Middleware: Cannot verify session, connection destroying`,
              { metadata: this.socket.metadata }
            )
            this.socket.destroy()
          }
        })
        .catch(() => {
          this.server.serverLogger.warn(
            `Middleware: ${this.socket.remoteAddress.replace(
              '::ffff:',
              ''
            )} - Event request rate limited, connection destroying`,
            { metadata: this.socket.metadata }
          )
          this.socket.destroy()
        })
    } catch (err) {
      this.server.serverLogger.error(err, { metadata: this.socket.metadata })
    }
  }

  middleWareSend() {
    return true
  }

  handleSend(...args) {
    try {
      if (this.middleWareSend()) {
        this.send(...args)
      }
    } catch (err) {
      this.server.serverLogger.error(err, { metadata: this.socket.metadata })
    }
  }
}

export default Event
