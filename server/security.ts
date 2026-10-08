import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Dpapi, isPlatformSupported } from '@primno/dpapi'

export const dataDir = process.env.WEE_CHECK_DATA_DIR || join(process.env.LOCALAPPDATA || process.cwd(), 'WeeCheck')
mkdirSync(dataDir, { recursive: true })

const keyPath = join(dataDir, 'master-key.bin')
function loadKey() {
  if (existsSync(keyPath)) {
    const protectedKey = readFileSync(keyPath)
    return isPlatformSupported ? Buffer.from(Dpapi.unprotectData(protectedKey, null, 'CurrentUser')) : protectedKey
  }
  const key = randomBytes(32)
  const stored = isPlatformSupported ? Buffer.from(Dpapi.protectData(key, null, 'CurrentUser')) : key
  writeFileSync(keyPath, stored, { mode: 0o600 })
  return key
}

const key = loadKey()
export function encryptText(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${body.toString('base64url')}`
}
export function decryptText(value: string) {
  const [iv, tag, body] = value.split('.').map(item => Buffer.from(item, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
}
export function blindIndex(value: string) {
  return createHmac('sha256', key).update(value.normalize('NFC').trim().toLowerCase()).digest('hex')
}
export function encryptBytes(value: Buffer) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  return Buffer.concat([Buffer.from('WCB1'), iv, cipher.update(value), cipher.final(), cipher.getAuthTag()])
}
export function decryptBytes(value: Buffer) {
  if (value.subarray(0, 4).toString() !== 'WCB1') throw new Error('올바른 Wee Check 백업 파일이 아닙니다.')
  const iv = value.subarray(4, 16)
  const tag = value.subarray(value.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(value.subarray(16, -16)), decipher.final()])
}
