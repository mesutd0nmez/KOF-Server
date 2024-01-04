import PacketHeader from '../core/enums/packetHeader.js'
import { ByteBuffer } from '../utils/byteBuffer.js'

import Event from '../core/event.js'
import PurchaseModel from '../models/purchase.js'

class Purchase extends Event {
  constructor(server, socket) {
    super(server, socket, {
      header: PacketHeader.PURCHASE,
      authorization: false,
      rateLimitOpts: {
        points: 1,
        duration: 1, // Per second
      },
    })
  }

  async recv(packet) {
    try {
      const type = packet.readUnsignedByte()
      const credit = packet.readInt()
      const day = packet.readUnsignedInt()

      if (type == 0 && this.socket.user.credit == -1) {
        this.server.serverLogger.warn(
          `User can already make unlimited activation, purchase failed`,
          {
            metadata: this.socket.metadata,
          }
        )
        return
      }

      await PurchaseModel.create({
        user: this.socket.metadata.userId,
        type: type,
        credit: credit,
        day: day,
        ip: this.socket.remoteAddress.replace('::ffff:', ''),
      }).then(async (invoice) => {
        const sendPacket = new ByteBuffer()

        sendPacket.writeUnsignedByte(this.options.header)

        const purchaseUrl = `${process.env.WEB_API_URL}/v1/store/purchase?invoiceId=${invoice._id}`
        sendPacket.writeString(purchaseUrl, true)

        this.socket.emit('send', sendPacket.raw)
      })
    } catch (error) {
      this.server.serverLogger.error(error, {
        metadata: this.socket.metadata,
      })
    }
  }
}

export default Purchase
