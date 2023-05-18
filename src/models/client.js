import mongoose from 'mongoose'

const clientSchema = mongoose.Schema(
  {
    user: { type: mongoose.Types.ObjectId, ref: 'User' },
    systemName: {
      type: String,
    },
    processorId: {
      type: String,
    },
    baseBoardSerial: {
      type: String,
    },
    hddSerial: {
      type: String,
    },
    uuid: {
      type: String,
    },
    systemSerialNumber: {
      type: String,
    },
    partNumber: {
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
