import mongoose from 'mongoose'
import { Server } from './src/server.js'
import winston from 'winston'

mongoose.set('strictQuery', false)

mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => {
    const server = new Server({
      port: process.env.PORT,
    })

    server.createServer()
    server.createWebServer()
  })
  .catch((error) => {
    winston.error(error)
  })
