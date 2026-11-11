import { useMemo, useState } from 'react'
import { ABILITIES, ABILITY_LABEL, RANKS, SPELL_TRADITIONS, abilityMod, proficiencyBonus, signed, type SectionProps } from './builder'
import type { Character } from './types'

export function SpellsSection({ c, entries, save }: SectionProps) {
  const [query, setQuery] = useState('')
  const [tradition, setTradition] = useState(c.spellcasting?.tradition ?? '')
  const sc = c.spellcasting
  const spells = c.spells ?? []
  const setSc = (patch: Partial<NonNullable<Character['spellcasting']>>) =>
    save({ spellcasting: { ability: 'int', tradition: '', rank: 1, slots: {}, ...sc, ...patch } })

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q && !tradition) return []
    return entries
      .filter((e) => e.kind === 'spell')
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .filter((e) => !tradition || String(e.data.tradition ?? '').toLowerCase().includes(tradition.toLowerCase()))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
      .slice(0, 40)
  }, [entries, query, tradition])

  const mod = sc ? abilityMod(c.abilities[sc.ability]) + proficiencyBonus(sc.rank, c.level) : 0
  const groups = [...new Set(spells.map((s) => (s.cantrip ? 0 : s.rank)))].sort((a, b) => a - b)

  return (
    <>
      <h3>Spells ({spells.length})</h3>
      <div className="row">
        <label>Casting ability{' '}
          <select value={sc?.ability ?? ''} onChange={(e) => setSc({ ability: e.target.value as never })}>
            <option value="">none</option>
            {ABILITIES.map((a) => <option key={a} value={a}>{ABILITY_LABEL[a]}</option>)}
          </select>
        </label>
        {sc && (
          <>
            <label>Tradition{' '}
              <select value={sc.tradition} onChange={(e) => { setSc({ tradition: e.target.value }); setTradition(e.target.value) }}>
                <option value="">-</option>
                {SPELL_TRADITIONS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label>Proficiency{' '}
              <select value={sc.rank} onChange={(e) => setSc({ rank: +e.target.value })}>
                {RANKS.map((r, i) => <option key={r} value={i}>{r}</option>)}
              </select>
            </label>
            <b>Attack {signed(mod)} | DC {10 + mod}</b>
          </>
        )}
      </div>
      {sc && (
        <div className="row">
          <small>Slots per rank:</small>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((r) => (
            <label key={r}>{r}{' '}
              <input type="number" min={0} style={{ width: '3.5em' }} value={sc.slots[r] ?? 0}
                onChange={(e) => setSc({ slots: { ...sc.slots, [r]: Math.max(0, +e.target.value || 0) } })} />
            </label>
          ))}
        </div>
      )}
      {groups.map((g) => (
        <div key={g}>
          <b>{g === 0 ? 'Cantrips' : `Rank ${g}`}</b>
          <ul>
            {spells.map((s, i) => (s.cantrip ? 0 : s.rank) === g && (
              <li key={`${s.name}-${i}`}>
                {s.name}{' '}
                <button onClick={() => save({ spells: spells.filter((_, j) => j !== i) })}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="row">
        <input placeholder="Search spells" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={tradition} onChange={(e) => setTradition(e.target.value)}>
          <option value="">Any tradition</option>
          {SPELL_TRADITIONS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <ul>
        {matches.map((m) => {
          const cantrip = m.traits.some((t) => t.toLowerCase() === 'cantrip')
          const have = spells.some((s) => s.entryId === m.id)
          return (
            <li key={m.id}>
              <b>{m.name}</b> ({cantrip ? 'cantrip' : `rank ${m.level}`}) {m.data.actions ?? ''} {m.data.tradition ?? ''}{' '}
              <button disabled={have} onClick={() => save({ spells: [...spells, { name: m.name, rank: m.level, cantrip, entryId: m.id }] })}>
                {have ? 'Added' : 'Add'}
              </button>
              <br /><small>{m.description}</small>
            </li>
          )
        })}
      </ul>
    </>
  )
}
