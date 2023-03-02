import mongoose from 'mongoose'

const clientSchema = mongoose.Schema(
  {
    userId: { type: mongoose.Types.ObjectId, ref: 'User' },
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
