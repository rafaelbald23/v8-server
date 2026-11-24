import { Router } from 'express'
import { auth } from '../middlewares/auth.js'
import { isTomador } from '../middlewares/roles.js'
import { requireAtivo } from '../middlewares/requireAtivo.js'
import { getPerfil, upsertPerfil, getStatus } from '../controllers/tomador.controller.js'

const router = Router()

// Todas as rotas exigem token válido + role tomador
// Nota: requireAtivo não é aplicado aqui pois tomador pode
// acessar o perfil mesmo antes de pagar a taxa (status pendente)
router.use(auth, isTomador)

router.get('/perfil', getPerfil)
router.put('/perfil', upsertPerfil)
router.get('/status', getStatus)

export default router
