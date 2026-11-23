import { useMemo, useState } from 'react'
import { featTakenLevel, type SectionProps } from './builder'
import { confirmRemoval } from './confirmRemoval'
import { ActionIcon } from './ActionIcon'
import { EntryDescription } from './EntryDescription'
import { SearchableSelect } from './SearchableSelect'
import { PickerSort, sortPickerOptions, type PickerSortOrder } from './PickerSort'
import { contentAccessGranted, featRarity } from './featAccess'
import { formulaGrants, formulaKey as key, isCauldronConsumable, isGrenade, isInvestigatorAlchemyFormula, knownFormulas, munitionsFormulaOptions, STANDARD_SNARE_FORMULAS, updateFormulaChoice } from './formulas'
import type { Character, ContentEntry } from './types'

function availableFormulas(c: Character, list: ContentEntry[]) {
  return [...new Map(list.map(item => [key(item.name), item])).values()]
    .filter(item => contentAccessGranted(c, item) || c.gearAccessOverrides?.includes(item.id))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function FormulaSearch({ c, items, knownKeys, allowRestricted, save }: {
  c: Character; items: ContentEntry[]; knownKeys: Set<string>; allowRestricted: boolean; save: SectionProps['save']
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<PickerSortOrder>('name')
  const q = key(query)
  const restricted = new Set(STANDARD_SNARE_FORMULAS.map(key))
  const matches = q.length < 2 ? [] : sortPickerOptions(availableFormulas(c, items.filter(item => key(item.name).includes(q) && !knownKeys.has(key(item.name))
    && (allowRestricted || !restricted.has(key(item.name))))), sort, item => item.name, item => item.level).slice(0, 40)
  return <>
    <label>Search formulas <input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <PickerSort label="Sort formulas by" value={sort} onChange={setSort} />
    {q.length >= 2 && <ul>{matches.map(item => <li key={item.id}>
      <EntryDescription name={item.name} entry={item} deferDetails /> (Level {item.level}){' '}
      <button type="button" aria-label={`Add ${item.name} formula`} onClick={() => {
        if (!knownKeys.has(key(item.name))) save({ formulas: [...(c.formulas ?? []), item.name] })
        setQuery('')
      }}>Add</button>
    </li>)}</ul>}
    {q.length >= 2 && !matches.length && <small role="status">No matching formulas.</small>}
  </>
}

export function FormulasSummary({ c, entries }: Pick<SectionProps, 'c' | 'entries'>) {
  const grants = formulaGrants(c, entries)
  const { sources, gadgets, snares: snareRanks, munitions, grenades, cauldron, investigatorAlchemy } = grants
  const known = knownFormulas(c, entries, grants)
  const slots = (sources.snareCrafting ? 4 : 0) + (sources.brastlewark ? 2 : 0) + (gadgets?.formulas ?? 0)
    + (munitions ? munitions.formulaChoices : 0) + (grenades?.formulas ?? 0) + snareRanks.length * 3 + cauldron.length
    + (investigatorAlchemy?.formulas ?? 0)
  const filled = (sources.snareCrafting ? (c.snareFormulaChoices ?? []).slice(0, 4).filter(Boolean).length : 0)
    + (sources.brastlewark ? c.brastlewarkFormulaMode === 'standard' ? 2
      : c.brastlewarkFormulaMode === 'other' ? (c.brastlewarkFormulaChoices ?? []).slice(0, 2).filter(Boolean).length : 0 : 0)
    + (c.gadgetFormulaChoices ?? []).slice(0, gadgets?.formulas ?? 0).filter(Boolean).length
    + (c.munitionsFormulaChoices ?? []).slice(0, munitions?.formulaChoices ?? 0).filter(Boolean).length
    + (c.grenadeFormulaChoices ?? []).slice(0, grenades?.formulas ?? 0).filter(Boolean).length
    + (c.cauldronFormulaChoices ?? []).slice(0, cauldron.length).filter(Boolean).length
    + (c.investigatorAlchemicalFormulas ?? []).slice(0, investigatorAlchemy?.formulas ?? 0).filter(Boolean).length
    + snareRanks.reduce((sum, { rank }) => sum + (c.snareAdvancementFormulaChoices ?? []).slice((rank - 2) * 3, (rank - 1) * 3).filter(Boolean).length, 0)
  return <summary className="character-section-summary"><strong>Formulas</strong><span>{known.length} known{slots > 0 && `; ${filled}/${slots} choices`}</span></summary>
}

export function FormulasSection(props: SectionProps) {
  return <details className="character-section">
    <FormulasSummary {...props} />
    <FormulasContent {...props} />
  </details>
}

export function FormulasContent({ c, entries, save }: SectionProps) {
  const grants = formulaGrants(c, entries)
  const { sources, gadgets, munitions, grenades, snares: snareRanks, cauldron, investigatorAlchemy } = grants
  const known = knownFormulas(c, entries, grants)
  const knownKeys = new Set(known.map(formula => key(formula.name)))
  const items = useMemo(() => entries.filter(entry => ['item', 'weapon', 'armor', 'shield'].includes(entry.kind)
    && !entry.deleted && entry.systems.some(system => c.systems.includes(system))), [entries, c.systems])
  const snares = useMemo(() => items.filter(item => item.traits.some(trait => key(trait) === 'snare')), [items])
  const basic = useMemo(() => snares.filter(item => item.level === 1 && !featRarity(item)), [snares])
  const other = sources.brastlewark ? snares.filter(item => item.level <= featTakenLevel(sources.brastlewark!)
    && featRarity(item) === 'Uncommon' && item.traits.some(trait => key(trait) === 'magical')) : []
  const gadgetOptions = useMemo(() => items.filter(item => item.traits.some(trait => key(trait) === 'gadget')
    && !['Rare', 'Unique'].includes(featRarity(item) ?? '')), [items])
  const munitionsOptions = munitions ? munitionsFormulaOptions(items, c.systems) : []
  const options = (field: 'snareFormulaChoices' | 'snareAdvancementFormulaChoices' | 'brastlewarkFormulaChoices'
    | 'gadgetFormulaChoices' | 'munitionsFormulaChoices' | 'grenadeFormulaChoices' | 'cauldronFormulaChoices' | 'investigatorAlchemicalFormulas',
    count: number, candidates: ContentEntry[], label: string, offset = 0, distinct = false,
    eligible: (item: ContentEntry, index: number) => boolean = () => true) => {
    if (!count) return []
    const values = c[field] ?? []
    const available = availableFormulas(c, candidates)
    return Array.from({ length: count }, (_, i) => {
      const index = i + offset
      const current = values[index] ?? ''
      const choices = available.filter(item => eligible(item, index) && (!distinct
        || !values.slice(0, count).some((name, i) => i !== index && typeof name === 'string' && key(name) === key(item.name)))
        && (key(item.name) === key(current) || !knownKeys.has(key(item.name))))
      return <label key={index}>{label} {i + 1}{' '}
        <SearchableSelect aria-label={`${label} ${i + 1}`} value={current}
          optionLevel={value => choices.find(item => item.name === value)?.level} onChange={event => {
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
        </SearchableSelect>
      </label>
    })
  }
  const restricted = new Set(STANDARD_SNARE_FORMULAS.map(key))
  const investigatorAlchemyOptions = items.filter(item => isInvestigatorAlchemyFormula(item)
    && item.level <= c.level && !featRarity(item))
  const knownInvestigatorAlchemy = (c.investigatorAlchemicalFormulas ?? []).slice(0, investigatorAlchemy?.formulas ?? 0)
  const tinctureOptions = investigatorAlchemy ? knownInvestigatorAlchemy.flatMap(name => {
    const item = items.find(entry => key(entry.name) === key(name))
    return item && isInvestigatorAlchemyFormula(item) ? [item] : []
  }) : []
  const vials = investigatorAlchemy?.vials ?? 0
  const vialsSpent = Math.max(0, Math.min(vials, Math.trunc(c.investigatorVialsSpent ?? 0)))
  const selectedTincture = tinctureOptions.find(item => item.name === c.investigatorTinctureFormula)
  return <div className="character-section-content">
      {investigatorAlchemy && <div className="col">
        <b>Alchemical Sciences</b>
        <p>Versatile Vials: {Math.max(0, vials - vialsSpent)}/{vials}</p>
        {options('investigatorAlchemicalFormulas', investigatorAlchemy.formulas, investigatorAlchemyOptions,
          'Alchemical Sciences formula', 0, true, (item, index) => index < 2 ? item.level === 1 : item.level <= c.level)}
        <label>Quick Tincture formula{' '}
          <SearchableSelect aria-label="Quick Tincture formula" value={selectedTincture?.name ?? ''} onChange={event => {
            const value = event.target.value
            if (value && !tinctureOptions.some(item => item.name === value)) return
            save({ investigatorTinctureFormula: value || undefined, investigatorQuickTincture: undefined })
          }}>
            <option value="">Choose known formula</option>
            {c.investigatorTinctureFormula && !selectedTincture
              && <option value={c.investigatorTinctureFormula} disabled>{c.investigatorTinctureFormula} (unavailable)</option>}
            {tinctureOptions.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
          </SearchableSelect>
        </label>
        <div className="row">
          <button type="button" className="spell-action-button" aria-label="Create Quick Tincture (One Action)"
            disabled={!selectedTincture || vialsSpent >= vials} onClick={() => {
              if (!selectedTincture || vialsSpent >= vials) return
              save({ investigatorVialsSpent: vialsSpent + 1, investigatorQuickTincture: selectedTincture.name })
            }}><ActionIcon actions="Single Action" /></button>
          {c.investigatorQuickTincture && <small>Created: {c.investigatorQuickTincture}</small>}
          {vialsSpent > 0 && <button type="button" onClick={() => save({
            investigatorVialsSpent: 0, investigatorQuickTincture: undefined,
          })}>Reset daily vials</button>}
        </div>
      </div>}
      {sources.snareCrafting && <div className="col">
        <b>Snare Crafting</b>
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
          {options('brastlewarkFormulaChoices', 2, other, 'Brastlewark formula')}
        </>}
      </div>}
      {gadgets && <div className="col">
        <b>Gadget Specialist</b>
        {options('gadgetFormulaChoices', gadgets.formulas, gadgetOptions, 'Gadget formula')}
      </div>}
      {munitions && <div className="col">
        <b>Munitions Crafter</b>
        {options('munitionsFormulaChoices', munitions.formulaChoices, munitionsOptions, 'Munitions Crafter formula', 0, true)}
      </div>}
      {grenades && <div className="col">
        <b>Grenade Specialist</b>
        {options('grenadeFormulaChoices', grenades.formulas, items.filter(item => isGrenade(item) && !featRarity(item)), 'Grenade formula', 0, true)}
      </div>}
      {cauldron.length > 0 && <div className="col">
        <b>Cauldron</b>
        {cauldron.map((level, index) => index > 0 && level === 1 ? null : <span key={index}>{options('cauldronFormulaChoices',
          level === 1 ? cauldron.filter(value => value === 1).length : 1,
          items.filter(item => isCauldronConsumable(item) && item.level <= level), `Cauldron level ${level} formula`, index)}</span>)}
      </div>}
      {snareRanks.map(({ rank, level }) => {
        const title = ['Expert', 'Master', 'Legendary'][rank - 2]
        return <div className="col" key={rank}>
          <b>Snarecrafter Dedication: {title}</b>
          {options('snareAdvancementFormulaChoices', 3, snares.filter(item => item.level <= level
            && (sources.brastlewark || !restricted.has(key(item.name)))), `${title} snare formula`, (rank - 2) * 3)}
        </div>
      })}
      {known.length > 0 && <ul>{known.map(formula => {
        const entry = items.find(item => key(item.name) === key(formula.name))
        return <li key={key(formula.name)}>
          <EntryDescription name={formula.name} entry={entry} />
          {formula.source === 'Other' && <button type="button" aria-label={`Remove ${formula.name} formula`}
            onClick={() => confirmRemoval(`formula "${formula.name}"`, () =>
              save({ formulas: (c.formulas ?? []).filter(name => key(name) !== key(formula.name)) }))}>Remove</button>}
        </li>
      })}</ul>}
      <FormulaSearch c={c} items={items} knownKeys={knownKeys} allowRestricted={!!sources.brastlewark} save={save} />
    </div>
}
