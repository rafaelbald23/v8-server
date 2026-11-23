import { Router } from 'express'
import passport from '../config/passport.js'
import { signToken } from '../utils/jwt.js'

const router = Router()

// ── Helper: redireciona para o frontend com token ou erro ─────
function redirectWithToken(res, user) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
  if (!user) return res.redirect(`${clientUrl}/login?error=social_login_failed`)

  const token = signToken({
    id:    user.id,
    role:  user.role,
    name:  user.name,
    email: user.email,
  })

  // Redireciona para o frontend com o token na query string
  // O frontend captura, salva no localStorage e redireciona para o dashboard
  res.redirect(`${clientUrl}/auth/callback?token=${token}`)
}

// ── Google ────────────────────────────────────────────────────
router.get(
  '/google',
  (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID)
      return res.status(503).json({ error: 'Login com Google não configurado', code: 'SOCIAL_NOT_CONFIGURED' })
    next()
  },
  passport.authenticate('google', { session: false, scope: ['profile', 'email'] })
)

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => redirectWithToken(res, req.user)
)

// ── Facebook ──────────────────────────────────────────────────
router.get(
  '/facebook',
  (req, res, next) => {
    if (!process.env.FACEBOOK_APP_ID)
      return res.status(503).json({ error: 'Login com Facebook não configurado', code: 'SOCIAL_NOT_CONFIGURED' })
    next()
  },
  passport.authenticate('facebook', { session: false, scope: ['email'] })
)

router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: '/login' }),
  (req, res) => redirectWithToken(res, req.user)
)

// ── Apple ─────────────────────────────────────────────────────
// Apple usa POST no callback e requer configuração adicional (Team ID, Key ID, .p8)
// Implementação completa quando as credenciais Apple estiverem disponíveis
router.get('/apple', (_req, res) => {
  if (!process.env.APPLE_CLIENT_ID)
    return res.status(503).json({ error: 'Login com Apple não configurado', code: 'SOCIAL_NOT_CONFIGURED' })
  res.status(501).json({ error: 'Apple Sign In: aguardando credenciais' })
})

export default router
