import winston from 'winston'
import UserModel from '../models/user.js'

class Event {
  constructor(server, socket, options) {
    Object.defineProperty(this, 'server', { value: server })
    Object.defineProperty(this, 'socket', { value: socket })
    this.options = options
  }

  async validateToken() {
    try {
      const user = await UserModel.findOne({ _id: this.socket.metadata.userId })
      if (!user) return false
    } catch (err) {
      return false
    }

    return true
  }

  async middleWareRecv() {
    if (
      this.options.authorization &&
      (!this.validateToken() || this.socket.id == 0 || !this.socket.ready)
    ) {
      return false
    }

    return true
  }

  async handleRecv(packet) {
    try {
      this.rateLimiter
        .consume(this.socket.remoteAddress.replace('::ffff:', ''), 1)
        .then(() => {
          if (this.middleWareRecv()) {
            this.recv(packet)
          } else {
            this.server.serverLogger.warn(
              `Middleware: Invalid token, connection destroying`
            )
            this.socket.destroy()
          }
        })
        .catch(() => {
          this.server.serverLogger.warn(
            `${this.socket.remoteAddress.replace(
              '::ffff:',
              ''
            )} - Event request rate limited, connection destroying`
          )
        })
    } catch (err) {
      this.server.serverLogger.error(err)
    }
  }

  async middleWareSend() {
    return true
  }

  async handleSend(...args) {
    try {
      if (this.middleWareSend()) {
        this.send(...args)
      }
    } catch (err) {
      this.server.serverLogger.error(err)
    }
  }
}

export default Event
