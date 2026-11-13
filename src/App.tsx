import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { db, ensureSupplementalContent, newId, removeEntry, saveEntry } from './db'
import { CharacterBuilder } from './CharacterBuilder'
import { characterSummary } from './builder'
import { DeleteIcon, EditIcon } from './Icons'
import { EffectsEditor } from './EffectsEditor'
import { HomebrewList } from './HomebrewList'
import { confirmRemoval } from './confirmRemoval'
import { ensureAonImported } from './aon'
import { onAuthChange, signInWithEmail, signInWithGitHub, signOut, startAutoSync, supabase } from './sync'
import type { ContentEntry, EntryKind, GameSystem } from './types'
import { updateSettings, useSettings } from './settings'
import { refreshApp } from './refresh'
import './App.css'

const KINDS: EntryKind[] = ['feat', 'weapon', 'armor', 'spell', 'item', 'ancestry', 'class', 'armorGroup', 'weaponGroup', 'background', 'heritage', 'deity', 'companion', 'familiar', 'subclass']
const SYSTEMS: { id: GameSystem; label: string }[] = [
  { id: 'pf2e', label: 'Pathfinder 2e' },
  { id: 'sf2e', label: 'Starfinder 2e' },
]

const toggle = (list: GameSystem[], s: GameSystem) =>
  list.includes(s) ? list.filter((x) => x !== s) : [...list, s]

const ALL_SYSTEMS = SYSTEMS.map((s) => s.id)

const blank = (systems: GameSystem[]): ContentEntry => ({
  id: newId(), systems, kind: 'feat', source: 'homebrew', name: '', level: 1,
  traits: [], description: '', data: {}, effects: [], updatedAt: 0,
})


function GearIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
  </svg>
}

function AccountIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
}


