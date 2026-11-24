import { useLiveQuery } from 'dexie-react-hooks'
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { db, ensureSupplementalContent, newId, removeEntry, saveEntry } from './db'
import { characterSummary, hasRemainingFeatSelections } from './builder'
import { characterDeityLores } from './backgrounds'
import { CharacterFilters, filterCharacters, type CharacterFilterValues } from './CharacterFilters'
import { DeleteIcon, EditIcon } from './Icons'
import { confirmRemoval } from './confirmRemoval'
import { loadRequiredCatalogs, readCatalog } from './catalogLoading'
import { onAuthChange, signInWithGitHub, signOut, startAutoSync, supabase } from './sync'
import type { ContentEntry, EntryKind, GameSystem } from './types'
import { useSettings } from './settings'
import { refreshApp } from './refresh'
import './App.css'

const loadCharacterBuilder = () => import('./CharacterBuilder').then(m => ({ default: m.CharacterBuilder }))
const CharacterBuilder = lazy(loadCharacterBuilder)
const loadEffectsEditor = () => import('./EffectsEditor').then(m => ({ default: m.EffectsEditor }))
const EffectsEditor = lazy(loadEffectsEditor)
const loadHomebrewList = () => import('./HomebrewList').then(m => ({ default: m.HomebrewList }))
const HomebrewList = lazy(loadHomebrewList)
const KINDS: EntryKind[] = ['feat', 'weapon', 'armor', 'spell', 'ritual', 'item', 'ancestry', 'class', 'armorGroup', 'weaponGroup', 'background', 'heritage', 'deity', 'companion', 'familiar', 'subclass']
const SYSTEMS: { id: GameSystem; label: string }[] = [
  { id: 'pf2e', label: 'Pathfinder 2e' },
  { id: 'sf2e', label: 'Starfinder 2e' },
]

const toggle = (list: GameSystem[], s: GameSystem) =>
  list.includes(s) ? list.filter((x) => x !== s) : [...list, s]

