import { createClient } from '@supabase/supabase-js'
import { liveQuery } from 'dexie'
import { db } from './db'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = url && key ? createClient(url, key) : null

export const signInWithGoogle = () =>
  supabase?.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + import.meta.env.BASE_URL } })

export const signOut = () => supabase?.auth.signOut()

export function onAuthChange(cb: (email: string | null) => void) {
  if (!supabase) return () => {}
  supabase.auth.getSession().then(({ data }) => cb(data.session?.user.email ?? null))
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session?.user.email ?? null))
  return () => data.subscription.unsubscribe()
}

type Table = 'characters' | 'content'

const PAGE = 1000
const CHUNK = 200

const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

// Supabase caps responses at 1000 rows, so page through id/updated_at (bodies are fetched only when needed).
async function fetchRemoteIndex(table: Table) {
  const index = new Map<string, number>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!.from(table).select('id, updated_at').order('id').range(from, from + PAGE - 1)
    if (error) throw error
    for (const r of data ?? []) index.set(r.id as string, r.updated_at as number)
    if ((data?.length ?? 0) < PAGE) return index
  }
}

// Last-write-wins sync keyed on updatedAt. Rows are stored as { id, user_id, updated_at, body }.
// Content includes official (Archives of Nethys) entries as well as homebrew.
async function syncTable(table: Table, userId: string) {
  if (!supabase) return
  const local = (await (table === 'characters' ? db.characters : db.content).toArray()) as { id: string; updatedAt: number }[]
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
