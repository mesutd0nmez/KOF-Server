import mongoose from 'mongoose'

const configurationSchema = mongoose.Schema(
  {
    user_id: { type: mongoose.Types.ObjectId, ref: 'User' },
    app_type: {
      type: Number,
      enum: [0, 1, 2],
      default: 0,
    },
    platform: {
      type: Number,
      enum: [0, 1, 2, 3],
      default: 0,
    },
    server: {
      type: String,
      default: null,
    },
    name: {
      type: String,
      default: null,
    },
    configuration: {
      type: Object,
      required: true,
    },
  },
  { versionKey: false }
)

const Configuration = mongoose.model('Configuration', configurationSchema)

export default Configuration
