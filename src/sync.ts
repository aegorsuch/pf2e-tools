import { createClient } from '@supabase/supabase-js'
import { liveQuery } from 'dexie'
import { db } from './db'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = url && key ? createClient(url, key) : null

export const signInWithGoogle = () =>
  supabase?.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })

export const signOut = () => supabase?.auth.signOut()

export function onAuthChange(cb: (email: string | null) => void) {
  if (!supabase) return () => {}
  supabase.auth.getSession().then(({ data }) => cb(data.session?.user.email ?? null))
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session?.user.email ?? null))
  return () => data.subscription.unsubscribe()
}

type Table = 'characters' | 'content'

// Last-write-wins sync keyed on updatedAt. Rows are stored as { id, user_id, updated_at, body }.
async function syncTable(table: Table, userId: string) {
  if (!supabase) return
  const local = await (table === 'characters' ? db.characters : db.content).toArray()
  const { data: remote, error } = await supabase.from(table).select('id, updated_at, body')
  if (error) throw error
  const remoteMap = new Map((remote ?? []).map((r) => [r.id as string, r]))
  const toPush: object[] = []
  for (const l of local as { id: string; updatedAt: number; source?: string }[]) {
    if (table === 'content' && l.source !== 'homebrew') continue
    const r = remoteMap.get(l.id)
    if (!r || r.updated_at < l.updatedAt) toPush.push({ id: l.id, user_id: userId, updated_at: l.updatedAt, body: l })
  }
  if (toPush.length) {
    const { error: e } = await supabase.from(table).upsert(toPush)
    if (e) throw e
  }
  const localMap = new Map(local.map((l) => [l.id, l.updatedAt]))
  const pulled = (remote ?? []).filter((r) => (localMap.get(r.id) ?? -1) < r.updated_at).map((r) => r.body)
  if (pulled.length) {
    if (table === 'characters') await db.characters.bulkPut(pulled)
    else await db.content.bulkPut(pulled)
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
  window.addEventListener('online', schedule)
  window.addEventListener('focus', schedule)
  // Periodic pull so an open device picks up changes made elsewhere
  const poll = setInterval(schedule, 60_000)
  return () => {
    clearInterval(poll)
    clearTimeout(timer)
    sub.unsubscribe()
    window.removeEventListener('online', schedule)
    window.removeEventListener('focus', schedule)
  }
}

export async function syncAll() {
  if (!supabase) return
  const { data } = await supabase.auth.getUser()
  if (!data.user) return
  await syncTable('characters', data.user.id)
  await syncTable('content', data.user.id)
}
