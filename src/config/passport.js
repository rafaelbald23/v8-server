import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { Strategy as FacebookStrategy } from 'passport-facebook'
import pool from './db.js'

// ── Utilitário: upsert de usuário social ──────────────────────
async function findOrCreateSocialUser({ provider, providerId, name, email, avatarUrl }) {
  // 1. Busca por provider + providerId
  const byProvider = await pool.query(
    `SELECT u.* FROM users u
     JOIN social_accounts sa ON sa.user_id = u.id
     WHERE sa.provider = $1 AND sa.provider_id = $2`,
    [provider, providerId]
  )
  if (byProvider.rows.length > 0) return byProvider.rows[0]

  // 2. Busca por email (vincula conta existente)
  if (email) {
    const byEmail = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    )
    if (byEmail.rows.length > 0) {
      const user = byEmail.rows[0]
      await pool.query(
        `INSERT INTO social_accounts (user_id, provider, provider_id, avatar_url)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [user.id, provider, providerId, avatarUrl]
      )
      return user
    }
  }

  // 3. Cria novo usuário
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, ativo, status, avatar_url)
     VALUES ($1, $2, $3, 'tomador', false, 'pendente', $4)
     RETURNING *`,
    [name, email ? email.toLowerCase().trim() : null, 'SOCIAL_LOGIN_NO_PASSWORD', avatarUrl]
  )
  const newUser = result.rows[0]

  await pool.query(
    `INSERT INTO social_accounts (user_id, provider, provider_id, avatar_url)
     VALUES ($1, $2, $3, $4)`,
    [newUser.id, provider, providerId, avatarUrl]
  )

  return newUser
}

// ── Google Strategy ───────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  `${process.env.API_URL}/api/auth/google/callback`,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await findOrCreateSocialUser({
            provider:   'google',
            providerId: profile.id,
            name:       profile.displayName,
            email:      profile.emails?.[0]?.value,
            avatarUrl:  profile.photos?.[0]?.value,
          })
          done(null, user)
        } catch (e) {
          done(e)
        }
      }
    )
  )
}

// ── Facebook Strategy ─────────────────────────────────────────
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID:     process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL:  `${process.env.API_URL}/api/auth/facebook/callback`,
        profileFields: ['id', 'displayName', 'emails', 'photos'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await findOrCreateSocialUser({
            provider:   'facebook',
            providerId: profile.id,
            name:       profile.displayName,
            email:      profile.emails?.[0]?.value,
            avatarUrl:  profile.photos?.[0]?.value,
          })
          done(null, user)
        } catch (e) {
          done(e)
        }
      }
    )
  )
}

export default passport
