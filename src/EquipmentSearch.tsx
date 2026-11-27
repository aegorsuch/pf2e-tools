import { useEffect, useMemo, useState } from 'react'
import { ActionIcon } from './ActionIcon'
import { activeFeatsNamed, ringCapacity, ringCount, type SectionProps } from './builder'
import { isCompanionEquipmentItem } from './companions'
import { EntryDescription } from './EntryDescription'
import { EQUIPMENT_BONUS_SKILLS, equipmentBonusSkills, equipmentDisplayName, equipmentFitsGroup, equipmentGroupName, equipmentSkillBonuses, type EquipmentGroupName } from './equipmentGroups'
import { GearSystemFilter } from './GearSystemFilter'
import { matchesGearSystem, type GearSystem } from './gearSystem'
import { PickerSort, sortPickerOptions, type PickerSortOrder } from './PickerSort'

const PAGE = 100

export function EquipmentSearch({ c, entries, save, category, onClose, fixedSkill }: SectionProps & {
  category?: EquipmentGroupName; onClose?: () => void; fixedSkill?: string
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<PickerSortOrder>('name')
  const [system, setSystem] = useState<GearSystem>('both')
  const [skill, setSkill] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const ringsFull = ringCount(c, entries) >= ringCapacity(c)
  const candidates = useMemo(() => entries.filter(entry => entry.kind === 'item'
    && !isCompanionEquipmentItem(entry) && (!category || equipmentFitsGroup(entry, category))).map(entry => {
    const displayName = equipmentDisplayName(entry.name)
    return {
      entry,
      displayName,
      searchName: entry.name.replace(/[\u2018\u2019]/g, "'").toLowerCase(),
      searchDisplay: displayName.toLowerCase(),
      key: entry.source === 'official' && entry.data.url
        ? `${entry.systems.join(',')}:${entry.data.url}:${entry.level}:${displayName}` : entry.id,
    }
  }), [category, entries])
  const availableSkills = useMemo(() => {
    if (fixedSkill) return []
    const found = new Set<string>()
    for (const { entry } of candidates) {
      if (matchesGearSystem(entry, system, c.systems))
        for (const name of equipmentBonusSkills(entry)) found.add(name)
    }
    return EQUIPMENT_BONUS_SKILLS.filter(name => found.has(name))
  }, [candidates, system, c.systems, fixedSkill])
  const selectedSkill = fixedSkill ?? availableSkills.find(name => name === skill) ?? ''
  useEffect(() => {
    if (skill && !selectedSkill) setSkill('')
  }, [skill, selectedSkill])
  useEffect(() => {
    if (!selectedSkill && sort === 'item-bonus') setSort('name')
  }, [selectedSkill, sort])
  const active = !!query.trim() || !!category || !!selectedSkill
  const matches = useMemo(() => {
    if (!active) return []
    const q = query.trim().replace(/[\u2018\u2019]/g, "'").toLowerCase()
    const owned = new Set(c.equipment.map(item => item.name))
    const unique = new Map<string, typeof candidates[number]>()
    for (const candidate of candidates) {
      const { entry, key, searchName, searchDisplay } = candidate
      if (q && !searchName.includes(q) && !searchDisplay.includes(q)) continue
      if (!matchesGearSystem(entry, system, c.systems)) continue
      if (selectedSkill && !equipmentBonusSkills(entry).has(selectedSkill)) continue
      const previous = unique.get(key)?.entry
      if (!previous || owned.has(entry.name) || !owned.has(previous.name)
        && entry.data.price !== undefined && previous.data.price === undefined) unique.set(key, candidate)
    }
    const sorted = sortPickerOptions([...unique.values()], sort === 'item-bonus' ? 'name' : sort,
      candidate => candidate.displayName, candidate => candidate.entry.level)
    if (sort === 'item-bonus' && selectedSkill) sorted.sort((a, b) => {
      const aBonus = equipmentSkillBonuses(a.entry, selectedSkill).at(-1)
      const bBonus = equipmentSkillBonuses(b.entry, selectedSkill).at(-1)
      if (aBonus === undefined) return bBonus === undefined ? 0 : 1
      if (bBonus === undefined) return -1
      return bBonus - aBonus
    })
    return sorted
      .map(candidate => candidate.entry)
  }, [active, candidates, query, c.equipment, c.systems, sort, system, selectedSkill])
  return <div className="equipment-search">
    <div className="row">
      <input type="search" aria-label={`Search ${category?.toLowerCase() ?? 'equipment'}`} placeholder={`Search ${category?.toLowerCase() ?? 'equipment'}`}
        autoFocus={!!onClose} value={query} onChange={event => { setQuery(event.target.value); setLimit(PAGE) }} />
      <GearSystemFilter value={system} onChange={value => { setSystem(value); setLimit(PAGE) }} />
      <PickerSort label={`Sort ${category?.toLowerCase() ?? 'equipment'} by`}
        value={!selectedSkill && sort === 'item-bonus' ? 'name' : sort} onChange={value => { setSort(value); setLimit(PAGE) }} includeItemBonus={!!selectedSkill} />
      {!fixedSkill && availableSkills.length > 0 && <label>Skill item bonus <select aria-label="Skill item bonus" value={selectedSkill} onChange={event => { setSkill(event.target.value); setLimit(PAGE) }}>
        <option value="">All skills</option>
        {availableSkills.map(name => <option key={name}>{name}</option>)}
      </select></label>}
      {onClose && <button type="button" onClick={onClose}>Cancel</button>}
    </div>
    <ul className="gear-results">
      {matches.slice(0, limit).map(g => <li key={g.id}>
        <EntryDescription name={g.name} entry={g} className="equipment-name" deferDetails /> <ActionIcon entry={g} /> ({g.kind}{g.level ? ` ${g.level}` : ''})
        {selectedSkill && equipmentSkillBonuses(g, selectedSkill).length > 0
          && <> {'('}{equipmentSkillBonuses(g, selectedSkill).map(value => `+${value}`).join('/')}{')'}</>}{' '}
        <button aria-label={`Add ${equipmentDisplayName(g.name)}`} disabled={equipmentGroupName(g) === 'Rings' && ringsFull
          || g.name === 'Storied Skin' && (c.equipment.some(item => item.name === g.name && item.qty > 0)
            || c.systems.includes('pf2e') && activeFeatsNamed(c, 'Tattooed Historian Dedication').length > 0)}
          title={equipmentGroupName(g) === 'Rings' && ringsFull ? 'Ring capacity reached' : undefined} onClick={() => {
          const have = c.equipment.find(item => item.name === g.name
            && (equipmentGroupName(g) !== 'Scrolls' || !item.scrollSpell)
            && (!category || equipmentGroupName(g, item.name, item.group) === category))
          save({ equipment: have ? c.equipment.map(item => item === have ? { ...item, qty: item.qty + 1 } : item)
            : [...c.equipment, { name: g.name, qty: 1, ...(category ? { group: category } : {}) }] })
          onClose?.()
        }}>Add</button>
      </li>)}
      {matches.length > limit && <li><button type="button" onClick={() => setLimit(previous => previous + PAGE)}>
        Show more ({matches.length - limit} left, or use search)
      </button></li>}
      {active && !matches.length && <li><small>No matching {category?.toLowerCase() ?? 'equipment'}.</small></li>}
    </ul>
  </div>
}
