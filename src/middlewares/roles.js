// ── Guards de role para uso nas rotas ─────────────────────────
// Uso: router.get('/rota', auth, requireRole('admin'), handler)
//      router.get('/rota', auth, requireAnyRole('admin','investidor'), handler)

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ error: 'Não autenticado' })
    if (req.user.role !== role)
      return res.status(403).json({
        error: `Acesso negado. Requer perfil: ${role}`,
        code: 'FORBIDDEN',
      })
    next()
  }
}

export function requireAnyRole(...roles) {
  return (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ error: 'Não autenticado' })
    if (!roles.includes(req.user.role))
      return res.status(403).json({
        error: `Acesso negado. Requer um dos perfis: ${roles.join(', ')}`,
        code: 'FORBIDDEN',
      })
    next()
  }
}

// ── Atalhos semânticos ────────────────────────────────────────
export const isAdmin      = requireRole('admin')
export const isTomador    = requireRole('tomador')
export const isInvestidor = requireRole('investidor')
export const isStaff      = requireAnyRole('admin', 'investidor')
