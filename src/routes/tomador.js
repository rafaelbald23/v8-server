import { Router } from 'express'
import { auth } from '../middlewares/auth.js'
import { isTomador } from '../middlewares/roles.js'
import { getPerfil, upsertPerfil, getStatus } from '../controllers/tomador.controller.js'
import { listar as listarDocs, upload as uploadDoc, remover as removerDoc } from '../controllers/documentos.controller.js'
import { upload } from '../config/upload.js'
import { dashboardTomador } from '../controllers/dashboard.controller.js'

const router = Router()

// Todas as rotas exigem token válido + role tomador
router.use(auth, isTomador)

// Dashboard
router.get('/dashboard', dashboardTomador)

// Perfil
router.get('/perfil', getPerfil)
router.put('/perfil',  upsertPerfil)
router.get('/status',  getStatus)

// Documentos
router.get('/documentos',        listarDocs)
router.post('/documentos',       upload.single('arquivo'), uploadDoc)
router.delete('/documentos/:id', removerDoc)

export default router
