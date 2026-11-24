import { Router } from 'express'
import { auth } from '../middlewares/auth.js'
import { isAdmin } from '../middlewares/roles.js'
import { requireAtivo } from '../middlewares/requireAtivo.js'
import { atualizarStatus } from '../controllers/documentos.controller.js'

const router = Router()

router.use(auth, requireAtivo, isAdmin)

// PATCH /api/admin/documentos/:id/status — aprova ou rejeita documento
router.patch('/documentos/:id/status', atualizarStatus)

export default router
