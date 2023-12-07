import mongoose from 'mongoose'

const configurationSchema = mongoose.Schema(
  {
    userId: { type: mongoose.Types.ObjectId, ref: 'User' },
    platform: {
      type: Number,
      enum: [0, 1, 2, 3, 4],
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
