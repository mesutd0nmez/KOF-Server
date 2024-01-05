import UserModel from '../models/user.js'
import jwt from 'jsonwebtoken'

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res
      .status(403)
      .json({ message: 'A token is required for authentication' })
  }

  try {
    const decoded = await jwt.verify(token, process.env.TOKEN_KEY)
    const user = await UserModel.findOne({ _id: decoded.userId })

    if (!user) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    if (user.email != process.env.MASTER_USER) {
      if (user.admin !== 1) {
        return res
          .status(401)
          .json({ message: 'You are not authorized for this action' })
      }
    }

    req.user = user
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' })
  }

  next()
}

export default verifyToken
