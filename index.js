import mongoose from 'mongoose'
import { Server } from './src/server.js'

mongoose.set('strictQuery', false)

mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => {
    const server = new Server({
      port: process.env.PORT,
    })

    server.createServer()
  })
  .catch((error) => {
    console.info(error)
  })
