import mongoose from 'mongoose'

const userSchema = mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    credit: { type: Number, default: 1 },
    pricing: { type: Number, default: 1000 },
    subscriptionEndAt: { type: Date, required: true },
    admin: { type: Number, default: 0 },
  },
  {
    versionKey: false,
    timestamps: true,
  }
)

const User = mongoose.model('User', userSchema)

export default User
