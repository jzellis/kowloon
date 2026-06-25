// methods/utils/logger.js
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import winston from 'winston'

const { combine, timestamp, printf } = winston.format

// Plain (non-coloured) format for file transport so the file is readable
// without ANSI escape codes.
const plainFormat = printf(({ level, message, timestamp, ...meta }) => {
  const rest = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
  return `${timestamp} ${level.toUpperCase()}: ${message}${rest}`
})

// Colourised format for the console
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const rest = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
  return `${timestamp} ${level}: ${message}${rest}`
})

// Ensure the log directory exists
const LOG_DIR = process.env.LOG_DIR || join(process.cwd(), 'logs')
try {
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })
} catch { /* non-fatal — file transport will fail gracefully */ }

const LOG_FILE = join(LOG_DIR, 'app.log')

const transports = [
  new winston.transports.Console({
    format: combine(
      winston.format.colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      consoleFormat
    ),
  }),
]

// Add file transport if we can write to the log dir
try {
  transports.push(
    new winston.transports.File({
      filename: LOG_FILE,
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        plainFormat
      ),
      maxsize: 10 * 1024 * 1024,  // 10 MB — then rotate
      maxFiles: 5,
      tailable: true,             // always write to the same filename after rotation
    })
  )
} catch { /* ignore — console-only fallback */ }

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports,
})

export { LOG_FILE }
export default logger
