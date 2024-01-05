import mongoose from 'mongoose'
import PurchaseStatus from '../core/enums/purchaseStatus.js'

const purchaseSchema = mongoose.Schema(
  {
    user: { type: mongoose.Types.ObjectId, ref: 'User' },
    type: {
      type: Number,
    },
    credit: {
      type: Number,
    },
    day: {
      type: Number,
    },
    ip: {
      type: String,
    },
    payment_id: {
      type: Number,
      default: 0,
    },
    installment: {
      type: Number,
      default: 0,
    },
    status: {
      type: Number,
      enum: [
        PurchaseStatus.AWAITING_APPROVAL,
        PurchaseStatus.REJECTED,
        PurchaseStatus.APPROVED,
      ],
      default: 0,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

const Purchase = mongoose.model('Purchase', purchaseSchema)

export default Purchase
