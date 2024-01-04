import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

import PurchaseModel from '../../../models/purchase.js'
import PurchaseStatus from '../../../core/enums/purchaseStatus.js'

import { Shopier } from 'shopier-api'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const { invoiceId } = req.query

    if (!invoiceId) return res.redirect(`${process.env.WEB_URL}/failure.html`)

    const purchase = await PurchaseModel.findOne({ _id: invoiceId }).populate(
      'user'
    )

    if (purchase) {
      if (purchase.status != PurchaseStatus.AWAITING_APPROVAL) {
        return res.redirect(`${process.env.WEB_URL}/failure.html`)
      }

      const shopier = new Shopier(
        process.env.SHOPIER_API_KEY,
        process.env.SHOPIER_API_SECRET
      )

      shopier.setBuyer({
        buyer_id_nr: invoiceId,
        product_name:
          purchase.type == 0
            ? `${purchase.credit} Kredi`
            : purchase.day == 0
              ? '15 Günlük Abonelik'
              : '30 Günlük Abonelik',
        buyer_name: '',
        buyer_surname: '',
        buyer_email: purchase.user.email,
        buyer_phone: '',
      })

      shopier.setOrderBilling({
        billing_address: '',
        billing_city: '',
        billing_country: '',
        billing_postcode: '',
      })

      shopier.setOrderShipping({
        shipping_address: '',
        shipping_city: '',
        shipping_country: '',
        shipping_postcode: '',
      })

      let paymentPage = null

      switch (purchase.type) {
        case 0:
          {
            paymentPage = shopier.payment(125 * purchase.credit)
          }
          break
        case 1:
          {
            paymentPage = shopier.payment(
              purchase.day == 0
                ? purchase.user.pricing
                : purchase.user.pricing * 2
            )
          }
          break
      }

      if (!paymentPage) {
        return res.redirect(`${process.env.WEB_URL}/failure.html`)
      }

      res.end(paymentPage)
    } else {
      return res.redirect(`${process.env.WEB_URL}/failure.html`)
    }
  } catch (error) {
    req.app.logger.error(error)
    res.redirect(`${process.env.WEB_URL}/failure.html`)
  }
})

router.post('/', async (req, res) => {
  try {
    const shopier = new Shopier(
      process.env.SHOPIER_API_KEY,
      process.env.SHOPIER_API_SECRET
    )

    const response = shopier.callback(req.body, process.env.SHOPIER_API_SECRET)

    if (response) {
      const purchase = await PurchaseModel.findOne({
        _id: response.order_id,
      }).populate('user')

      if (purchase) {
        if (purchase.status != PurchaseStatus.AWAITING_APPROVAL) {
          return res.redirect(`${process.env.WEB_URL}/failure.html`)
        }

        purchase.payment_id = response.payment_id
        purchase.installment = response.installment
        purchase.status = PurchaseStatus.APPROVED
        purchase.save()

        switch (purchase.type) {
          case 0:
            {
              purchase.user.credit += purchase.credit
              purchase.user.save()
            }
            break
          case 1:
            {
              const dayList = [15, 30]

              const currentDate = new Date()
              let futureDate = new Date()

              if (purchase.user.subscriptionEndAt > currentDate) {
                futureDate = new Date(purchase.user.subscriptionEndAt)
                futureDate.setDate(futureDate.getDate() + dayList[purchase.day])
              } else {
                futureDate.setDate(
                  currentDate.getDate() + dayList[purchase.day]
                )
              }
              purchase.user.subscriptionEndAt = futureDate
              purchase.user.save()
            }
            break
        }

        res.redirect(`${process.env.WEB_URL}/success.html`)
      } else {
        res.redirect(`${process.env.WEB_URL}/failure.html`)
      }
    } else {
      res.redirect(`${process.env.WEB_URL}/failure.html`)
    }
  } catch (error) {
    req.app.logger.error(error)
    res.redirect(`${process.env.WEB_URL}/failure.html`)
  }
})

export default router
