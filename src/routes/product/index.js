import express from 'express'
import ProductModel from '../../models/product.js'
import adminMiddleware from '../../middleware/admin.js'

const router = express.Router()

router.get('/', async (req, res) => {
  const products = await ProductModel.find()
  res.json(products)
})

router.put('/', adminMiddleware, async (req, res) => {
  const { id } = req.query
  if (!id) return res.status(400).send()
  await ProductModel.updateOne({ _id: id }, req.body)
    .then(async () => {
      return res.json({ message: 'Product updated!' })
    })
    .catch((err) => {
      console.info(err)
      return res.status(400).send()
    })
})

router.post('/', adminMiddleware, async (req, res) => {
  await ProductModel.exists({ name: req.body.name })
    .then(async (product) => {
      if (!product) {
        await ProductModel.create(req.body)
          .then(() => {
            return res.json({ message: 'Product added!' })
          })
          .catch((err) => console.info(err))
      } else {
        return res.json({ message: 'Product already exist' })
      }
    })
    .catch((err) => {
      console.info(err)
      return res.status(400).send()
    })
})

router.delete('/', adminMiddleware, async (req, res) => {
  const { id } = req.query
  if (!id) return res.status(400).send()
  await ProductModel.deleteOne({ _id: id })
    .then(async () => {
      return res.json({ message: 'Product deleted!' })
    })
    .catch((err) => {
      console.info(err)
      return res.status(400).send()
    })
})

export default router
