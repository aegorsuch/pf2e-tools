import { createClient, type User } from '@supabase/supabase-js'
import { liveQuery } from 'dexie'
import { db } from './db'
import { applySyncedSettings, getSettings, getSettingsUpdatedAt, subscribeSettings } from './settings'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = url && key ? createClient(url, key) : null

const redirectTo = () => window.location.origin + import.meta.env.BASE_URL

export async function signInWithGitHub() {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: redirectTo() } })
  if (error) throw error
}

// Emails a one-time sign-in link; no password or third-party app registration needed.
export async function signInWithEmail(email: string) {
  const { error } = (await supabase?.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } })) ?? {}
  if (error) throw error
}

export async function signOut() {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function onAuthChange(cb: (user: User | null) => void, onError: (message: string) => void) {
  if (!supabase) return () => {}
  let live = true
  let receivedEvent = false
  // getSession() does not forward errors from the SDK's initial OAuth callback processing.
  const loadSession = async () => {
    const initialized = await supabase!.auth.initialize()
    if (initialized.error) throw initialized.error
    return supabase!.auth.getSession()
  }
  loadSession().then(({ data, error }) => {
    if (!live) return
    if (error) onError(error.message)
    else if (!receivedEvent) cb(data.session?.user ?? null)
  }).catch((error: unknown) => {
    if (live) onError(error instanceof Error ? error.message : String(error))
  })
  const { data } = supabase.auth.onAuthStateChange((_e, session) => {
    receivedEvent = true
    if (live) cb(session?.user ?? null)
  })
  return () => {
    live = false
    data.subscription.unsubscribe()
  }
}

type Table = 'characters' | 'content'

// Official (Archives of Nethys) entries are re-imported on every device, so only homebrew is synced
const OFFICIAL_PREFIX = 'aon:'

const PAGE = 1000
const CHUNK = 200

const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

// Supabase caps responses at 1000 rows, so page through id/updated_at (bodies are fetched only when needed).
async function fetchRemoteIndex(table: Table) {
  const index = new Map<string, number>()
  for (let from = 0; ; from += PAGE) {
    let q = supabase!.from(table).select('id, updated_at')
    if (table === 'content') q = q.not('id', 'like', `${OFFICIAL_PREFIX}%`)
    const { data, error } = await q.order('id').range(from, from + PAGE - 1)
    if (error) throw error
    for (const r of data ?? []) index.set(r.id as string, r.updated_at as number)
    if ((data?.length ?? 0) < PAGE) return index
  }
}

// Last-write-wins sync keyed on updatedAt. Rows are stored as { id, user_id, updated_at, body }.
async function syncTable(table: Table, userId: string) {
  if (!supabase) return
  const local = (await (table === 'characters' ? db.characters.toArray() : db.content.where('source').equals('homebrew').toArray())) as {
    id: string
    updatedAt: number
  }[]
  const remote = await fetchRemoteIndex(table)

  const toPush = local
    .filter((l) => (remote.get(l.id) ?? -1) < l.updatedAt)
    .map((l) => ({ id: l.id, user_id: userId, updated_at: l.updatedAt, body: l }))
  for (const c of chunks(toPush, CHUNK)) {
    const { error } = await supabase.from(table).upsert(c)
    if (error) throw error
  }

  const localMap = new Map(local.map((l) => [l.id, l.updatedAt]))
  const toPull = [...remote].filter(([id, at]) => (localMap.get(id) ?? -1) < at).map(([id]) => id)
  for (const c of chunks(toPull, 100)) {
    const { data, error } = await supabase.from(table).select('body').in('id', c)
    if (error) throw error
    const bodies = (data ?? []).map((r) => r.body)
    if (table === 'characters') await db.characters.bulkPut(bodies)
    else await db.content.bulkPut(bodies)
  }
}

// Backs up automatically: debounced sync after any local character/homebrew change,
// when the connection returns, and when the app regains focus.
export function startAutoSync(onStatus: (s: string) => void) {
  if (!supabase) return () => {}
  let timer: ReturnType<typeof setTimeout> | undefined
  const run = async () => {
    if (!navigator.onLine) return onStatus('Offline - will back up when online')
    try {
      onStatus('Backing up...')
      await syncAll()
      onStatus(`Backed up ${new Date().toLocaleTimeString()}`)
    } catch (e) {
      onStatus(`Backup failed: ${String(e)}`)
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
  const unsubscribeSettings = subscribeSettings(schedule)
  window.addEventListener('online', schedule)
  window.addEventListener('focus', schedule)
  // Periodic pull so an open device picks up changes made elsewhere
  const poll = setInterval(schedule, 60_000)
  return () => {
    clearInterval(poll)
    clearTimeout(timer)
    sub.unsubscribe()
    unsubscribeSettings()
    window.removeEventListener('online', schedule)
    window.removeEventListener('focus', schedule)
  }
}

// Earlier versions uploaded official entries; remove those rows (best effort)
async function purgeRemoteOfficial(userId: string) {
  await supabase!.from('content').delete().eq('user_id', userId).like('id', `${OFFICIAL_PREFIX}%`)
}

let purged = false

export async function syncUserSettings(userId: string) {
  if (!supabase) return
  const localSettings = getSettings()
  const localUpdatedAt = getSettingsUpdatedAt()
  const { data, error } = await supabase.from('user_settings')
    .select('updated_at, body')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error

  const remoteUpdatedAt = typeof data?.updated_at === 'number' ? data.updated_at : -1
  if (data && remoteUpdatedAt >= localUpdatedAt) {
    if (getSettingsUpdatedAt() === localUpdatedAt) {
      applySyncedSettings(data.body, remoteUpdatedAt)
    }
    return
  }
  if (localUpdatedAt > remoteUpdatedAt && localUpdatedAt > 0 && getSettingsUpdatedAt() === localUpdatedAt) {
    const { error: saveError } = await supabase.from('user_settings').upsert({
      user_id: userId,
      updated_at: localUpdatedAt,
      body: localSettings,
    })
    if (saveError) throw saveError
  }
}

export async function syncAll() {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Sign in before syncing')
  if (!purged) {
    await purgeRemoteOfficial(data.user.id)
    purged = true
  }
  await syncUserSettings(data.user.id)
  await syncTable('characters', data.user.id)
  await syncTable('content', data.user.id)
}
