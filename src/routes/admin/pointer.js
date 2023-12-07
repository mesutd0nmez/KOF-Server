import express from 'express'
import multer from 'multer'
import winston from 'winston'

const router = express.Router()

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './data/pointers')
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname)
  },
})

const upload = multer({ storage: storage })

router.post('/', upload.single('file'), async (req, res) => {
  const uploadedFile = req.file

  if (!uploadedFile) return res.status(400).send({ status: 'Invalid request' })

  try {
    res.send({ status: 'Pointer file updated' })
  } catch (error) {
    winston.error(error)
    return res.status(401).send()
  }
})

export default router
