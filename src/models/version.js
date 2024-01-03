import mongoose from 'mongoose'

const versionSchema = mongoose.Schema(
  {
    fileName: {
      type: String,
    },
    crc: {
      type: String,
    },
    status: {
      type: Number,
      enum: [0, 1],
      default: 0,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

const Version = mongoose.model('Version', versionSchema)

export default Version
