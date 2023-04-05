import mongoose from 'mongoose'

const userSchema = mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    type: {
      type: Number,
      default: 1,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

const User = mongoose.model('User', userSchema)

export default User
