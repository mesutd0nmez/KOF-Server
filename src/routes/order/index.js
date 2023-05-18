import express from 'express'
import ProductModel from '../../models/product.js'
import OrderModel from '../../models/order.js'
import moment from 'moment'

const router = express.Router()

router.get('/', async (req, res) => {
  const today = moment().startOf('day')
  const orders = await OrderModel.find({
    user: req.user._id,
    createdAt: {
      $gte: today.toDate(),
      $lte: moment(today).endOf('day').toDate(),
    },
  }).populate('product')
  res.json(orders)
})

router.post('/', async (req, res) => {
  const product = await ProductModel.findOne({ _id: req.body.product }).catch(
    (err) => {
      console.info(err)
      return res.status(400).send()
    }
  )

  if (!product) {
    return res.status(400).send()
  }

  const order = await OrderModel.create({
    user: req.user._id,
    product: product._id,
  }).catch((err) => {
    console.info(err)
    return res.status(400).send()
  })

  if (!order) {
    return res.status(400).send()
  }

  return res.json({ order: order._id })
})

export default router
