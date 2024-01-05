import express from 'express'

const router = express.Router()

router.put('/ip', async (req, res) => {
  try {
    const server = req.app.server
    const { ip } = req.body

    if (!server.ipBlock.has(ip)) {
      server.ipBlock.add(ip)
      res.send({ status: `${ip} is added blocked ip list` })
    } else {
      res.send({ status: `${ip} is already exist in blocked ip list` })
    }
  } catch (error) {
    req.app.logger.error(error)
    return res.status(400).send({ status: 'Invalid request' })
  }
})

router.delete('/ip', async (req, res) => {
  try {
    const server = req.app.server
    const { ip } = req.body

    if (server.ipBlock.has(ip)) {
      server.ipBlock.delete(ip)
      res.send({ status: `${ip} is removed in blocked ip list` })
    } else {
      res.send({ status: `${ip} is not in blocked ip list` })
    }
  } catch (error) {
    req.app.logger.error(error)
    return res.status(400).send({ status: 'Invalid request' })
  }
})

router.post('/ip', async (req, res) => {
  try {
    const server = req.app.server
    const lastIpBlockSize = server.ipBlock.size

    server.ipBlock.clear()

    res.send({
      status: `List was cleared, there were ${lastIpBlockSize}`,
    })
  } catch (error) {
    req.app.logger.error(error)
    return res.status(400).send({ status: 'Invalid request' })
  }
})

export default router
