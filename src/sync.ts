import { liveQuery } from 'dexie'
import { db } from './db'
import type { Character, ContentEntry } from './types'

// Google Drive sync via the hidden per-app "appDataFolder" (scope drive.appdata: no Google review needed).
// The user's data lives in their own Drive; there is no server.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const CONNECTED_KEY = 'drive-connected'

export const driveConfigured = !!CLIENT_ID

interface TokenResponse { access_token?: string; expires_in?: number; error?: string }
interface TokenClient { requestAccessToken: (o?: { prompt?: string }) => void }
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (c: {
            client_id: string
            scope: string
            callback: (r: TokenResponse) => void
            error_callback: (e: { type: string }) => void
          }) => TokenClient
          revoke: (token: string, done?: () => void) => void
        }
      }
    }
  }
}

export class NeedsReconnect extends Error {
  constructor() {
    super('Google Drive needs reconnecting')
  }
}

let gisPromise: Promise<void> | undefined
const loadGis = () =>
  (gisPromise ??= new Promise<void>((resolve, reject) => {
    const s = Object.assign(document.createElement('script'), {
      src: 'https://accounts.google.com/gsi/client',
      async: true,
      onload: () => resolve(),
      onerror: () => reject(new Error('Could not load Google sign-in (offline?)')),
    })
    document.head.appendChild(s)
  }).catch((e) => {
    gisPromise = undefined
    throw e
  }))

let token: { value: string; expires: number } | null = null

async function requestToken(prompt: '' | 'consent'): Promise<string> {
  await loadGis()
  return new Promise((resolve, reject) => {
    window.google!.accounts.oauth2
      .initTokenClient({
        client_id: CLIENT_ID!,
        scope: SCOPE,
        callback: (r) => {
          if (!r.access_token) return reject(new NeedsReconnect())
          token = { value: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000 - 60_000 }
          resolve(r.access_token)
        },
        error_callback: () => reject(new NeedsReconnect()),
      })
      .requestAccessToken({ prompt })
  })
}

// Silent refresh works without a popup once the user has consented; otherwise the user must click Connect.
async function getToken(interactive: boolean): Promise<string> {
  if (token && token.expires > Date.now()) return token.value
  return requestToken(interactive && !localStorage.getItem(CONNECTED_KEY) ? 'consent' : '')
}

const listeners = new Set<(connected: boolean) => void>()
const notify = () => listeners.forEach((l) => l(!!localStorage.getItem(CONNECTED_KEY)))

export function onAuthChange(cb: (connected: boolean) => void) {
  listeners.add(cb)
  cb(!!localStorage.getItem(CONNECTED_KEY))
  return () => void listeners.delete(cb)
}

export async function connectDrive() {
  await getToken(true)
  localStorage.setItem(CONNECTED_KEY, '1')
  notify()
}

export function disconnectDrive() {
  if (token) window.google?.accounts.oauth2.revoke(token.value)
  token = null
  localStorage.removeItem(CONNECTED_KEY)
  notify()
}

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

async function drive(url: string, tok: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${tok}`, ...init.headers } })
  if (res.status === 401) {
    token = null
    throw new NeedsReconnect()
  }
  if (!res.ok) throw new Error(`Drive ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res
}

interface Meta { id: string; version: string }

async function findFile(name: string, tok: string): Promise<Meta | null> {
  const q = encodeURIComponent(`name='${name}' and trashed=false`)
  const res = await drive(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,version)`, tok)
  return ((await res.json()) as { files: Meta[] }).files[0] ?? null
}

async function upload(name: string, meta: Meta | null, body: string, tok: string): Promise<Meta> {
  const fields = 'id,version'
  if (meta) {
    const res = await drive(`${UPLOAD}/files/${meta.id}?uploadType=media&fields=${fields}`, tok, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    return (await res.json()) as Meta
  }
  const boundary = `b${Date.now()}`
  const multipart =
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    JSON.stringify({ name, parents: ['appDataFolder'] }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`
  const res = await drive(`${UPLOAD}/files?uploadType=multipart&fields=${fields}`, tok, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  })
  return (await res.json()) as Meta
}

