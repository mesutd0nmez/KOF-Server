import express from 'express'
import ClientModel from '../../models/client.js'

const router = express.Router()

router.get('/', async (req, res) => {
  const clients = await ClientModel.find({
    user: req.user._id,
  })
    .select(['_id', 'systemName', 'createdAt', 'updatedAt'])
    .catch((err) => {
      console.info(err)
      return res.status(400).send()
    })

  return res.json(clients)
})

router.delete('/', async (req, res) => {
  const { id } = req.query
  if (!id) return res.status(400).send()
  await ClientModel.deleteOne({ _id: id, user: req.user._id })
    .then(async () => {
      return res.json({ message: 'Client deleted!' })
    })
    .catch((err) => {
      console.info(err)
      return res.status(400).send()
    })
})

export default router
