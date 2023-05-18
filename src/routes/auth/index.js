import express from 'express'
import { request } from 'undici'
import UserModel from '../../models/user.js'
import jwt from 'jsonwebtoken'

const router = express.Router()

router.get('/authorize', async (req, res) => {
  const { code } = req.query

  if (!code) return res.status(400).send()

  try {
    const tokenResponseData = await request(
      'https://discord.com/api/oauth2/token',
      {
        method: 'POST',
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: process.env.DISCORD_AUTH_REDIRECT_URI,
          scope: 'identify',
        }).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    const oauthData = await tokenResponseData.body.json()

    if (oauthData.error) {
      console.info(`Error: ${oauthData.error}`)
      console.info(`Description: ${oauthData.error_description}`)
      return res.status(400).send()
    }

    fetch('https://discord.com/api/users/@me', {
      headers: {
        authorization: `${oauthData.token_type} ${oauthData.access_token}`,
      },
    })
      .then((result) => result.json())
      .then(async (response) => {
        const { id, username, email, avatar } = response

        await UserModel.findOneAndUpdate(
          {
            discordId: id,
          },
          {
            username: username,
            email: email,
            avatar: avatar,
            accessToken: oauthData.access_token,
            expiresIn: oauthData.expires_in,
            refreshToken: oauthData.refresh_token,
            scope: oauthData.scope,
            tokenType: oauthData.token_type,
          },
          { upsert: true, returnDocument: 'after' }
        ).then(async (user) => {
          const token = jwt.sign({ id: user._id }, process.env.TOKEN_KEY, {
            expiresIn: '365d',
          })
          res.redirect(301, `http://127.0.0.1:5173/authorize?token=${token}`)
        })
      })
      .catch(console.error)
  } catch (error) {
    console.error(error)
    return res.status(401).send()
  }
})

export default router
