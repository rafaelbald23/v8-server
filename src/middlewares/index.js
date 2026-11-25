// ── Barrel de middlewares — importação centralizada ───────────
export { auth, adminOnly, roleIn } from './auth.js'
export { requireRole, requireAnyRole, isAdmin, isTomador, isInvestidor, isStaff } from './roles.js'
export { requireAtivo } from './requireAtivo.js'
