import jwt from 'jsonwebtoken'

class Event {
  constructor(socket, options) {
    Object.defineProperty(this, 'socket', { value: socket })
    this.options = options
    this.options.user_id = 0
  }

  async validateToken() {
    try {
      const decoded = jwt.verify(this.socket.token, process.env.TOKEN_KEY)
      this.options.user_id = decoded.user_id
      console.info(`Middleware: User token verified`)
    } catch (err) {
      console.info(`Middleware: Invalid token, connection destroying`)
      this.socket.destroy()
      return false
    }
    return true
  }

  async middleWareRecv() {
    if (this.options.authorization && !this.validateToken()) {
      return false
    }

    return true
  }

  async handleRecv(packet) {
    if (this.middleWareRecv()) {
      this.recv(packet)
    }
  }

  async middleWareSend() {}

  async handleSend(...args) {
    if (this.middleWareSend()) {
      this.send(...args)
    }
  }
}

export default Event