interface Rec { id: string; updatedAt: number }
interface Store {
  name: string
  read: () => Promise<Rec[]>
  write: (r: Rec[]) => Promise<unknown>
}

const stores: Store[] = [
  {
    name: 'characters.json',
    read: () => db.characters.toArray(),
    write: (r) => db.characters.bulkPut(r as Character[]),
  },
  {
    name: 'homebrew.json',
    read: () => db.content.where('source').equals('homebrew').toArray(),
    write: (r) => db.content.bulkPut(r as ContentEntry[]),
  },
  {
    // Official (Archives of Nethys) entries sync too; the version check below skips re-downloading it.
    name: 'official.json',
    read: () => db.content.where('source').equals('official').toArray(),
    write: (r) => db.content.bulkPut(r as ContentEntry[]),
  },
]

// Last-write-wins per record on updatedAt. Remote is only downloaded when its Drive version changed.
async function syncStore(store: Store, tok: string) {
  const seenKey = `drive-version:${store.name}`
  const pushedKey = `drive-pushed:${store.name}`
  for (let attempt = 0; attempt < 3; attempt++) {
    const startedAt = Date.now()
    const meta = await findFile(store.name, tok)
    const seen = localStorage.getItem(seenKey)
    const lastPushed = Number(localStorage.getItem(pushedKey) ?? 0)

    let remote: Map<string, number> | null = null
    if (meta && meta.version !== seen) {
      const recs = (await (await drive(`${API}/files/${meta.id}?alt=media`, tok)).json()) as Rec[]
      remote = new Map(recs.map((r) => [r.id, r.updatedAt]))
      const localMap = new Map((await store.read()).map((r) => [r.id, r.updatedAt]))
      const newer = recs.filter((r) => (localMap.get(r.id) ?? -1) < r.updatedAt)
      if (newer.length) await store.write(newer)
    }

    const local = await store.read()
    const needsUpload = !meta
      ? true
      : remote
        ? local.some((r) => (remote.get(r.id) ?? -1) < r.updatedAt)
        : local.some((r) => r.updatedAt > lastPushed)

    if (!needsUpload) {
      if (meta) localStorage.setItem(seenKey, meta.version)
      localStorage.setItem(pushedKey, String(startedAt))
      return
    }

    // Another device may have uploaded since we read; if so, merge again before overwriting.
    const current = await findFile(store.name, tok)
    if ((current?.version ?? null) !== (meta?.version ?? null)) continue

    const saved = await upload(store.name, meta, JSON.stringify(local), tok)
    localStorage.setItem(seenKey, saved.version)
    localStorage.setItem(pushedKey, String(startedAt))
    return
  }
  throw new Error(`Could not sync ${store.name}: it keeps changing on another device`)
}

export async function syncAll(interactive = false) {
  if (!driveConfigured) return
  const tok = await getToken(interactive)
  localStorage.setItem(CONNECTED_KEY, '1')
  for (const store of stores) await syncStore(store, tok)
}

// Backs up automatically: debounced sync after any local character/homebrew change,
// when the connection returns, when the app regains focus, and once a minute.
export function startAutoSync(onStatus: (s: string) => void) {
  if (!driveConfigured) return () => {}
  let timer: ReturnType<typeof setTimeout> | undefined
  const run = async () => {
    if (!navigator.onLine) return onStatus('Offline - will back up when online')
    try {
      onStatus('Backing up...')
      await syncAll()
      onStatus(`Backed up ${new Date().toLocaleTimeString()}`)
    } catch (e) {
      onStatus(e instanceof NeedsReconnect ? 'Click Sync to reconnect Google Drive' : `Backup failed: ${String(e)}`)
    }
  }
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(run, 2000)
  }
  const sub = liveQuery(async () => [
    await db.characters.orderBy('updatedAt').last(),
    await db.content.orderBy('updatedAt').last(),
  ]).subscribe({ next: schedule })
  window.addEventListener('online', schedule)
  window.addEventListener('focus', schedule)
  const poll = setInterval(schedule, 60_000)
  return () => {
    clearInterval(poll)
    clearTimeout(timer)
    sub.unsubscribe()
    window.removeEventListener('online', schedule)
    window.removeEventListener('focus', schedule)
  }
}
