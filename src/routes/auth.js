import { Router } from 'express'
import { register, login, me, logout } from '../controllers/auth.controller.js'
import { auth } from '../middlewares/auth.js'

const router = Router()

// POST /api/auth/register — cadastro de tomador ou investidor
router.post('/register', register)

// POST /api/auth/login — login com email/senha
router.post('/login', login)

// GET /api/auth/me — retorna dados do usuário autenticado
router.get('/me', auth, me)

// POST /api/auth/logout — invalida sessão no client
router.post('/logout', auth, logout)

export default router
