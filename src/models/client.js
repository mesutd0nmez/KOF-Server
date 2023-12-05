import mongoose from 'mongoose'

const clientSchema = mongoose.Schema(
  {
    userId: { type: mongoose.Types.ObjectId, ref: 'User' },
    systemName: {
      type: String,
    },
    uuid: {
      type: String,
    },
    systemSerialNumber: {
      type: String,
    },
    gpu: {
      type: String,
    },
    ip: {
      type: String,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

const Client = mongoose.model('Client', clientSchema)

export default Client
