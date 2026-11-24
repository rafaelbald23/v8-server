import multer from 'multer'
import path from 'path'
import { mkdirSync } from 'fs'

// ÔöÇÔöÇ Armazenamento local (disco) ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
// Em produ├º├úo: trocar pelo storage do Railway / S3 / Cloudflare R2
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads'

// Garante que a pasta existe
mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userDir = path.join(UPLOAD_DIR, req.user.id)
    mkdirSync(userDir, { recursive: true })
    cb(null, userDir)
  },
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase()
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
    cb(null, name)
  },
})

function fileFilter(_req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (allowed.includes(file.mimetype)) cb(null, true)
  else cb(new Error('Tipo de arquivo n├úo permitido. Use JPG, PNG, WEBP ou PDF'), false)
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
})
