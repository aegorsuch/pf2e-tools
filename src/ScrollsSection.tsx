import { useMemo, useState } from 'react'
import { abilityMod, activeFeatsNamed, classSpellcasting, classSpellSlots, wizardArchetypeSpellSlots, wizardSchoolBookSpells, type SectionProps } from './builder'
import { confirmRemoval } from './confirmRemoval'
import { EntryDescription } from './EntryDescription'
import { SearchableSelect } from './SearchableSelect'
import { SpellActions } from './SpellDamage'
import type { Character, ContentEntry } from './types'

type Preparation = NonNullable<Character['scrollAdeptPreparations']>[number]
type ScrollOption = { entry: ContentEntry; rank: number }

function scrollSpell(entry: ContentEntry, c: Character) {
  return entry.kind === 'spell' && !entry.deleted && entry.systems.some(system => c.systems.includes(system))
    && entry.level > 0 && !entry.traits.some(trait => /^(cantrip|focus)$/i.test(trait))
}

export function scrollAdeptLimits(c: Character, entries: ContentEntry[]) {
  if (!c.systems.includes('pf2e') || !activeFeatsNamed(c, 'Scroll Adept').length) return undefined
  const classSlots = classSpellSlots(c)
  const slots = classSlots ?? c.spellcasting?.slots ?? {}
  const wizardSlots = wizardArchetypeSpellSlots(c) ?? {}
  const highest = Math.max(0, ...[slots, wizardSlots].flatMap(table => Object.entries(table)
    .filter(([rank, count]) => Number(rank) > 0 && count > 0).map(([rank]) => Number(rank))),
  c.className === 'Wizard' && !classSlots ? c.level >= 19 ? 10 : Math.ceil(c.level / 2) : 0)
  const proficiency = Math.max(classSpellcasting(c, entries)?.rank ?? 0,
    activeFeatsNamed(c, 'Master Wizard Spellcasting').length ? 3 : 0)
  return { count: proficiency >= 4 ? 4 : proficiency >= 3 ? 3 : 2, maxRank: Math.max(0, highest - 2) }
}

export function scrollAdeptOptions(c: Character, entries: ContentEntry[], maxRank: number) {
  const book = wizardSchoolBookSpells(c, entries) ?? c.spells ?? []
  const byId = new Map(entries.filter(entry => scrollSpell(entry, c)).map(entry => [entry.id, entry]))
  const byName = new Map([...byId.values()].map(entry => [entry.name, entry]))
  const options = new Map<string, { entry: ContentEntry; rank: number }>()
  for (const known of book) {
    if (known.cantrip || c.className !== 'Wizard' && !known.bookSlot?.startsWith('wizard:')) continue
    const entry = known.entryId ? byId.get(known.entryId) : byName.get(known.name)
    if (!entry || !String(entry.data.tradition ?? '').split(/,\s*/).some(tradition => /^arcane$/i.test(tradition))) continue
    for (let rank = entry.level; rank <= maxRank; rank++) options.set(JSON.stringify([entry.id, rank]), { entry, rank })
  }
  return [...options.values()].sort((a, b) => a.entry.name.localeCompare(b.entry.name) || a.rank - b.rank)
}

function AdeptPicker({ index, current, available, disabled, onChange }: {
  index: number; current: Preparation; available: ScrollOption[]; disabled: boolean; onChange: (value: string) => void
}) {
  const [ready, setReady] = useState(false)
  const value = current ? JSON.stringify([current.spellId, current.rank]) : ''
  const selected = available.find(option => JSON.stringify([option.entry.id, option.rank]) === value)
  return <SearchableSelect aria-label={`Scroll Adept scroll ${index + 1}`} value={value}
    alwaysSearchable onPrepare={() => setReady(true)} disabled={disabled} onChange={event => onChange(event.target.value)}>
    <option value="">Choose scroll</option>
    {current && !selected && <option value={value} disabled>{current.name} (rank {current.rank}; unavailable)</option>}
    {(ready ? available : selected ? [selected] : []).map(option =>
      <option key={`${option.entry.id}:${option.rank}`} value={JSON.stringify([option.entry.id, option.rank])}>
        {option.entry.name} (rank {option.rank})
      </option>)}
  </SearchableSelect>
}

