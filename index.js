import mongoose from 'mongoose'
import { Server } from './src/server.js'

mongoose.set('strictQuery', false)

mongoose
  .connect(process.env.MONGODB_URL)
  .then(async () => {
    const server = new Server({
      port: process.env.PORT,
    })

    await server.createServer()
    await server.createWebServer()
  })
  .catch((error) => {
    console.info(error)
  })
