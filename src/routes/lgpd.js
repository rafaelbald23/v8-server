import { Router } from 'express'
import { auth } from '../middlewares/auth.js'
import { isTomador, isInvestidor, isAdmin, requireAnyRole } from '../middlewares/roles.js'
import {
  listar, registrar, revogar, status,
} from '../controllers/lgpd.controller.js'

const router = Router()

router.use(auth)

// Qualquer role pode consultar/registrar seus consentimentos
router.get('/status',  requireAnyRole('tomador','investidor','admin'), status)
router.get('/',        requireAnyRole('tomador','investidor','admin'), listar)
router.post('/',       requireAnyRole('tomador','investidor','admin'), registrar)
router.delete('/:tipo', requireAnyRole('tomador','investidor'),        revogar)

export default router
