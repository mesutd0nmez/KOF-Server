import express from 'express'
import Shopier from 'shopier-api'
import OrderModel from '../../models/order.js'

const router = express.Router()

router.get('/', async (req, res) => {
  const orderId = req.query.order

  if (!orderId) {
    return res.status(400).send()
  }

  const order = await OrderModel.findOne({
    _id: orderId,
  })
    .populate('user')
    .populate('product')
    .catch((err) => {
      console.info(err)
      return res.status(400).send()
    })

  if (!order) {
    return res.status(400).send()
  }

  if (order.status !== 0) {
    return res.status(400).send()
  }

  try {
    const shopier = new Shopier(
      process.env.SHOPIER_API_ID,
      process.env.SHOPIER_API_KEY
    )

    shopier.setBuyer({
      id: order.id,
      product_name: order.product.name,
      first_name: order.user.username,
      last_name: '-',
      email: order.user.email,
      phone: '-',
    })

    shopier.setOrderBilling({
      billing_address: '-',
      billing_city: '-',
      billing_country: '-',
      billing_postcode: '-',
    })

    shopier.setOrderShipping({
      shipping_address: '-',
      shipping_city: '-',
      shipping_country: '-',
      shipping_postcode: '-',
    })

    const paymentPage = shopier.payment(order.product.price)

    res.end(paymentPage)
  } catch (err) {
    console.info(err)
    return res.status(400).send()
  }
})

router.get('/notify', async (req, res) => {})

export default router
