import { useMemo, useState } from 'react'
import { featTakenLevel, type SectionProps } from './builder'
import { confirmRemoval } from './confirmRemoval'
import { EntryDescription } from './EntryDescription'
import { featRarity } from './featAccess'
import { formulaKey as key, formulaSources, gadgetLimits, knownFormulas, snareAdvancements, STANDARD_SNARE_FORMULAS, updateFormulaChoice } from './formulas'
import type { ContentEntry } from './types'

export function FormulasSummary({ c, entries }: Pick<SectionProps, 'c' | 'entries'>) {
  const sources = formulaSources(c, entries)
  const known = knownFormulas(c, entries)
  const gadgets = gadgetLimits(c, entries)
  const snareRanks = snareAdvancements(c, entries)
  const slots = (sources.snareCrafting ? 4 : 0) + (sources.brastlewark ? 2 : 0) + (gadgets?.formulas ?? 0) + snareRanks.length * 3
  const filled = (sources.snareCrafting ? (c.snareFormulaChoices ?? []).slice(0, 4).filter(Boolean).length : 0)
    + (sources.brastlewark ? c.brastlewarkFormulaMode === 'standard' ? 2
      : c.brastlewarkFormulaMode === 'other' ? (c.brastlewarkFormulaChoices ?? []).slice(0, 2).filter(Boolean).length : 0 : 0)
    + (c.gadgetFormulaChoices ?? []).slice(0, gadgets?.formulas ?? 0).filter(Boolean).length
    + snareRanks.reduce((sum, { rank }) => sum + (c.snareAdvancementFormulaChoices ?? []).slice((rank - 2) * 3, (rank - 1) * 3).filter(Boolean).length, 0)
  return <summary className="character-section-summary"><strong>Formulas</strong><span>{known.length} known{slots > 0 && `; ${filled}/${slots} feat choices`}</span></summary>
}

export function FormulasSection(props: SectionProps) {
  return <details className="character-section">
    <FormulasSummary {...props} />
    <FormulasContent {...props} />
  </details>
}

