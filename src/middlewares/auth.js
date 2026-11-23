import { verifyToken } from '../utils/jwt.js'

// ── Verifica JWT no header Authorization: Bearer <token> ──────
export function auth(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token não fornecido' })

  const token = header.split(' ')[1]
  try {
    req.user = verifyToken(token)
    next()
  } catch (e) {
    if (e.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' })
    return res.status(401).json({ error: 'Token inválido' })
  }
}

// ── Exige role admin ──────────────────────────────────────────
export function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Acesso restrito ao administrador' })
  next()
}

// ── Exige uma das roles passadas ──────────────────────────────
export function roleIn(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role))
      return res.status(403).json({ error: `Acesso negado para o perfil: ${req.user?.role}` })
    next()
  }
}
