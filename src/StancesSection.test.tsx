import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { activeStance, availableStances } from './builder'
import { EntryDescription } from './EntryDescription'
import { featDisplayName } from './featChoices'
import { FeatSlots } from './FeatSlots'
import { StancesContent } from './StancesSection'
import type { Character, ContentEntry } from './types'

const stance = (name: string, level = 1, traits = ['Stance']): ContentEntry => ({
  id: name, name, level, traits, kind: 'feat', systems: ['pf2e'], source: 'official',
  description: `Rules for ${name}.`, data: {}, effects: [], updatedAt: 0,
})
const base: Character = {
  id: 'stances', systems: ['pf2e'], name: 'Test', level: 16, className: 'Fighter',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const learn = (entry: ContentEntry): Character['feats'][number] => ({
  name: entry.name, type: 'Class Feat', level: entry.level, sourceId: entry.id,
})

it('lists learned stances once in display order, rejecting future, deleted and wrong-source selections', () => {
  const entries = [stance('Zebra Stance'), stance('Air Shroud'), stance('Future Stance', 18),
    stance('Never Learned'), stance('Stance Savant', 1, ['Fighter']),
    { ...stance('Deleted Stance'), deleted: true }, { ...stance('SF Stance'), systems: ['sf2e'] as const },
    stance('Missing Source')]
  const catalog: ContentEntry[] = entries.map(entry => ({ ...entry, systems: [...entry.systems] }))
  const c: Character = { ...base, activeStance: 'Future Stance',
    feats: [...catalog.filter(entry => entry.name !== 'Never Learned').map(learn), learn(catalog[1])]
      .map(feat => feat.name === 'Missing Source' ? { ...feat, sourceId: 'missing' } : feat) }
  expect(availableStances(c, catalog).map(entry => featDisplayName(entry))).toEqual(['Air Shroud Stance', 'Zebra Stance'])
  expect(activeStance(c, catalog)).toBeUndefined()
})

it('deduplicates equivalent Fighter and Ranger stance titles without losing saved activation', () => {
  const entries = [stance('Twinned Defense Stance', 16, ['Ranger', 'Stance']),
    stance('Twinned Defense (Fighter)', 16, ['Fighter', 'Stance'])]
  const c: Character = { ...base, feats: entries.map(learn), activeStance: entries[1].name }
  expect(availableStances(c, entries)).toEqual([entries[1]])
  expect(activeStance(c, entries)).toBe(entries[1])
})

it('saves one active stance, switches stances and allows leaving without changing learned feats', () => {
  const entries = [stance('Zebra Stance'), stance('Air Shroud')]
  let c: Character = { ...base, feats: entries.map(learn) }
  const original = JSON.stringify(c.feats)
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const controls = () => {
    const inputs: { checked: boolean; onChange: () => void }[] = []
    const visit = (node: ReactNode) => Children.forEach(node, child => {
      if (!isValidElement<{ children?: ReactNode; checked: boolean; onChange: () => void }>(child)) return
      if (child.type === 'input') inputs.push(child.props)
      visit(child.props.children)
    })
    visit(StancesContent({ c, entries, save }))
    return inputs
  }
  expect(controls().map(input => input.checked)).toEqual([true, false, false])
  controls()[1].onChange()
  expect(save).toHaveBeenLastCalledWith({ activeStance: 'Air Shroud' })
  expect(controls().map(input => input.checked)).toEqual([false, true, false])
  controls()[2].onChange()
  expect(save).toHaveBeenLastCalledWith({ activeStance: 'Zebra Stance' })
  expect(controls().map(input => input.checked)).toEqual([false, false, true])
  controls()[0].onChange()
  expect(c.activeStance).toBeUndefined()
  expect(JSON.stringify(c.feats)).toBe(original)
})

it.each([
  ['Twinned Defense (Fighter)', ['Fighter', 'Stance'], 'Twinned Defense Stance'],
  ['Ricochet Stance (Rogue)', ['Rogue', 'Stance'], 'Ricochet Stance'],
  ['Air Shroud', ['Stance'], 'Air Shroud Stance'],
  ['Tiger Stance', ['Stance'], 'Tiger Stance'],
  ['Stance Savant', ['Fighter'], 'Stance Savant'],
])('uses clear stance titles for %s without renaming stored content', (name, traits, expected) => {
  const entry = stance(name, 1, traits)
  const before = JSON.stringify(entry)
  const markup = renderToStaticMarkup(<EntryDescription entry={entry} name={entry.name} />)
  expect(featDisplayName(entry)).toBe(expected)
  expect(featDisplayName(entry, expected)).toBe(expected)
  expect(markup).toContain(`aria-haspopup="dialog">${expected}</button>`)
  expect(markup).toContain(`tabindex="-1">${expected}<small>`)
  expect(markup).toContain(entry.description)
  expect(JSON.stringify(entry)).toBe(before)
})

it('searches and displays the renamed Fighter feat using its canonical saved selection', () => {
  const entry = stance('Twinned Defense (Fighter)', 16, ['Fighter', 'Stance'])
  const c: Character = { ...base, feats: [{ ...learn(entry), slot: 'class:16:0' }] }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[entry]} save={() => {}} categories={['class']}
    search={{ 'class:16:0:open': '1', 'class:16:0:query': 'twinned defense stance' }} onSearch={() => {}} />)
  expect(markup).toContain('L16 Class: Twinned Defense Stance')
  expect(markup).toContain('aria-haspopup="dialog">Twinned Defense Stance</button>')
  expect(c.feats[0].name).toBe(entry.name)
})
