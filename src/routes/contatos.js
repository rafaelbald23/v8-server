import { Router } from 'express'
import { auth } from '../middlewares/auth.js'
import { isTomador } from '../middlewares/roles.js'
import { listar, criar, atualizar, remover, validar } from '../controllers/contatos.controller.js'

const router = Router()

router.use(auth, isTomador)

router.get('/',          listar)
router.get('/validar',   validar)
router.post('/',         criar)
router.put('/:id',       atualizar)
router.delete('/:id',    remover)

export default router
