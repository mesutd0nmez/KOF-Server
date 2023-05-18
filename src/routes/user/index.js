import express from 'express'

const router = express.Router()

router.get('/me', async (req, res) => {
  res.json({
    discordId: req.user.discordId,
    username: req.user.username,
    email: req.user.email,
    avatar: req.user.avatar,
  })
})

export default router
