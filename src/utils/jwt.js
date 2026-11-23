import jwt from 'jsonwebtoken'

const SECRET = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET não definido')
  return process.env.JWT_SECRET
}

export function signToken(payload) {
  return jwt.sign(payload, SECRET(), { expiresIn: '7d' })
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET())
}
