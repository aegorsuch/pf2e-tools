import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, importHomebrew, newId, removeEntry, saveEntry } from './db'
import { EffectsEditor } from './EffectsEditor'
import { parsePathbuilder } from './pathbuilder'
import { importFromAon } from './aon'
import { connectDrive, disconnectDrive, driveConfigured, onAuthChange, startAutoSync, syncAll } from './sync'
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
  const [connected, setConnected] = useState(false)
  useEffect(() => onAuthChange(setConnected), [])
  // Start backups only once Drive is connected; the first run also pulls data from other devices
  useEffect(() => (connected ? startAutoSync(setStatus) : undefined), [connected])
  const characters = useLiveQuery(() => db.characters.filter((c) => !c.deleted).toArray(), [])
  const entries = useLiveQuery(
    () => db.content.filter((e) => !e.deleted && e.systems.some((s) => enabled.includes(s))).toArray(),
    [enabled],
  )

  const newCharacter = async () => {
    const name = window.prompt('Character name?')?.trim()
    if (!name) return
    await db.characters.put({
      id: newId(), systems: enabled, name, level: 1,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [],
      updatedAt: Date.now(),
    })
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
        <button onClick={async () => {
          try {
            for (const sys of enabled) {
              const n = await importFromAon(sys, (c) => setStatus(`Importing ${sys}: ${c}`))
              setStatus(`Imported ${n} ${sys} entries from Archives of Nethys`)
            }
          } catch (err) { setStatus(String(err)) }
        }}>Import official (AoN)</button>
        <label>
          Import Pathbuilder character
          <input type="file" accept="application/json,.json" hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try {
                const c = parsePathbuilder(await f.text())
                await db.characters.put(c)
                setStatus(`Imported ${c.name}` + (c.imported?.unmapped.length ? ` (kept raw: ${c.imported.unmapped.join(', ')})` : ''))
              } catch (err) { setStatus(String(err)) }
              e.target.value = ''
            }} />
        </label>
        <label>
          Import homebrew
          <input type="file" accept="application/json" hidden
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) await importHomebrew(await f.text()) }} />
        </label>
        {driveConfigured && (connected
          ? <button onClick={() => disconnectDrive()}>Disconnect Google Drive</button>
          : <button onClick={async () => { try { await connectDrive(); setStatus('Connected') } catch (e) { setStatus(String(e)) } }}>
              Connect Google Drive
            </button>)}
        <button disabled={!driveConfigured || !connected}
          onClick={async () => { try { await syncAll(true); setStatus('Synced') } catch (e) { setStatus(String(e)) } }}>
          Sync
        </button>
        <span>{driveConfigured ? status : 'Set VITE_GOOGLE_CLIENT_ID to enable Google Drive sync'}</span>
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

      <h2>
        Characters{' '}
        <button type="button" title="New character" aria-label="New character" onClick={newCharacter}>+</button>
      </h2>
      <ul>
        {characters?.map((c) => (
          <li key={c.id}>
            <b>{c.name}</b> - L{c.level} {c.ancestry} {c.className} ({c.feats.length} feats, {c.equipment.length} items)
            <button onClick={() => db.characters.put({ ...c, deleted: true, updatedAt: Date.now() })}>Delete</button>
          </li>
        ))}
      </ul>
      <h2>Content</h2>
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
