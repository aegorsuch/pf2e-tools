import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, exportHomebrew, importHomebrew, newId, removeEntry, saveEntry } from './db'
import { EffectsEditor } from './EffectsEditor'
import { onAuthChange, signInWithGoogle, signOut, startAutoSync, syncAll, supabase } from './sync'
import type { ContentEntry, EntryKind, GameSystem } from './types'
import './App.css'

const KINDS: EntryKind[] = ['feat', 'weapon', 'armor', 'spell', 'item', 'ancestry', 'class', 'armorGroup', 'weaponGroup']
const SYSTEMS: { id: GameSystem; label: string }[] = [
  { id: 'pf2e', label: 'Pathfinder 2e' },
  { id: 'sf2e', label: 'Starfinder 2e' },
]

const toggle = (list: GameSystem[], s: GameSystem) =>
  list.includes(s) ? list.filter((x) => x !== s) : [...list, s]

const blank = (systems: GameSystem[]): ContentEntry => ({
  id: newId(), systems, kind: 'feat', source: 'homebrew', name: '', level: 1,
  traits: [], description: '', data: {}, effects: [], updatedAt: 0,
})

export default function App() {
  const [enabled, setEnabled] = useState<GameSystem[]>(['pf2e'])
  const [draft, setDraft] = useState<ContentEntry | null>(null)
  const [status, setStatus] = useState('')
  const [email, setEmail] = useState<string | null>(null)
  useEffect(() => onAuthChange(setEmail), [])
  // Start backups only once signed in; the first run also pulls data from other devices
  useEffect(() => (email ? startAutoSync(setStatus) : undefined), [email])
  const entries = useLiveQuery(
    () => db.content.filter((e) => !e.deleted && e.systems.some((s) => enabled.includes(s))).toArray(),
    [enabled],
  )

  const download = async () => {
    const url = URL.createObjectURL(new Blob([await exportHomebrew()], { type: 'application/json' }))
    Object.assign(document.createElement('a'), { href: url, download: 'homebrew.json' }).click()
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
        <button onClick={() => setDraft(blank(enabled))}>+ Homebrew</button>
        <button onClick={download}>Export homebrew</button>
        <label>
          Import
          <input type="file" accept="application/json" hidden
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) await importHomebrew(await f.text()) }} />
        </label>
        {supabase && (email
          ? <button onClick={() => signOut()}>Sign out ({email})</button>
          : <button onClick={() => signInWithGoogle()}>Sign in with Google</button>)}
        <button disabled={!supabase || !email}
          onClick={async () => { try { await syncAll(); setStatus('Synced') } catch (e) { setStatus(String(e)) } }}>
          Sync
        </button>
        <span>{supabase ? status : 'Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to enable sync'}</span>
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

      <ul>
        {entries?.map((e) => (
          <li key={e.id}>
            <b>{e.name}</b> ({e.kind} {e.level}) [{e.source}] [{e.systems.join('+')}] {e.traits.join(', ')}
            {e.source === 'homebrew' && (
              <>
                {' '}<button onClick={() => setDraft(e)}>Edit</button>
                <button onClick={() => removeEntry(e.id)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}