const ALL_SYSTEMS = SYSTEMS.map((s) => s.id)
const NO_ENTRIES: ContentEntry[] = []
const OPEN_CHARACTER_KEY = 'pf2e-tools:open-character'

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
  const [rulesOpen, setRulesOpen] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [draft, setDraft] = useState<ContentEntry | null>(null)
  const [restoredCharacter] = useState(() => {
    try {
      return { id: window.sessionStorage.getItem(OPEN_CHARACTER_KEY), error: '' }
    } catch (error) {
      return { id: null, error: `Could not restore the open character: ${error instanceof Error ? error.message : String(error)}` }
    }
  })
  const [editingId, setEditingId] = useState<string | null>(restoredCharacter.id)
  const [navigationError, setNavigationError] = useState(restoredCharacter.error)
  const openCharacter = useCallback((id: string | null) => {
    setEditingId(id)
    try {
      if (id) window.sessionStorage.setItem(OPEN_CHARACTER_KEY, id)
      else window.sessionStorage.removeItem(OPEN_CHARACTER_KEY)
      setNavigationError('')
      return true
    } catch (error) {
      setNavigationError(`Could not save the open character for refresh: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }, [])
  const [status, setStatus] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [authError, setAuthError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [homebrewSearch, setHomebrewSearch] = useState('')
  const [characterFilters, setCharacterFilters] = useState<CharacterFilterValues>({ ancestry: '', className: '' })
  const [catalogReady, setCatalogReady] = useState('')
  const [catalogFailure, setCatalogFailure] = useState<{ key: string; message: string }>()
  const [catalogRetry, setCatalogRetry] = useState(0)
  const userId = user?.id
  useEffect(() => {
    void ensureSupplementalContent().catch((err: unknown) => {
      setStatus(`Could not load supplemental content (${err instanceof Error ? err.message : err})`)
    })
  }, [])
  useEffect(() => onAuthChange(setUser, setAuthError), [])
  // Start backups only once signed in; the first run also pulls data from other devices
  useEffect(() => (userId ? startAutoSync(setStatus) : undefined), [userId])
  const characters = useLiveQuery(() => db.characters.filter((c) => !c.deleted).toArray(), [])
  const deityLores = useMemo(() => characterDeityLores(characters ?? []), [characters])
  const editingCharacter = characters?.find((c) => c.id === editingId)
  useEffect(() => {
    if (editingId && editingId === restoredCharacter.id && characters && !editingCharacter) {
      if (openCharacter(null)) setNavigationError('The previously opened character is no longer available.')
    }
  }, [characters, editingCharacter, editingId, openCharacter, restoredCharacter.id])
  const neededSystems = editingCharacter?.systems ?? draft?.systems
  const neededKey = neededSystems?.slice().sort().join(',') ?? ''
  const requestKey = neededKey ? `${editingId ?? 'draft'}:${neededKey}:${catalogRetry}` : ''
  const fullCatalog = !!editingId || !!draft
  const catalogError = catalogFailure?.key === requestKey ? catalogFailure.message : ''

  useEffect(() => {
    let live = true
    if (!neededKey) return () => { live = false }
    void loadRequiredCatalogs(neededKey.split(',') as GameSystem[], setStatus, () => live)
      .then(ready => { if (live && ready) setCatalogReady(requestKey) })
      .catch((error: unknown) => {
        if (live) setCatalogFailure({ key: requestKey, message: error instanceof Error ? error.message : String(error) })
      })
    return () => { live = false }
  }, [neededKey, requestKey])
  const catalog = useLiveQuery(
    () => readCatalog(fullCatalog, enabled, catalogReady, requestKey),
    [enabled, catalogReady, requestKey, fullCatalog],
  )
  const entries = catalog?.entries

  const homebrew = useMemo(() => entries?.filter((e) => e.source === 'homebrew') ?? [], [entries])
  const basicRemaining = useMemo(() => new Set((characters ?? [])
    .filter(character => hasRemainingFeatSelections(character))
    .map(character => character.id)), [characters, settings])
  const needsFeatCatalog = !editingId && (characters ?? []).some(character => !basicRemaining.has(character.id))
  const featCatalog = useLiveQuery(async () => needsFeatCatalog ? await db.content.toArray() : undefined, [needsFeatCatalog])
  const remainingFeats = useMemo(() => {
    const remaining = new Set(basicRemaining)
    if (featCatalog) for (const character of characters ?? []) {
      if (!remaining.has(character.id) && hasRemainingFeatSelections(character, featCatalog)) remaining.add(character.id)
    }
    return remaining
  }, [basicRemaining, characters, featCatalog, settings])
  const sortedCharacters = useMemo(() => filterCharacters(characters ?? [], characterFilters)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
  [characters, characterFilters])

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
    setCatalogRetry(value => value + 1)
    openCharacter(id)
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
          <button type="button" className="gear-button" title="House rules" aria-label="Rules" aria-controls="homebrew-rules"
            aria-expanded={!editingId && rulesOpen} onClick={() => {
              openCharacter(null)
              setHomebrewSearch('')
              setRulesOpen(true)
              requestAnimationFrame(() => document.getElementById('homebrew-rules')?.scrollIntoView({ block: 'start' }))
            }}><GearIcon /></button>
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
      {navigationError && <p role="alert">{navigationError}</p>}
      {(status || !supabase) && <small>{status || 'Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to enable sync'}</small>}
      {draft && catalogError && <p role="alert">{catalogError} <button type="button" onClick={() => setCatalogRetry(value => value + 1)}>Retry</button></p>}

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
            {[...KINDS].sort((a, b) => a.localeCompare(b)).map((k) => <option key={k}>{k}</option>)}
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
          <Suspense fallback={null}><EffectsEditor effects={draft.effects} onChange={(effects) => setDraft({ ...draft, effects })} /></Suspense>
          {(draft.kind === 'armor' || draft.kind === 'weapon') && (
            <select value={String(draft.data[draft.kind === 'weapon' ? 'weapon_group' : 'armor_group']
              ?? entries?.find(group => group.id === draft.data.group)?.name ?? '')}
              onChange={(e) => {
                const data = { ...draft.data }
                delete data.group
                data[draft.kind === 'weapon' ? 'weapon_group' : 'armor_group'] = e.target.value
                setDraft({ ...draft, data })
              }}>
              <option value="">No {draft.kind} group</option>
              {entries?.filter((g) => g.kind === `${draft.kind}Group`).sort((a, b) => a.name.localeCompare(b.name)).map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
            </select>
          )}
          <div className="row">
            <button disabled={!draft.systems.length}>Save</button>
            <button type="button" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </form>
      )}

      {editingCharacter && ((!neededKey || catalogReady === requestKey) && catalog?.key === catalogReady && catalog.full
        ? <Suspense fallback={null}><CharacterBuilder character={editingCharacter} catalog={entries ?? NO_ENTRIES} deityLores={deityLores} onClose={() => openCharacter(null)} /></Suspense>
        : <div role="status">
          {catalogError ? <><p>{catalogError}</p><button type="button" onClick={() => setCatalogRetry(value => value + 1)}>Retry</button></>
            : <p>Loading character content...</p>}
          <button type="button" onClick={() => openCharacter(null)}>Back to characters</button>
        </div>)}
      {editingId && !characters && <p role="status">Loading character...</p>}

      {!editingId && <>
      <div className="home-section-heading">
        <h2>Characters</h2>
        <button type="button" onClick={newCharacter}>New character</button>
        <CharacterFilters characters={characters ?? []} filters={characterFilters} onChange={setCharacterFilters} />
      </div>
      {characters && (characterFilters.ancestry || characterFilters.className) && !sortedCharacters.length
        && <p role="status">No matching characters.</p>}
      <ul className="character-list">
        {sortedCharacters.map((c) => (
          <li className="character-row" key={c.id}>
            <span><b>{c.name}{remainingFeats.has(c.id) && <span title="Feat selections remaining" aria-label="Feat selections remaining"> *</span>}</b> - {characterSummary(c, entries ?? [])}</span>
            <span className="character-actions">
              <button type="button" className="icon-button" title="Edit character" aria-label={`Edit ${c.name}`}
                onPointerEnter={() => void loadCharacterBuilder()} onFocus={() => void loadCharacterBuilder()}
                onClick={() => { setCatalogRetry(value => value + 1); openCharacter(c.id) }}><EditIcon /></button>
              <button type="button" className="icon-button" title="Delete character" aria-label={`Delete ${c.name}`}
                onClick={() => confirmRemoval(`character "${c.name}" and all its saved options`, () => {
                  void db.characters.put({ ...c, deleted: true, updatedAt: Date.now() }).catch((error: unknown) =>
                    setStatus(`Could not delete character: ${error instanceof Error ? error.message : String(error)}`))
                })}><DeleteIcon /></button>
            </span>
          </li>
        ))}
      </ul>
      <div className="home-section-heading">
        <h2>Homebrew Content ({homebrew.length})</h2>
        <button type="button" onClick={() => { setCatalogRetry(value => value + 1); setDraft(blank(enabled)) }}>Add homebrew</button>
      </div>
      <label className="homebrew-search">Search homebrew
        <input type="search" value={homebrewSearch} onChange={event => setHomebrewSearch(event.target.value)} />
      </label>
      <Suspense fallback={null}><HomebrewList entries={entries ?? NO_ENTRIES} search={homebrewSearch} rulesOpen={rulesOpen} onRulesToggle={setRulesOpen}
        onEdit={entry => { setCatalogRetry(value => value + 1); setDraft(entry) }} onDelete={(id) => {
        void removeEntry(id).catch((error: unknown) =>
          setStatus(`Could not delete homebrew: ${error instanceof Error ? error.message : String(error)}`))
      }} /></Suspense>
      </>}
    </main>
  )
}
