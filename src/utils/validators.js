// ── Validadores reutilizáveis ─────────────────────────────────

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

export function isValidPassword(password) {
  // Mínimo 8 chars, ao menos 1 letra e 1 número
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password)
  )
}

export function sanitizeEmail(email) {
  return String(email).toLowerCase().trim()
}
