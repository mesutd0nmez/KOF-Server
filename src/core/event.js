import jwt from 'jsonwebtoken'
import winston from 'winston'

class Event {
  constructor(server, socket, options) {
    Object.defineProperty(this, 'server', { value: server })
    Object.defineProperty(this, 'socket', { value: socket })
    this.options = options
    this.options.userId = 0
  }

  async validateToken() {
    try {
      const decoded = jwt.verify(this.socket.token, process.env.TOKEN_KEY)
      this.options.userId = decoded.userId
    } catch (err) {
      return false
    }

    return true
  }

  async middleWareRecv() {
    if (
      this.options.authorization &&
      (!this.validateToken() || this.socket == -1)
    ) {
      return false
    }

    return true
  }

  async handleRecv(packet) {
    try {
      this.rateLimiter
        .consume(this.socket.remoteAddress, 1)
        .then(() => {
          if (this.middleWareRecv()) {
            this.recv(packet)
          } else {
            winston.warn(`Middleware: Invalid token, connection destroying`)
            this.socket.destroy()
          }
        })
        .catch(() => {
          winston.warn(
            `${this.socket.remoteAddress} - Event request rate limited, connection destroying`
          )
          this.socket.destroy()
        })
    } catch (err) {
      winston.error(err)
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
      winston.error(err)
    }
  }
}

export default Event