export function FormulasContent({ c, entries, save }: SectionProps) {
  const [query, setQuery] = useState('')
  const sources = formulaSources(c, entries)
  const known = knownFormulas(c, entries)
  const knownKeys = new Set(known.map(formula => key(formula.name)))
  const items = useMemo(() => entries.filter(entry => ['item', 'weapon', 'armor', 'shield'].includes(entry.kind)
    && !entry.deleted && entry.systems.some(system => c.systems.includes(system))), [entries, c.systems])
  const snares = items.filter(item => item.traits.some(trait => key(trait) === 'snare'))
  const basic = snares.filter(item => item.level === 1 && !featRarity(item))
  const other = sources.brastlewark ? snares.filter(item => item.level <= featTakenLevel(sources.brastlewark!)
    && featRarity(item) === 'Uncommon' && item.traits.some(trait => key(trait) === 'magical')) : []
  const gadgets = gadgetLimits(c, entries)
  const snareRanks = snareAdvancements(c, entries)
  const gadgetOptions = items.filter(item => item.traits.some(trait => key(trait) === 'gadget')
    && !['Rare', 'Unique'].includes(featRarity(item) ?? ''))
  const unique = (list: ContentEntry[]) => [...new Map(list.map(item => [key(item.name), item])).values()]
    .sort((a, b) => a.name.localeCompare(b.name))
  const options = (field: 'snareFormulaChoices' | 'snareAdvancementFormulaChoices' | 'brastlewarkFormulaChoices' | 'gadgetFormulaChoices', count: number, candidates: ContentEntry[], label: string, offset = 0) => {
    const values = c[field] ?? []
    return Array.from({ length: count }, (_, i) => {
      const index = i + offset
      const current = values[index] ?? ''
      const choices = unique(candidates).filter(item => key(item.name) === key(current) || !knownKeys.has(key(item.name)))
      return <label key={index}>{label} {i + 1}{' '}
        <select aria-label={`${label} ${i + 1}`} value={current} onChange={event => {
          const value = event.target.value
          if (value && !choices.some(item => item.name === value)) return
          const update = () => {
            save({ [field]: updateFormulaChoice(values, index, value) })
          }
          if (current && current !== value) confirmRemoval(`formula choice "${current}"`, update)
          else update()
        }}>
          <option value="">Choose formula</option>
          {current && !choices.some(item => item.name === current) && <option value={current} disabled>{current} (unavailable)</option>}
          {choices.map(item => <option key={item.id} value={item.name}>{item.name} (Level {item.level})</option>)}
        </select>
      </label>
    })
  }
  const q = key(query)
  const restricted = new Set(STANDARD_SNARE_FORMULAS.map(key))
  const matches = q.length < 2 ? [] : unique(items.filter(item => key(item.name).includes(q) && !knownKeys.has(key(item.name))
    && (sources.brastlewark || !restricted.has(key(item.name))))).slice(0, 40)
  return <div className="character-section-content">
      {sources.snareCrafting && <div className="col">
        <b>Snare Crafting</b><small>Choose four common 1st-level snare formulas.</small>
        {options('snareFormulaChoices', 4, basic, 'Snare Crafting formula')}
      </div>}
      {sources.brastlewark && <div className="col">
        <b>Brastlewark Snare Engineering</b>
        <label>Formula choice{' '}
          <select aria-label="Brastlewark formula choice" value={c.brastlewarkFormulaMode ?? ''}
            onChange={event => save({ brastlewarkFormulaMode: event.target.value === 'standard' ? 'standard'
              : event.target.value === 'other' ? 'other' : undefined })}>
            <option value="">Choose formulas</option>
            <option value="standard">Pit Illusion Snare and Shadow Cloak Snare</option>
            <option value="other">Two other uncommon magical snares</option>
          </select>
        </label>
        {c.brastlewarkFormulaMode === 'other' && <>
          <small>Choose snares of your level when you took the feat or lower. You must have access to each formula.</small>
          {options('brastlewarkFormulaChoices', 2, other, 'Brastlewark formula')}
        </>}
      </div>}
      {gadgets && <div className="col">
        <b>Gadget Specialist</b><small>Choose common or uncommon gadget formulas.</small>
        {options('gadgetFormulaChoices', gadgets.formulas, gadgetOptions, 'Gadget formula')}
      </div>}
      {snareRanks.map(({ rank, level }) => {
        const title = ['Expert', 'Master', 'Legendary'][rank - 2]
        return <div className="col" key={rank}>
          <b>Snarecrafter Dedication: {title}</b>
          <small>Choose three snares of level {level} or lower; confirm access to restricted formulas.</small>
          {options('snareAdvancementFormulaChoices', 3, snares.filter(item => item.level <= level
            && (sources.brastlewark || !restricted.has(key(item.name)))), `${title} snare formula`, (rank - 2) * 3)}
        </div>
      })}
      {known.length > 0 && <ul>{known.map(formula => {
        const entry = items.find(item => key(item.name) === key(formula.name))
        return <li key={key(formula.name)}>
          <EntryDescription name={formula.name} entry={entry} /> <small>({formula.source})</small>
          {formula.source === 'Other' && <button type="button" aria-label={`Remove ${formula.name} formula`}
            onClick={() => confirmRemoval(`formula "${formula.name}"`, () =>
              save({ formulas: (c.formulas ?? []).filter(name => key(name) !== key(formula.name)) }))}>Remove</button>}
        </li>
      })}</ul>}
      <label>Search formulas <input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <small>Add formulas learned from other sources. Knowing a formula does not grant access to restricted items.</small>
      {q.length >= 2 && <ul>{matches.map(item => <li key={item.id}>
        <EntryDescription name={item.name} entry={item} /> (Level {item.level}){' '}
        <button type="button" aria-label={`Add ${item.name} formula`} onClick={() => {
          if (!knownKeys.has(key(item.name))) save({ formulas: [...(c.formulas ?? []), item.name] })
          setQuery('')
        }}>Add</button>
      </li>)}</ul>}
      {q.length >= 2 && !matches.length && <small role="status">No matching formulas.</small>}
    </div>
}
