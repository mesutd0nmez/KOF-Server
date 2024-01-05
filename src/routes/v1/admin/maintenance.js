import express from 'express'
import multer from 'multer'
import VersionModel from '../../../models/version.js'

const router = express.Router()

const pointerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './data/pointers')
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname)
  },
})

const uploadPointer = multer({ storage: pointerStorage })

router.patch('/pointer', uploadPointer.single('file'), async (req, res) => {
  try {
    const uploadedFile = req.file

    if (!uploadedFile)
      return res.status(400).send({ status: 'Invalid request' })

    res.send({ status: 'Pointer file updated' })
  } catch (error) {
    req.app.logger.error(error)
    return res.status(401).send()
  }
})

const updateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './data/updates')
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname)
  },
})

const uploadUpdate = multer({ storage: updateStorage })

router.put('/version', uploadUpdate.single('file'), async (req, res) => {
  try {
    const { fileName, crc, release } = req.body
    if (release == 1) {
      await VersionModel.updateMany(
        {},
        {
          $set: {
            status: 0,
          },
        },
        {
          multi: true,
        }
      )
    }

    await VersionModel.create({
      fileName: fileName,
      crc: crc,
      status: 1,
    })

    res.send({ status: 'Update file updated' })
  } catch (error) {
    req.app.logger.error(error)
    return res.status(401).send()
  }
})

router.delete('/version', uploadUpdate.single('file'), async (req, res) => {
  try {
    await VersionModel.deleteMany({})

    res.send({ status: 'Removed all versions' })
  } catch (error) {
    req.app.logger.error(error)
    return res.status(401).send()
  }
})

router.put('/updater', uploadUpdate.single('file'), async (req, res) => {
  try {
    const uploadedFile = req.file

    if (!uploadedFile)
      return res.status(400).send({ status: 'Invalid request' })

    res.send({ status: 'Updater file updated' })
  } catch (error) {
    req.app.logger.error(error)
    return res.status(401).send()
  }
})

const storageLibrary = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './data/libraries')
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname)
  },
})

const uploadLibrary = multer({ storage: storageLibrary })

router.put('/library', uploadLibrary.single('file'), async (req, res) => {
  try {
    const uploadedFile = req.file

    if (!uploadedFile)
      return res.status(400).send({ status: 'Invalid request' })

    res.send({ status: 'Library file updated' })
  } catch (error) {
    req.app.logger.error(error)
    return res.status(401).send()
  }
})

router.post('/disconnect', async (req, res) => {
  try {
    const server = req.app.server
    const lastSessionSize = server.sessions.size

    await server.sessions.forEach((socket) => {
      socket.destroy()
    })

    res.send({ status: `Destroyed ${lastSessionSize} session` })
  } catch (error) {
    req.app.logger.error(error)
    return res.status(400).send({ status: 'Invalid request' })
  }
})

router.post('/restart', async (req, res) => {
  try {
    const server = req.app.server

    await server.sessions.forEach((socket) => {
      socket.destroy()
    })

    res.send({ status: `Server restart processed` })

    process.exit(0)
  } catch (error) {
    req.app.logger.error(error)
    return res.status(400).send({ status: 'Invalid request' })
  }
})

export default router