export default function App() {
  const enabled = ALL_SYSTEMS
  const settings = useSettings()
  const [showSettings, setShowSettings] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [draft, setDraft] = useState<ContentEntry | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [authError, setAuthError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const userId = user?.id
  useEffect(() => {
    void ensureSupplementalContent().catch((err: unknown) => {
      setStatus(`Could not load supplemental content (${err instanceof Error ? err.message : err})`)
    })
  }, [])
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
      <header className="top-bar">
        <h1>PF2E Tools</h1>
        <div className="top-actions">
          <button type="button" disabled={refreshing} title="Refresh app and check for updates" onClick={async () => {
            setRefreshing(true)
            setRefreshError('')
            try {
              await refreshApp()
            } catch (error) {
              setRefreshError(`Refresh failed: ${error instanceof Error ? error.message : String(error)}`)
              setRefreshing(false)
            }
          }}>{refreshing ? 'Refreshing...' : 'Refresh'}</button>
          <button type="button" className="gear-button" title="Settings" aria-label="Settings" aria-expanded={showSettings}
            onClick={() => setShowSettings((v) => !v)}><GearIcon /></button>
          {supabase && (
            <div className="account">
              <button type="button" className="gear-button" title={user ? `Account (${user.email ?? user.id})` : 'Sign in'} aria-label="Account"
                aria-expanded={showAccount} onClick={() => setShowAccount((v) => !v)}><AccountIcon /></button>
              {showAccount && (
                <div className="account-menu col" role="menu">
                  {user
                    ? (
                      <>
                        <small>{user.email ?? user.id}</small>
                        <button onClick={async () => {
                          setShowAccount(false)
                          try { await signOut(); setAuthError('') } catch (e) { setAuthError(String(e)) }
                        }}>Sign out</button>
                      </>
                    )
                    : (
                      <>
                        <button onClick={async () => {
                          setShowAccount(false); setAuthError('')
                          try { await signInWithGitHub() } catch (e) { setAuthError(String(e)) }
                        }}>Sign in with GitHub</button>
                        <button onClick={async () => {
                          setShowAccount(false)
                          const addr = window.prompt('Email address for a sign-in link?')?.trim()
                          if (!addr) return
                          try { await signInWithEmail(addr); setStatus('Check your email for the sign-in link') } catch (e) { setStatus(String(e)) }
                        }}>Email me a sign-in link</button>
                      </>
                    )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      {authError && <p role="alert">Sign-in error: {authError}</p>}
      {refreshError && <p role="alert">{refreshError}</p>}
      {(status || !supabase) && <small>{status || 'Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to enable sync'}</small>}

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

      {showSettings && (
        <section className="col settings-panel" aria-label="Character settings">
          <label>
            <input type="checkbox" checked={settings.autoClassSkills}
              onChange={(e) => updateSettings({ autoClassSkills: e.target.checked })} />{' '}
            Auto-Advance Class-Specific Skills
          </label>
          <label>
            <input type="checkbox" checked={settings.autoLores}
              onChange={(e) => updateSettings({ autoLores: e.target.checked })} />{' '}
            Auto-Advance Lores
          </label>
          <label>
            <input type="checkbox" checked={settings.championFormNoFlight}
              onChange={(e) => updateSettings({ championFormNoFlight: e.target.checked })} />{' '}
            Celestial and Fiendish Form: No Flight
          </label>
          <label>
            <input type="checkbox" checked={settings.championCavalier}
              onChange={(e) => updateSettings({ championCavalier: e.target.checked })} />{' '}
            Champion Cavalier Dedication
          </label>
          <label>
            <input type="checkbox" checked={settings.druidCavalier}
              onChange={(e) => updateSettings({ druidCavalier: e.target.checked })} />{' '}
            Druid Cavalier Dedication
          </label>
          <label>
            <input type="checkbox" checked={settings.freeArchetype}
              onChange={(e) => updateSettings({ freeArchetype: e.target.checked })} />{' '}
            Free Archetype
          </label>
          <label>
            <input type="checkbox" checked={settings.generalFeatsOnly}
              onChange={(e) => updateSettings({ generalFeatsOnly: e.target.checked })} />{' '}
            General Feats Only
          </label>
          <label>
            <input type="checkbox" checked={settings.singleTrainingFeats}
              onChange={(e) => updateSettings({ singleTrainingFeats: e.target.checked })} />{' '}
            General Training and Advanced General Training: Once Each
          </label>
          <label>
            <input type="checkbox" checked={settings.rangerSnarecrafter}
              onChange={(e) => updateSettings({ rangerSnarecrafter: e.target.checked })} />{' '}
            Ranger Snarecrafter Dedication
          </label>
        </section>
      )}

      {!editingId && <>
      <h2>
        Characters{' '}
        <button type="button" title="New character" aria-label="New character" onClick={newCharacter}>+</button>
      </h2>
      <ul className="character-list">
        {sortedCharacters.map((c) => (
          <li className="character-row" key={c.id}>
            <span><b>{c.name}</b> - {characterSummary(c, entries ?? [])}</span>
            <span className="character-actions">
              <button type="button" className="icon-button" title="Edit character" aria-label={`Edit ${c.name}`}
                onClick={() => setEditingId(c.id)}><EditIcon /></button>
              <button type="button" className="icon-button" title="Delete character" aria-label={`Delete ${c.name}`}
                onClick={() => confirmRemoval(`character "${c.name}" and all its saved options`, () => {
                  void db.characters.put({ ...c, deleted: true, updatedAt: Date.now() }).catch((error: unknown) =>
                    setStatus(`Could not delete character: ${error instanceof Error ? error.message : String(error)}`))
                })}><DeleteIcon /></button>
            </span>
          </li>
        ))}
      </ul>
      <div className="row">
        <h2>Homebrew Content ({homebrew.length})</h2>
        <button type="button" title="Add homebrew content" aria-label="Add homebrew content"
          onClick={() => setDraft(blank(enabled))}>+</button>
      </div>
      <HomebrewList entries={entries ?? []} onEdit={setDraft} onDelete={(id) => {
        void removeEntry(id).catch((error: unknown) =>
          setStatus(`Could not delete homebrew: ${error instanceof Error ? error.message : String(error)}`))
      }} />
      </>}
    </main>
  )
}
