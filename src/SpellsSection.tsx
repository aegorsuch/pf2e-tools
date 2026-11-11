import { useMemo, useState } from 'react'
import { ABILITIES, ABILITY_LABEL, RANKS, SPELL_TRADITIONS, abilityMod, proficiencyBonus, signed, type SectionProps } from './builder'
import type { Character } from './types'
import { grantedWardenSpells, spellWardenLabel } from './featChoices'

export function SpellsSection({ c, entries, save }: SectionProps) {
  const [query, setQuery] = useState('')
  const [tradition, setTradition] = useState(c.spellcasting?.tradition ?? '')
  const sc = c.spellcasting
  const spells = c.spells ?? []
  const granted = grantedWardenSpells(c, entries)
  const manualSpells = spells.filter((s) => !granted.some((g) => g.id === s.entryId || g.name === s.name))
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
  const groupLabel = (name: string, entryId: string | undefined, rank: number, cantrip: boolean) => {
    const entry = entries.find((e) => e.kind === 'spell' && (entryId ? e.id === entryId : e.name === name))
    return spellWardenLabel(entry?.data.warden_spell_tier) ?? (cantrip ? 'Cantrips' : `Rank ${rank}`)
  }
  const listedSpells = [
    ...granted.map((s) => ({ name: s.name, group: spellWardenLabel(s.data.warden_spell_tier) ?? `Rank ${s.level}`, index: -1 })),
    ...spells.flatMap((s, index) => manualSpells.includes(s) ? [{ name: s.name, group: groupLabel(s.name, s.entryId, s.rank, s.cantrip), index }] : []),
  ].sort((a, b) => a.name.localeCompare(b.name))
  const groupOrder = ['Cantrips', ...Array.from({ length: 10 }, (_, i) => `Rank ${i + 1}`),
    'Initiate Warden', 'Advanced Warden', 'Master Warden', 'Peerless Warden']
  const groups = [...new Set(listedSpells.map((s) => s.group))]
    .sort((a, b) => groupOrder.indexOf(a) - groupOrder.indexOf(b))

  return (
    <>
      <h3>Spells ({manualSpells.length + granted.length})</h3>
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
          <b>{g}</b>
          <ul>
            {listedSpells.filter((s) => s.group === g).map((s) => (
              <li key={`${s.name}-${s.index}`}>
                {s.name}{' '}
                {s.index >= 0 && <button onClick={() => save({ spells: spells.filter((_, j) => j !== s.index) })}>Remove</button>}
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
          const have = spells.some((s) => s.entryId === m.id) || granted.some((s) => s.id === m.id)
          return (
            <li key={m.id}>
              <b>{m.name}</b> ({cantrip ? 'cantrip' : `rank ${m.level}`}) {spellWardenLabel(m.data.warden_spell_tier) && (
                <small>({spellWardenLabel(m.data.warden_spell_tier)})</small>
              )} {m.data.actions ?? ''} {m.data.tradition ?? ''}{' '}
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
