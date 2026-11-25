import { Router } from 'express'
import { auth } from '../middlewares/auth.js'
import { isInvestidor } from '../middlewares/roles.js'
import { requireAtivo } from '../middlewares/requireAtivo.js'
import { getPerfil, upsertPerfil, getResumo } from '../controllers/investidor.controller.js'

const router = Router()

router.use(auth, requireAtivo, isInvestidor)

router.get('/perfil',  getPerfil)
router.put('/perfil',  upsertPerfil)
router.get('/resumo',  getResumo)

export default router
