import mongoose from 'mongoose'
import PlatformType from '../core/enums/platformType.js'

const configurationSchema = mongoose.Schema(
  {
    userId: { type: mongoose.Types.ObjectId, ref: 'User' },
    platform: {
      type: Number,
      enum: [
        PlatformType.USKO,
        PlatformType.CNKO,
        PlatformType.KOKO,
        PlatformType.STKO,
      ],
      default: 0,
    },
    server: {
      type: Number,
      default: 0,
    },
    name: {
      type: String,
      default: null,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

const Configuration = mongoose.model('Configuration', configurationSchema)

export default Configuration
