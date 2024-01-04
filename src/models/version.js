import mongoose from 'mongoose'
import VersionStatus from '../core/enums/versionStatus.js'

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
      enum: [VersionStatus.OUTDATED, VersionStatus.RELEASE],
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
