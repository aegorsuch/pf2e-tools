import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { db, newId, removeEntry, saveEntry } from './db'
import { CharacterBuilder } from './CharacterBuilder'
import { EffectsEditor } from './EffectsEditor'
import { ensureAonImported } from './aon'
import { onAuthChange, signInWithEmail, signInWithGitHub, signOut, startAutoSync, supabase } from './sync'
import type { ContentEntry, EntryKind, GameSystem } from './types'
import './App.css'

const KINDS: EntryKind[] = ['feat', 'weapon', 'armor', 'spell', 'item', 'ancestry', 'class', 'armorGroup', 'weaponGroup', 'background', 'heritage', 'deity']
const SYSTEMS: { id: GameSystem; label: string }[] = [
  { id: 'pf2e', label: 'Pathfinder 2e' },
  { id: 'sf2e', label: 'Starfinder 2e' },
]

const toggle = (list: GameSystem[], s: GameSystem) =>
  list.includes(s) ? list.filter((x) => x !== s) : [...list, s]

const ENABLED_KEY = 'enabled-systems'
const ALL_SYSTEMS = SYSTEMS.map((s) => s.id)

// Both systems are on by default; an explicit opt-out is remembered
function loadEnabled(): GameSystem[] {
  try {
    const saved = JSON.parse(localStorage.getItem(ENABLED_KEY) ?? 'null') as unknown
    if (Array.isArray(saved)) return ALL_SYSTEMS.filter((s) => saved.includes(s))
  } catch { /* fall back to default */ }
  return ALL_SYSTEMS
}

const blank = (systems: GameSystem[]): ContentEntry => ({
  id: newId(), systems, kind: 'feat', source: 'homebrew', name: '', level: 1,
  traits: [], description: '', data: {}, effects: [], updatedAt: 0,
})

function EditIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
  </svg>
}

function DeleteIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4h8v2m-11 0 1 14h10l1-14M10 11v5m4-5v5" />
  </svg>
}

