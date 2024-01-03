import mongoose from 'mongoose'
import { Server } from './src/server.js'

const server = new Server({
  port: process.env.PORT,
})

mongoose.set('strictQuery', false)
mongoose
  .connect(process.env.MONGODB_URL)
  .then(async () => {
    await server.createServer()
    await server.createWebServer()
  })
  .catch((error) => {
    server.serverLogger.error(error)
  })
