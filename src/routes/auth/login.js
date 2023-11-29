import express from 'express'
import UserModel from '../../models/user.js'
import jwt from 'jsonwebtoken'
import validator from 'validator'
import bcrypt from 'bcryptjs'

const router = express.Router()

router.post('/', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password)
    return res.status(400).send({ status: 'Invalid request' })

  if (!validator.isEmail(email)) {
    return res.status(400).send({ status: 'Invalid request' })
  }

  try {
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
      return res.status(400).send({ status: 'Invalid request' })
    }
  } catch (error) {
    console.error(error)
    return res.status(400).send({ status: 'Invalid request' })
  }
})

export default router
