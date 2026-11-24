import { Router } from 'express'
import { auth } from '../middlewares/auth.js'
import { isTomador } from '../middlewares/roles.js'
import {
  statusTaxa, criarCobrancaTaxa,
  statusOrder, webhook, simularPagamento,
} from '../controllers/pagamento.controller.js'

const router = Router()

// Webhook ├® p├║blico (chamado pelo gateway externo)
router.post('/webhook', webhook)

// Rotas autenticadas do tomador
router.use(auth, isTomador)

router.get('/taxa',                     statusTaxa)
router.post('/taxa',                    criarCobrancaTaxa)
router.get('/:orderId/status',          statusOrder)
router.post('/:orderId/simular-pagamento', simularPagamento)

export default router
