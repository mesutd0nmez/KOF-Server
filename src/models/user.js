import mongoose from 'mongoose'

const userSchema = mongoose.Schema(
  {
    discordId: { type: String },
    username: { type: String },
    email: { type: String },
    avatar: { type: String },
    accessToken: { type: String },
    expiresIn: { type: Number },
    refreshToken: { type: String },
    scope: { type: String },
    tokenType: { type: String },
    package: {
      type: Number,
      default: 1,
    },
    isAdmin: {
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

const User = mongoose.model('User', userSchema)

export default User
