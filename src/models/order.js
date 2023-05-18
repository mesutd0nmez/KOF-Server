import mongoose from 'mongoose'

const orderSchema = mongoose.Schema(
  {
    user: { type: mongoose.Types.ObjectId, ref: 'User' },
    product: { type: mongoose.Types.ObjectId, ref: 'Product' },
    status: {
      type: Number,
      enum: [0, 1, 2],
      default: 0,
      // 0 - Order created
      // 1 - Awaiting approvel
      // 2 - Success
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)
const Order = mongoose.model('Order', orderSchema)

export default Order
