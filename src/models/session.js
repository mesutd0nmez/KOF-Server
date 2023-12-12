import mongoose from 'mongoose'

const sessionSchema = mongoose.Schema(
  {
    userId: { type: mongoose.Types.ObjectId, ref: 'User' },
    clientId: { type: mongoose.Types.ObjectId, ref: 'Client' },
    socketId: {
      type: Number,
    },
    processId: {
      type: Number,
    },
    fileCRC: {
      type: Number,
    },
    platform: {
      type: Number,
      enum: [0, 1, 2, 3, 4],
      default: 0,
    },
    characterName: {
      type: String,
    },
    characterServerId: {
      type: String,
    },
    characterX: {
      type: String,
    },
    characterY: {
      type: String,
    },
    characterMapIndex: {
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

const Session = mongoose.model('Session', sessionSchema)

export default Session