export function ScrollAdept({ c, entries, save }: SectionProps) {
  const limits = scrollAdeptLimits(c, entries)
  const preparations = c.scrollAdeptPreparations ?? []
  if (!limits && !preparations.some(Boolean)) return null
  const options = limits ? scrollAdeptOptions(c, entries, limits.maxRank) : []
  const count = Math.max(limits?.count ?? 0, preparations.length)
  const update = (index: number, value: Preparation) => {
    const next = [...preparations]
    while (next.length <= index) next.push(null)
    next[index] = value
    save({ scrollAdeptPreparations: next })
  }
  return <div className="col">
    <h5>Scroll Adept</h5>
    {Array.from({ length: count }, (_, index) => {
      const current = preparations[index]
      const value = current ? JSON.stringify([current.spellId, current.rank]) : ''
      const available = options.filter(option => !preparations.some((other, otherIndex) =>
        otherIndex !== index && other?.rank === option.rank))
      const selected = entries.find(entry => entry.id === current?.spellId && entry.kind === 'spell')
      return <div className="row" key={index}>
        <AdeptPicker index={index} current={current} available={available}
          disabled={!limits || index >= limits.count || !!current?.used} onChange={nextValue => {
            const option = available.find(candidate => JSON.stringify([candidate.entry.id, candidate.rank]) === nextValue)
            if (nextValue && !option) return
            const next = option ? { spellId: option.entry.id, name: option.entry.name, rank: option.rank } : null
            if (current && value !== nextValue) confirmRemoval(`prepared scroll "${current.name}"`, () => update(index, next))
            else update(index, next)
          }} />
        {current && <><span>{current.used ? 'Used' : 'L Bulk'}</span>
          {!current.used && <><EntryDescription name={current.name} entry={selected} />
            <SpellActions name={current.name} rank={current.rank} entry={selected} spellcastingModifier={abilityMod(c.abilities.int)} />
            <button type="button" onClick={() => confirmRemoval(`scroll "${current.name}"`, () => update(index, { ...current, used: true }))}>Cast</button></>}
        </>}
      </div>
    })}
    {preparations.some(Boolean) && <button type="button" onClick={() => {
      const reset = () => save({ scrollAdeptPreparations: [] })
      if (preparations.some(scroll => scroll && !scroll.used)) confirmRemoval('unused Scroll Adept scrolls at daily preparations', reset)
      else reset()
    }}>Daily preparations</button>}
  </div>
}

export function OwnedScrollSpell({ c, entries, save, index, entry }: SectionProps & { index: number; entry?: ContentEntry }) {
  const [ready, setReady] = useState(false)
  const item = c.equipment[index]
  const rank = Number(/^(\d+)(?:st|nd|rd|th)-rank Scroll$/i.exec(item.name)?.[1])
  const options = useMemo(() => ready && rank ? entries.filter(spell => scrollSpell(spell, c) && spell.level <= rank)
    .sort((a, b) => a.name.localeCompare(b.name)) : [], [ready, rank, entries, c])
  if (!rank || !entry) return null
  const selected = entries.find(spell => spell.kind === 'spell' && spell.id === item.scrollSpell)
  const casting = classSpellcasting(c, entries)
  const traditions = [...(casting?.traditions ?? []), ...(wizardArchetypeSpellSlots(c) ? ['Arcane'] : [])]
  const canCast = !!selected && String(selected.data.tradition ?? '').split(/,\s*/)
    .some(tradition => traditions.some(known => known.toLowerCase() === tradition.toLowerCase()))
  const change = (patch: Partial<typeof item>) => save({ equipment: c.equipment.map((row, i) => i === index ? { ...row, ...patch } : row) })
  return <span className="row">
    <SearchableSelect aria-label={`Spell on ${item.name}`} value={item.scrollSpell ?? ''} alwaysSearchable onPrepare={() => setReady(true)}
      onChange={event => {
        const spell = options.find(option => option.id === event.target.value)
        if (event.target.value && !spell) return
        const apply = () => change({ scrollSpell: spell?.id })
        if (item.scrollSpell && item.scrollSpell !== event.target.value) confirmRemoval('scroll spell selection', apply)
        else apply()
      }}>
      <option value="">Choose spell</option>
      {item.scrollSpell && !options.some(option => option.id === item.scrollSpell)
        && <option value={item.scrollSpell} disabled>{selected?.name ?? item.scrollSpell}</option>}
      {options.map(spell => <option key={spell.id} value={spell.id}>{spell.name}</option>)}
    </SearchableSelect>
    {selected && <><EntryDescription name={selected.name} entry={selected} />
      <SpellActions name={selected.name} rank={rank} entry={selected}
        spellcastingModifier={abilityMod(c.abilities[c.spellcasting?.ability ?? classSpellcasting(c, entries)?.ability ?? 'int'])} />
      <button type="button" disabled={!canCast} onClick={() => confirmRemoval(`scroll "${selected.name}"`, () => {
        if (item.qty > 1) change({ qty: item.qty - 1 })
        else save({ equipment: c.equipment.filter((_, i) => i !== index) })
      })}>Cast</button></>}
  </span>
}
