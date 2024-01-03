import express from 'express'
import UserModel from '../../../models/user.js'
import ConfigurationModel from '../../../models/configuration.js'
import ClientModel from '../../../models/client.js'
import crypto from 'crypto'
import validator from 'validator'
import bcrypt from 'bcryptjs'

const router = express.Router()

function generateSecurePassword() {
  const length = 12
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let securePassword = ''

  while (securePassword.length < length) {
    const randomBytes = crypto.randomBytes(1)
    const randomIndex = randomBytes[0] % charset.length
    securePassword += charset.charAt(randomIndex)
  }

  return securePassword
}

router.get('/', async (req, res) => {
  try {
    const { email } = req.query

    if (!email) return res.status(400).send({ status: 'Invalid request' })

    if (!validator.isEmail(email)) {
      return res.status(400).send({ status: 'Invalid request' })
    }

    const user = await UserModel.findOne({ email: email }).select('-password')

    if (user) {
      const configuration = await ConfigurationModel.find({
        userId: user._id,
      })
        .where('appType')
        .gt(0)

      const client = await ClientModel.find({
        userId: user._id,
      })

      return res.send({
        user: user,
        configuredPlayerCount: configuration.length,
        activatedClientCount: client.length,
        configuration: configuration,
        client: client,
      })
    } else {
      return res.send({ status: `User ${email} doesn't exist` })
    }
  } catch (error) {
    req.app.logger.error(error)
    return res.status(400).send({ status: 'Invalid request' })
  }
})

router.post('/', async (req, res) => {
  const { email, credit, day } = req.body

  if (!email || !credit || !day)
    return res.status(400).send({ status: 'Invalid request' })

  if (!validator.isEmail(email)) {
    return res.status(400).send({ status: 'Invalid request' })
  }

  try {
    const user = await UserModel.findOne({ email: email })

    if (user) {
      return res.send({ status: `User ${email} already exist` })
    } else {
      const password = generateSecurePassword()
      const hashedPassword = await bcrypt.hash(password, 10)

      const today = new Date()
      const futureDate = new Date()
      futureDate.setDate(today.getDate() + parseInt(day))

      await UserModel.create({
        email: email,
        password: hashedPassword,
        subscriptionEndAt: futureDate,
        credit: credit,
      }).then((createdUser) => {
        return res.send({
          user: {
            email: createdUser.email,
            password: password,
            credit: createdUser.credit,
            subscriptionEndAt: createdUser.subscriptionEndAt,
          },
        })
      })
    }
  } catch (error) {
    req.app.logger.error(error)
    return res.status(400).send({ status: 'Invalid request' })
  }
})

router.patch('/', async (req, res) => {
  const { email } = req.query
  const { credit, day, password } = req.body

  if (!email) return res.status(400).send({ status: 'Invalid request' })

  if (!validator.isEmail(email)) {
    return res.status(400).send({ status: 'Invalid request' })
  }

  try {
    const user = await UserModel.findOne({ email: email })

    if (user) {
      user.credit = credit

      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10)
        user.password = hashedPassword
      }

      const today = new Date()
      const futureDate = new Date()
      futureDate.setDate(today.getDate() + parseInt(day))

      user.subscriptionEndAt = futureDate

      user.save()

      return res.send({ status: `User ${email} updated` })
    } else {
      return res.send({ status: `User ${email} doesn't exist` })
    }
  } catch (error) {
    req.app.logger.error(error)
    return res.status(400).send({ status: 'Invalid request' })
  }
})

export default router
