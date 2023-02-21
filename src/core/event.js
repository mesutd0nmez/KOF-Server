import jwt from 'jsonwebtoken'

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
      console.info(`Middleware: Invalid token, connection destroying`)
      this.socket.destroy()
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
    this.rateLimiter
      .consume(this.socket.remoteAddress, 1)
      .then(() => {
        if (this.middleWareRecv()) {
          this.recv(packet)
        }
      })
      .catch(() => {
        console.info(`Request rate limited`)
      })
  }

  async middleWareSend() {
    return true
  }

  async handleSend(...args) {
    if (this.middleWareSend()) {
      this.send(...args)
    }
  }
}

export default Event
