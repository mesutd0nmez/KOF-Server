import crypto from 'crypto'

function createHash(algorithm, value) {
  const hash = crypto.createHash(algorithm)
  hash.update(value)
  return hash.digest()
}

function encrypt(stream, key, iv) {
  const cipher = crypto.createCipheriv('aes-256-cfb', key, iv)

  return Buffer.concat([cipher.update(Buffer.from(stream)), cipher.final()])
}

function decrypt(stream, key, iv) {
  const cipher = crypto.createDecipheriv('aes-256-cfb', key, iv)

  return Buffer.concat([cipher.update(Buffer.from(stream)), cipher.final()])
}

export { createHash, encrypt, decrypt }
