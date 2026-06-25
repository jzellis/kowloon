// routes/admin/backup.js
// Async backup and restore endpoints. All routes require server admin auth
// (enforced by the parent router in routes/admin/index.js).

import express from 'express'
import multer from 'multer'
import { BackupJob } from '#schema'
import { getStorageAdapter } from '#methods/files/index.js'
import logger from '#methods/utils/logger.js'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 512 * 1024 * 1024 } })

// ── POST /admin/backup — queue a new backup job ───────────────────────────────

router.post('/', async (req, res) => {
  try {
    const existing = await BackupJob.findOne({ status: { $in: ['pending', 'running'] } })
    if (existing) {
      return res.status(409).json({ error: 'A backup or restore job is already in progress', job: existing })
    }

    const job = await BackupJob.create({
      type: 'backup',
      requestedBy: req.user?.id || 'unknown',
      status: 'pending',
    })

    logger.info('[admin/backup] Backup job queued', { jobId: job._id })
    return res.status(202).json({ job })
  } catch (err) {
    logger.error('[admin/backup] Failed to queue backup', { error: err.message })
    return res.status(500).json({ error: err.message })
  }
})

// ── GET /admin/backup — list backup jobs ─────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const jobs = await BackupJob.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
    return res.json({ jobs })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// ── GET /admin/backup/:id — get single job status ────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const job = await BackupJob.findById(req.params.id).lean()
    if (!job) return res.status(404).json({ error: 'Job not found' })
    return res.json({ job })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// ── GET /admin/backup/:id/download — stream archive from S3 ──────────────────

router.get('/:id/download', async (req, res) => {
  try {
    const job = await BackupJob.findById(req.params.id).lean()
    if (!job) return res.status(404).json({ error: 'Job not found' })
    if (job.status !== 'done' || !job.archiveKey) {
      return res.status(409).json({ error: 'Archive not ready' })
    }

    const storage = await getStorageAdapter()
    const stream = await storage.getStream(job.archiveKey)

    const filename = job.archiveName || `kowloon-backup-${job._id}.tar.gz`
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/gzip')

    stream.pipe(res)
    stream.on('error', (err) => {
      logger.error('[admin/backup] Stream error on download', { error: err.message })
      if (!res.headersSent) res.status(500).end()
    })
  } catch (err) {
    logger.error('[admin/backup] Download failed', { error: err.message })
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
})

// ── DELETE /admin/backup/:id — delete job record and archive from S3 ─────────

router.delete('/:id', async (req, res) => {
  try {
    const job = await BackupJob.findById(req.params.id).lean()
    if (!job) return res.status(404).json({ error: 'Job not found' })

    if (job.archiveKey) {
      try {
        const storage = await getStorageAdapter()
        await storage.delete(job.archiveKey)
      } catch (err) {
        logger.warn('[admin/backup] Failed to delete archive from S3', { error: err.message })
      }
    }

    await BackupJob.findByIdAndDelete(job._id)
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// ── POST /admin/backup/restore — upload archive and queue restore job ─────────

router.post('/restore', upload.single('archive'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No archive file uploaded' })

    const existing = await BackupJob.findOne({ status: { $in: ['pending', 'running'] } })
    if (existing) {
      return res.status(409).json({ error: 'A backup or restore job is already in progress', job: existing })
    }

    // Upload archive to S3 at a temp key so the worker can retrieve it
    const storage = await getStorageAdapter()
    const ts = Date.now()
    const archiveKey = `_restore-tmp/${ts}-${req.file.originalname || 'archive.tar.gz'}`

    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    await storage.client.send(new PutObjectCommand({
      Bucket: storage.bucket,
      Key: archiveKey,
      Body: req.file.buffer,
      ContentType: 'application/gzip',
    }))

    const job = await BackupJob.create({
      type: 'restore',
      requestedBy: req.user?.id || 'unknown',
      status: 'pending',
      archiveKey,
      archiveName: req.file.originalname || 'archive.tar.gz',
    })

    logger.info('[admin/backup] Restore job queued', { jobId: job._id, archiveKey })
    return res.status(202).json({ job })
  } catch (err) {
    logger.error('[admin/backup] Failed to queue restore', { error: err.message })
    return res.status(500).json({ error: err.message })
  }
})

export default router
