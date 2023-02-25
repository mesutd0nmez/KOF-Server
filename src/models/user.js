import mongoose from 'mongoose'

const userSchema = mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    type: {
      type: Number,
      enum: [0, 1, 255],
      default: 0,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

const User = mongoose.model('User', userSchema)

export default User