export default function App() {
  const [enabled, setEnabled] = useState<GameSystem[]>(loadEnabled)
  useEffect(() => localStorage.setItem(ENABLED_KEY, JSON.stringify(enabled)), [enabled])
  const [draft, setDraft] = useState<ContentEntry | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showOfficial, setShowOfficial] = useState(false)
  const [status, setStatus] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [authError, setAuthError] = useState('')
  const userId = user?.id
  useEffect(() => onAuthChange(setUser, setAuthError), [])
  // Start backups only once signed in; the first run also pulls data from other devices
  useEffect(() => (userId ? startAutoSync(setStatus) : undefined), [userId])
  // Official content is part of the app: load it in the background for enabled systems
  useEffect(() => {
    let live = true
    ;(async () => {
      for (const sys of enabled) {
        try {
          const n = await ensureAonImported(sys, (c) => live && setStatus(`Loading ${sys} content: ${c}`))
          if (live && n) setStatus(`Loaded ${n} ${sys} entries from Archives of Nethys`)
        } catch (err) {
          if (live) setStatus(`Could not load ${sys} content (${err instanceof Error ? err.message : err}); using saved data`)
        }
      }
    })()
    return () => { live = false }
  }, [enabled])
  const characters = useLiveQuery(() => db.characters.filter((c) => !c.deleted).toArray(), [])
  const entries = useLiveQuery(
    () => db.content.filter((e) => !e.deleted && e.systems.some((s) => enabled.includes(s))).toArray(),
    [enabled],
  )

  const official = entries?.filter((e) => e.source === 'official') ?? []
  const homebrew = entries?.filter((e) => e.source === 'homebrew') ?? []
  const sortedCharacters = [...(characters ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  const newCharacter = async () => {
    const name = window.prompt('Character name?')?.trim()
    if (!name) return
    const id = newId()
    await db.characters.put({
      id, systems: enabled, name, level: 1,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      boosts: {}, feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [],
      updatedAt: Date.now(),
    })
    setEditingId(id)
  }

  return (
    <main>
      <h1>PF2E Tools</h1>
      <div className="row">
        {SYSTEMS.map((s) => (
          <label key={s.id}>
            <input type="checkbox" checked={enabled.includes(s.id)}
              onChange={() => setEnabled(toggle(enabled, s.id))} />
            {s.label}
          </label>
        ))}
        {supabase && (user
          ? <button onClick={async () => {
            try { await signOut(); setAuthError('') } catch (e) { setAuthError(String(e)) }
          }}>Sign out ({user.email ?? user.id})</button>
          : (
            <>
              <button onClick={async () => {
                setAuthError('')
                try { await signInWithGitHub() } catch (e) { setAuthError(String(e)) }
              }}>Sign in with GitHub</button>
              <button onClick={async () => {
                const addr = window.prompt('Email address for a sign-in link?')?.trim()
                if (!addr) return
                try { await signInWithEmail(addr); setStatus('Check your email for the sign-in link') } catch (e) { setStatus(String(e)) }
              }}>Email me a sign-in link</button>
            </>
          ))}
        <span>{status || (supabase ? '' : 'Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to enable sync')}</span>
        {authError && <span role="alert">Sign-in error: {authError}</span>}
      </div>

      {draft && (
        <form className="col" onSubmit={async (e) => { e.preventDefault(); await saveEntry(draft); setDraft(null) }}>
          <div className="row">
            {SYSTEMS.map((s) => (
              <label key={s.id}>
                <input type="checkbox" checked={draft.systems.includes(s.id)}
                  onChange={() => setDraft({ ...draft, systems: toggle(draft.systems, s.id) })} />
                {s.label}
              </label>
            ))}
          </div>
          <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as EntryKind })}>
            {KINDS.map((k) => <option key={k}>{k}</option>)}
          </select>
          <input required placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input type="number" min={0} max={20} value={draft.level} onChange={(e) => setDraft({ ...draft, level: +e.target.value })} />
          <input placeholder="Traits (comma separated)" value={draft.traits.join(', ')}
            onChange={(e) => setDraft({ ...draft, traits: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
          <textarea placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          {draft.kind === 'feat' && <label>
            <input type="checkbox" checked={draft.data.repeatable === true}
              onChange={(e) => setDraft({ ...draft, data: { ...draft.data, repeatable: e.target.checked } })} /> Repeatable feat
          </label>}
          <EffectsEditor effects={draft.effects} onChange={(effects) => setDraft({ ...draft, effects })} />
          {(draft.kind === 'armor' || draft.kind === 'weapon') && (
            <select value={String(draft.data.group ?? '')}
              onChange={(e) => setDraft({ ...draft, data: { ...draft.data, group: e.target.value } })}>
              <option value="">No {draft.kind} group</option>
              {entries?.filter((g) => g.kind === `${draft.kind}Group`).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <div className="row">
            <button disabled={!draft.systems.length}>Save</button>
            <button type="button" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </form>
      )}

      {characters?.find((c) => c.id === editingId) && (
        <CharacterBuilder character={characters.find((c) => c.id === editingId)!} onClose={() => setEditingId(null)} />
      )}

      <h2>
        Characters{' '}
        <button type="button" title="New character" aria-label="New character" onClick={newCharacter}>+</button>
      </h2>
      <ul className="character-list">
        {sortedCharacters.map((c) => (
          <li className="character-row" key={c.id}>
            <span><b>{c.name}</b> - L{c.level} {c.ancestry} {c.className}</span>
            <span className="character-actions">
              <button type="button" className="icon-button" title="Edit character" aria-label={`Edit ${c.name}`}
                onClick={() => setEditingId(c.id)}><EditIcon /></button>
              <button type="button" className="icon-button" title="Delete character" aria-label={`Delete ${c.name}`}
                onClick={() => db.characters.put({ ...c, deleted: true, updatedAt: Date.now() })}><DeleteIcon /></button>
            </span>
          </li>
        ))}
      </ul>
      <details onToggle={(e) => setShowOfficial(e.currentTarget.open)}>
        <summary><h2 style={{ display: 'inline' }}>AON Content ({official.length})</h2></summary>
        <ul>
          {showOfficial && official.map((e) => (
            <li key={e.id}>
              <b>{e.name}</b> ({e.kind} {e.level}) [{e.systems.join('+')}] {e.traits.join(', ')}
            </li>
          ))}
        </ul>
      </details>

      <div className="row">
        <h2>Homebrew Content ({homebrew.length})</h2>
        <button type="button" title="Add homebrew content" aria-label="Add homebrew content"
          onClick={() => setDraft(blank(enabled))}>+</button>
      </div>
      <ul>
        {homebrew.map((e) => (
          <li key={e.id}>
            <b>{e.name}</b> ({e.kind} {e.level}) [{e.systems.join('+')}] {e.traits.join(', ')}{' '}
            <button onClick={() => setDraft(e)}>Edit</button>
            <button onClick={() => removeEntry(e.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </main>
  )
}
