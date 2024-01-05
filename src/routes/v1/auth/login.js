import express from 'express'
import UserModel from '../../../models/user.js'
import jwt from 'jsonwebtoken'
import validator from 'validator'
import bcrypt from 'bcryptjs'

const router = express.Router()

router.post('/', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password)
      return res.status(400).send({ status: 'Invalid request' })

    if (!validator.isEmail(email)) {
      return res.status(400).send({ status: 'Invalid request' })
    }

    const user = await UserModel.findOne({ email: email })

    if (user) {
      if (!(await bcrypt.compare(password, user.password))) {
        return res.status(400).send({ status: 'Invalid request' })
      }

      const token = jwt.sign({ userId: user._id }, process.env.TOKEN_KEY, {
        expiresIn: '30d',
      })

      return res.send({ token: token })
    } else {
      if (process.env.AUTO_REGISTRATION == 1) {
        const hashedPassword = await bcrypt.hash(password, 10)

        const today = new Date()
        const futureDate = new Date()
        futureDate.setDate(today.getDate() + 3)

        await UserModel.create({
          email: email,
          password: hashedPassword,
          subscriptionEndAt: futureDate,
        }).then((createdUser) => {
          const token = jwt.sign(
            { userId: createdUser._id },
            process.env.TOKEN_KEY,
            {
              expiresIn: '30d',
            }
          )

          return res.send({ token: token })
        })
      }

      return res.status(400).send({ status: 'Invalid request' })
    }
  } catch (error) {
    req.app.logger.error(error)
    return res.status(400).send({ status: 'Invalid request' })
  }
})

export default router
