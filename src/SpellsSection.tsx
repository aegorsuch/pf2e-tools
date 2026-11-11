import { Info } from './Info'
import { useMemo, useState } from 'react'
import { ABILITIES, ABILITY_LABEL, SPELL_TRADITIONS, abilityMod, classSpellcasting, focusSpells, proficiencyBonus, signed, type SectionProps } from './builder'
import type { Character } from './types'
import { grantedWardenSpells, spellWardenLabel, wardenTierOf } from './featChoices'
import { ActionIcon } from './ActionIcon'

export function SpellsSection({ c, entries, save }: SectionProps) {
  const [tradition, setTradition] = useState(c.spellcasting?.tradition ?? '')
  const sc = c.spellcasting
  const casting = classSpellcasting(c, entries)
  const traditions = casting?.traditions ?? []
  const spells = c.spells ?? []
  const granted = grantedWardenSpells(c, entries)
  const { spells: focus, points: focusPoints } = focusSpells(c, entries)
  const manualSpells = spells.filter((s) => !granted.some((g) => g.id === s.entryId || g.name === s.name))
  const setSc = (patch: Partial<NonNullable<Character['spellcasting']>>) => {
    if (!casting) return
    save({ spellcasting: { ability: 'int', tradition: traditions[0] ?? '', slots: {}, ...sc, ...patch, rank: casting.rank, ...(casting.ability ? { ability: casting.ability } : {}) } })
  }
  const selectedTradition = traditions.length === 1
    ? traditions[0]
    : traditions.includes(tradition) ? tradition : ''

  const matches = useMemo(() => {
    if (!selectedTradition) return []
    return entries
      .filter((e) => e.kind === 'spell')
      .filter((e) => !selectedTradition || String(e.data.tradition ?? '').toLowerCase().includes(selectedTradition.toLowerCase()))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
      .slice(0, 40)
  }, [entries, selectedTradition])

  const castAbility = casting?.ability ?? sc?.ability
  const mod = casting && castAbility ? abilityMod(c.abilities[castAbility]) + proficiencyBonus(casting.rank, c.level) : 0
  const groupLabel = (name: string, entryId: string | undefined, rank: number, cantrip: boolean) => {
    const entry = entries.find((e) => e.kind === 'spell' && (entryId ? e.id === entryId : e.name === name))
    return spellWardenLabel(entry?.data.warden_spell_tier) ?? (cantrip ? 'Cantrips' : `Rank ${rank}`)
  }
  const listedSpells = [
    ...granted.map((s) => ({ name: s.name, entryId: s.id, group: spellWardenLabel(wardenTierOf(s)) ?? `Rank ${s.level}`, index: -1 })),
    ...spells.flatMap((s, index) => manualSpells.includes(s) ? [{ name: s.name, entryId: s.entryId, group: groupLabel(s.name, s.entryId, s.rank, s.cantrip), index }] : []),
  ].sort((a, b) => a.name.localeCompare(b.name))
  const groupOrder = ['Cantrips', ...Array.from({ length: 10 }, (_, i) => `Rank ${i + 1}`),
    'Initiate Warden', 'Advanced Warden', 'Master Warden', 'Peerless Warden']
  const groups = [...new Set(listedSpells.map((s) => s.group))]
    .sort((a, b) => groupOrder.indexOf(a) - groupOrder.indexOf(b))

  return (
    <details className="character-section">
      <summary className="character-section-summary">
        <strong>Spells</strong>
        <span>{manualSpells.length + granted.length + focus.length} spells</span>
      </summary>
      <div className="character-section-content">
      {casting && <>
      <div className="row">
        {casting.ability ? <b>Casting ability: {ABILITY_LABEL[casting.ability]}</b> : <label>Casting ability{' '}
          <select value={sc?.ability ?? ''} onChange={(e) => setSc({ ability: e.target.value as never })}>
            <option value="">none</option>
            {ABILITIES.map((a) => <option key={a} value={a}>{ABILITY_LABEL[a]}</option>)}
          </select>
        </label>}
        {traditions.length > 1 && <label>Tradition{' '}
              <select value={selectedTradition} onChange={(e) => { setSc({ tradition: e.target.value }); setTradition(e.target.value) }}>
                <option value="">Choose…</option>
                {traditions.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>}
        {traditions.length === 1 && <b>{traditions[0]} tradition</b>}
        <b>Spellcasting {['Untrained', 'Trained', 'Expert', 'Master', 'Legendary'][casting.rank]}</b>
        <span className="rank-dots" role="img" aria-label={`Spellcasting proficiency: ${['Untrained', 'Trained', 'Expert', 'Master', 'Legendary'][casting.rank]}`}>
          {['T', 'E', 'M', 'L'].map((letter, i) => <button key={letter} type="button" tabIndex={-1} disabled className={casting.rank >= i + 1 ? 'on' : ''}>{letter}</button>)}
        </span>
        {(sc || casting.ability) && <>
          <span className="skill-part"><small>Spell attack</small><b>{signed(mod)}</b></span>
          <span className="skill-part"><small>Spell DC</small><b>{10 + mod}</b></span>
        </>}
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
      </>}
      {focus.length > 0 && (
        <div>
          <b>Focus Spells</b> <small>(Focus Points: {focusPoints})</small>
          <ul>
            {focus.map((s) => (
              <li key={s.name}>{s.name} <ActionIcon entry={entries.find((e) => e.kind === 'spell' && e.name === s.name)} /> <small>({s.source})</small></li>
            ))}
          </ul>
        </div>
      )}
      {groups.map((g) => (
        <div key={g}>
          <b>{g}</b>
          <ul>
            {listedSpells.filter((s) => s.group === g).map((s) => (
              <li key={`${s.name}-${s.index}`}>
                {s.name} <ActionIcon entry={entries.find((entry) => entry.kind === 'spell' && (s.entryId ? entry.id === s.entryId : entry.name === s.name))} />{' '}
                {s.index >= 0 && <button onClick={() => save({ spells: spells.filter((_, j) => j !== s.index) })}>Remove</button>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="row">
        {casting && <select aria-label="Filter spells by tradition" value={tradition} onChange={(e) => setTradition(e.target.value)}>
          <option value="">Any tradition</option>
          {(traditions.length ? traditions : SPELL_TRADITIONS).map((t) => <option key={t}>{t}</option>)}
        </select>}
      </div>
      <ul>
        {matches.map((m) => {
          const cantrip = m.traits.some((t) => t.toLowerCase() === 'cantrip')
          const have = spells.some((s) => s.entryId === m.id) || granted.some((s) => s.id === m.id)
          return (
            <li key={m.id}>
              <b>{m.name}</b> <ActionIcon entry={m} showOther /> ({cantrip ? 'cantrip' : `rank ${m.level}`}) {spellWardenLabel(m.data.warden_spell_tier) && (
                <small>({spellWardenLabel(m.data.warden_spell_tier)})</small>
              )} {m.data.tradition ?? ''}{' '}
              <button disabled={have} onClick={() => save({ spells: [...spells, { name: m.name, rank: m.level, cantrip, entryId: m.id }] })}>
                {have ? 'Added' : 'Add'}
              </button>
              {m.description && <Info>{m.description}</Info>}
            </li>
          )
        })}
      </ul>
      </div>
    </details>
  )
}
