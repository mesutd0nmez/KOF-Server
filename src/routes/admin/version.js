import express from 'express'
import multer from 'multer'
import VersionModel from '../../models/version.js'

const router = express.Router()

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './data/updates')
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname)
  },
})

const upload = multer({ storage: storage })

router.post('/', upload.single('file'), async (req, res) => {
  const uploadedFile = req.file
  const { crc } = req.body

  //if (!uploadedFile) return res.status(400).send({ status: 'Invalid request' })

  try {
    await VersionModel.create({
      crc: crc,
      status: 1,
    })

    res.send({ status: 'Update file updated' })
  } catch (error) {
    console.error(error)
    return res.status(401).send()
  }
})

export default router
