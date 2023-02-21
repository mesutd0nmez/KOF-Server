import mongoose from 'mongoose'

const injectionSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
    },
    clientId: {
      type: mongoose.Types.ObjectId,
      ref: 'Client',
    },
    accountIndex: {
      type: Number,
      default: 0,
    },
    processId: {
      type: Number,
      default: 0,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

const Injection = mongoose.model('Injection', injectionSchema)

export default Injection
