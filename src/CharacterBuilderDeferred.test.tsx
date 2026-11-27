// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { CharacterBuilder, ClassPick, HeritagePick } from './CharacterBuilder'
import { FeatSlots } from './FeatSlots'
import { ArmorUpgrades, Augmentations } from './GearSection'
import { armorClass, plannedSlots } from './builder'
import { StatusesContent, StatusesSummary } from './StatusesSection'
import { SkillsSection } from './SkillsSection'
import type { Character, ContentEntry, EnergizedSpikesEnergy } from './types'

it('selects and persists Stellar Nomad Lore heritage variants', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  let c: Character = { id: 'nomad', name: 'Test', systems: ['sf2e'], level: 1, ancestry: 'Kasatha',
    heritage: 'Stellar Nomad Kasatha', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const heritage: ContentEntry = { id: 'nomad', name: 'Stellar Nomad Kasatha', kind: 'heritage', systems: ['sf2e'],
    source: 'official', level: 1, traits: [], description: '', data: {}, effects: [], updatedAt: 0 }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const render = async () => act(async () => root.render(<HeritagePick c={c} entries={[heritage]} save={patch => { c = { ...c, ...patch } }} />))
  try {
    await render()
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Heritage"]')!
    await act(async () => select.dispatchEvent(new FocusEvent('focusin', { bubbles: true })))
    for (const lore of ['Vesk Lore', 'Damoritosh Lore', 'Pact Worlds Lore'] as const) {
      const value = `Stellar Nomad Kasatha (${lore})`
      expect([...select.options].some(option => option.value === value)).toBe(true)
      await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })) })
      expect(c.heritage).toBe('Stellar Nomad Kasatha')
      expect(c.stellarNomadLore).toBe(lore)
      c = JSON.parse(JSON.stringify(c))
      await render()
      expect(select.value).toBe(value)
    }
    await act(async () => { select.value = 'Stellar Nomad Kasatha'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(c.stellarNomadLore).toBeUndefined()
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})

it('filters the character class picker by system without losing the selected class', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  const c: Character = { id: 'class-picker', systems: ['pf2e', 'sf2e'], name: 'Test', level: 1, className: 'Fighter',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const entry = (name: string, systems: ContentEntry['systems']): ContentEntry => ({ id: name, name, systems,
    kind: 'class', source: 'official', level: 1, traits: [], description: '', data: {}, effects: [], updatedAt: 0 })
  const options = [entry('Fighter', ['pf2e']), entry('Mechanic', ['sf2e']), entry('Shared', ['pf2e', 'sf2e'])]
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<ClassPick c={c} entries={options} options={options} save={() => {}} />))
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Class"]')!.click())
    const filter = document.querySelector<HTMLSelectElement>('select[aria-label="Systems"]')!
    await act(async () => { filter.value = 'sf2e'; filter.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(document.querySelector('button[aria-label="Class: Mechanic"]')).toBeTruthy()
    expect(document.querySelector('button[aria-label="Class: Shared"]')).toBeTruthy()
    expect(document.querySelector('button[aria-label="Class: Fighter"]')).toBeNull()
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="Class"]')!.value).toBe('Fighter')
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})

it('selects and preserves Test-Subject heritage variants', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  let c: Character = {
    id: 'ysoki-variants', systems: ['sf2e'], name: 'Test', level: 1, ancestry: 'Ysoki',
    heritage: 'Test-Subject Ysoki',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const heritage: ContentEntry = { id: 'ysoki-heritage', name: 'Test-Subject Ysoki', kind: 'heritage',
    source: 'official', systems: ['sf2e'], level: 0, traits: ['Ysoki'], description: '', data: {}, effects: [], updatedAt: 0 }
  const other: ContentEntry = { ...heritage, id: 'other', name: 'Cyborg', traits: [] }
  const entries = [heritage, other]
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const render = async () => {
    await act(async () => root.render(<HeritagePick c={c} entries={entries} save={patch => { c = { ...c, ...patch } }} />))
  }
  try {
    await render()
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Heritage"]')!
    expect(select.value).toBe('Test-Subject Ysoki')
    await act(async () => select.dispatchEvent(new FocusEvent('focusin', { bubbles: true })))
    for (const adaptation of ['Cybernetic Augmentation', 'Extra Limbs', 'Psychic Augmentation', 'Radioactive'] as const) {
      const value = `Test-Subject Ysoki (${adaptation})`
      expect([...select.options].some(option => option.value === value)).toBe(true)
      await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })) })
      expect(c.heritage).toBe('Test-Subject Ysoki')
      expect(c.testSubjectAdaptation).toBe(adaptation)
      c = JSON.parse(JSON.stringify(c))
      await render()
      expect(select.value).toBe(value)
    }
    await act(async () => { select.value = 'Cyborg'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(c.heritage).toBe('Cyborg')
    expect(c.testSubjectAdaptation).toBeUndefined()
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})

it('keeps section summaries current without mounting closed section controls', () => {
  const c: Character = {
    id: 'deferred', systems: ['pf2e'], name: 'Deferred', level: 4, className: 'Druid',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    formulas: ['Rope'], companions: [{ id: 'wolf', type: 'Wolf', name: 'Fang' }],
    spells: [{ name: 'Heal', rank: 1, cantrip: false }],
    spellcasting: { ability: 'wis', tradition: 'Primal', rank: 1, slots: {}, prepared: { '1:0': 'Heal' } },
  }
  const render = (character: Character) => renderToStaticMarkup(
    <CharacterBuilder character={character} catalog={[]} onClose={() => {}} />,
  )
  const markup = render(c)
  expect(markup).toContain('1 known')
  expect(markup).toContain('Young Wolf (Fang)')
  expect(markup).toContain('<strong>Spells</strong><span>1/11 spells</span>')
  expect(markup).not.toContain('Search formulas')
  expect(markup).not.toContain('Companion type')
  expect(markup).not.toContain('Search spells')
  expect(render({ ...c, formulas: [], companions: [], spells: [] })).toContain('0 known')
  expect(render({ ...c, formulas: [], companions: [], spells: [] })).toContain('0 minions')
  expect(render({ ...c, formulas: [], companions: [], spells: [], spellcasting: undefined })).toContain('0/11 spells')
})

it('updates resistance values and opens their notes without toggling Defense', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const c: Character = {
    id: 'resistance-summary', systems: ['pf2e'], name: 'Test', level: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const poison: ContentEntry = { id: 'poison-resistance', name: 'Poison Resistance', kind: 'feat',
    source: 'official', systems: ['pf2e'], level: 2, traits: [], description: '',
    data: { resistances: 'poison=half' }, effects: [], updatedAt: 0 }
  const render = async (character: Character) => act(async () => root.render(
    <CharacterBuilder character={character} catalog={[poison]} onClose={() => {}} />,
  ))
  try {
    await render(c)
    const section = [...container.querySelectorAll('details')].find(details =>
      details.querySelector(':scope > summary > strong')?.textContent === 'Defense')!
    const summary = section.querySelector(':scope > summary')!
    expect(summary.textContent).toContain('Resistances: None')
    const withPoison = { ...c, feats: [{ name: 'Poison Resistance', type: 'Class Feat', level: 2 }] }
    await render(withPoison)
    expect(summary.textContent).toContain('Poison 5')
    const note = summary.querySelector<HTMLButtonElement>('[aria-label="Poison Resistance note"]')!
    expect(note).toBeTruthy()
    await act(async () => note.click())
    expect(section.open).toBe(false)
    await render({ ...withPoison, level: 20 })
    expect(summary.textContent).toContain('Poison 10')
    await render(c)
    expect(summary.textContent).toContain('Resistances: None')
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})

it('rolls Tenth Life healing using six d8s and half the character level', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const random = vi.spyOn(Math, 'random').mockReturnValue(0)
  const feat: ContentEntry = { id: 'tenth-life', systems: ['sf2e'], kind: 'feat', source: 'official',
    name: 'Tenth Life', level: 17, traits: ['Pahtra'], description: '', data: { actions: 'Reaction' }, effects: [], updatedAt: 0 }
  const c: Character = { id: 'tenth-life', name: 'Test', systems: ['sf2e'], ancestry: 'Pahtra', level: 17,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: feat.name, type: 'Ancestry Feat', level: 17, slot: 'ancestry:17:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<FeatSlots c={c} entries={[feat]} categories={['ancestry']} save={() => {}} />))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Roll Tenth Life: Healing"]')!.click())
    expect(container.querySelector('[aria-label="Tenth Life: Healing result"]')?.textContent).toContain('14 HP')
    expect(random).toHaveBeenCalledTimes(6)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    random.mockRestore()
    vi.unstubAllGlobals()
  }
})

it('rolls Solarian feat damage with the selected attunement', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const random = vi.spyOn(Math, 'random').mockReturnValue(0)
  const feat: ContentEntry = { id: 'plasma-ejection', systems: ['sf2e'], kind: 'feat', source: 'official',
    name: 'Plasma Ejection', level: 4, traits: ['Solarian'], description: '', data: { actions: 'Two Actions' }, effects: [], updatedAt: 0 }
  const c: Character = { id: 'solar-roll', name: 'Test', systems: ['sf2e'], className: 'Solarian', level: 6,
    solarianAttunement: 'Photon', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: feat.name, type: 'Class Feat', level: 4, slot: 'class:4:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<FeatSlots c={c} entries={[feat]} categories={['class']} save={() => {}} />))
    const row = container.querySelector<HTMLButtonElement>('[aria-label="Roll Plasma Ejection: Damage"]')!.closest('li')!
    expect([...row.querySelectorAll('.action-cost')].filter(icon => !icon.closest('dialog'))).toHaveLength(1)
    random.mockClear()
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Roll Plasma Ejection: Damage"]')!.click())
    expect(container.querySelector('[aria-label="Plasma Ejection: Damage results"]')?.textContent).toContain('4 fire')
    expect(container.querySelector('[aria-label="Plasma Ejection: Damage results"]')?.textContent).toContain('1 electricity')
    expect(random).toHaveBeenCalledTimes(5)
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Hide Plasma Ejection results"]')!.click())
    expect(container.querySelector('[aria-label="Plasma Ejection: Damage results"]')).toBeNull()
    expect(random).toHaveBeenCalledTimes(5)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    random.mockRestore()
    vi.unstubAllGlobals()
  }
})

it.each([
  ['Supernova', 8, 'Photon', '15-foot damage: 8 fire', '30-foot damage: 8 fire'],
  ['Big Bang', 14, 'Photon', 'Damage: 10 fire', 'Critical failure persistent damage: 4 fire'],
] as const)('rolls and hides all %s effects with one action', async (name, level, attunement, first, second) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const random = vi.spyOn(Math, 'random').mockReturnValue(0)
  const feat: ContentEntry = { id: name, systems: ['sf2e'], kind: 'feat', source: 'official', name, level,
    traits: ['Solarian'], description: '', data: { actions: name === 'Big Bang' ? 'Three Actions' : 'Two Actions' }, effects: [], updatedAt: 0 }
  const c: Character = { id: name, name, systems: ['sf2e'], className: 'Solarian', level,
    solarianAttunement: attunement, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name, type: 'Class Feat', level, slot: `class:${level}:0` }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<FeatSlots c={c} entries={[feat]} categories={['class']} save={() => {}} />))
    const button = container.querySelector<HTMLButtonElement>(`[aria-label="Roll ${name}: Damage"]`)!
    expect([...button.closest('li')!.querySelectorAll('.action-cost')].filter(icon => !icon.closest('dialog'))).toHaveLength(1)
    await act(async () => button.click())
    const output = container.querySelector(`[aria-label="${name}: Damage results"]`)!
    expect(output.textContent).toContain(first)
    expect(output.textContent).toContain(second)
    const rolls = random.mock.calls.length
    await act(async () => button.click())
    expect(container.querySelector(`[aria-label="${name}: Damage results"]`)).toBeNull()
    expect(random).toHaveBeenCalledTimes(rolls)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    random.mockRestore()
    vi.unstubAllGlobals()
  }
})

it.each([
  ['Commercial', 2, false], ['Tactical', 5, true], ['Advanced', 8, false],
] as const)(
  'opens %s Energized Spikes and rolls selected damage', async (grade, dice, installed) => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    } })
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    const item: ContentEntry = { id: grade, name: `Energized Spikes (${grade})`, systems: ['sf2e'], kind: 'item',
      source: 'official', level: 1, traits: [], description: '', data: { item_subcategory: 'Armor Upgrades' }, effects: [], updatedAt: 0 }
    let energy: EnergizedSpikesEnergy | undefined
    const changeEnergy = vi.fn((next: EnergizedSpikesEnergy | undefined) => { energy = next })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    try {
      const render = async () => act(async () => root.render(<ArmorUpgrades entries={[item]} upgrades={installed ? [item.id] : []} automaticUpgrades={installed ? [] : [item]}
        limit={1} worn energizedSpikesEnergy={energy} onEnergizedSpikesEnergyChange={changeEnergy} onChange={() => {}} onToggleJetpack={() => {}} />))
      await render()
      expect(container.querySelector('dialog[open]')).toBeNull()
      const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(candidate => candidate.textContent?.includes(item.name))!
      await act(async () => button.click())
      const dialog = container.querySelector<HTMLDialogElement>('dialog[open]')!
      const select = dialog.querySelector<HTMLSelectElement>('[aria-label="Energized Spikes damage type"]')!
      await act(async () => { select.value = 'fire'; select.dispatchEvent(new Event('change', { bubbles: true })) })
      expect(changeEnergy).toHaveBeenCalledWith('fire')
      expect(random).not.toHaveBeenCalled()
      await render()
      const roll = container.querySelector<HTMLButtonElement>('[aria-label="Roll Energized Spikes: Damage"]')!
      expect(roll.closest('dialog')).toBeNull()
      expect(roll.querySelector('[aria-label="Free Action"]')).toBeTruthy()
      await act(async () => roll.click())
      expect(changeEnergy).toHaveBeenLastCalledWith(undefined)
      expect(random).toHaveBeenCalledTimes(dice)
      await render()
      expect(container.querySelector('[aria-label="Energized Spikes: Damage result"]')?.textContent).toContain(`${dice} fire`)
      await act(async () => roll.click())
      expect(container.querySelector('[aria-label="Energized Spikes: Damage result"]')).toBeNull()
      await act(async () => roll.click())
      expect(container.querySelector('[aria-label="Energized Spikes: Damage result"]')?.textContent).toContain(`${dice} piercing`)
    } finally {
      await act(async () => root.unmount())
      container.remove()
      random.mockRestore()
      vi.unstubAllGlobals()
    }
  },
)

it.each([
  ['Commercial', 2, 17], ['Tactical', 4, 23], ['Advanced', 6, 28],
  ['Superior', 10, 34], ['Elite', 14, 41],
] as const)('rolls %s Kinetic Generator reaction damage', async (grade, dice, dc) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const random = vi.spyOn(Math, 'random').mockReturnValue(0)
  const item: ContentEntry = { id: grade, name: `Kinetic Generator (${grade})`, systems: ['sf2e'], kind: 'item',
    source: 'official', level: 1, traits: [], description: '', data: { item_subcategory: 'Armor Upgrades' }, effects: [], updatedAt: 0 }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    const render = async (worn: boolean) => act(async () => root.render(<ArmorUpgrades entries={[item]} upgrades={[]}
      automaticUpgrades={[item]} limit={1} worn={worn} onChange={() => {}} onToggleJetpack={() => {}} />))
    await render(false)
    const button = container.querySelector<HTMLButtonElement>('[aria-label="Roll Short Circuit: Damage"]')!
    expect(button.disabled).toBe(true)
    expect(button.querySelector('[aria-label="Reaction"]')).toBeTruthy()
    await render(true)
    expect(button.disabled).toBe(false)
    await act(async () => button.click())
    const result = container.querySelector('[aria-label="Short Circuit: Damage result"]')!
    expect(result.textContent).toContain(`${dice} electricity`)
    expect(result.textContent).toContain(`DC ${dc} basic Reflex`)
    expect(result.textContent).toContain('at least 10 charges')
    expect(random).toHaveBeenCalledTimes(dice)
    await act(async () => button.click())
    expect(container.querySelector('[aria-label="Short Circuit: Damage result"]')).toBeNull()
    expect(random).toHaveBeenCalledTimes(dice)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    random.mockRestore()
    vi.unstubAllGlobals()
  }
})

it('disables manually installed Kinetic Generator beyond armor capacity', () => {
  const item: ContentEntry = { id: 'kinetic', name: 'Kinetic Generator (Commercial)', systems: ['sf2e'], kind: 'item',
    source: 'official', level: 3, traits: [], description: '', data: { item_subcategory: 'Armor Upgrades' }, effects: [], updatedAt: 0 }
  const markup = renderToStaticMarkup(<ArmorUpgrades entries={[item]} upgrades={[item.id]} limit={0} worn
    onChange={() => {}} onToggleJetpack={() => {}} />)
  expect(markup).toMatch(/disabled=""[^>]*aria-label="Roll Short Circuit: Damage"/)
})

it('opens augmentation picker from plus below installed augmentations and installs a choice', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const entry: ContentEntry = { id: 'wings', name: 'Ultralight Wings', systems: ['sf2e'], kind: 'item',
    source: 'official', level: 1, traits: [], description: '', data: { item_category: 'Augmentations' }, effects: [], updatedAt: 0 }
  const c: Character = { id: 'augment', name: 'Test', systems: ['sf2e'], level: 5,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    augmentations: [{ id: 'existing', entryId: 'old', name: 'Existing implant', slot: 'standard' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Augmentations c={c} entries={[entry]} save={save} />))
    const add = container.querySelector<HTMLButtonElement>('button[aria-label="Add augmentation"]')!
    expect(add.textContent).toBe('+')
    expect(add.compareDocumentPosition(container.querySelector('li')!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    await act(async () => add.click())
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Select Ultralight Wings (level 1)"]')!.click())
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ augmentations: expect.arrayContaining([
      expect.objectContaining({ entryId: 'wings', name: 'Ultralight Wings' }),
    ]) }))
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})

it('filters augmentation choices by trait alongside search and apex filters', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const entry = (name: string, traits: string[]): ContentEntry => ({
    id: name, name, systems: ['sf2e'], kind: 'item', source: 'official', level: 1,
    traits, description: '', data: { item_category: 'Augmentations' }, effects: [], updatedAt: 0,
  })
  const entries = [
    entry('Tech Implant', ['Tech']), entry('Biotech Implant', ['Biotech']),
    entry('Necrograft Implant', ['Necrograft']), entry('Magitech Implant', ['Magitech', 'Apex']),
    entry('Hybrid Implant', ['tech', 'Biotech']), entry('Unclassified Implant', []),
  ]
  const c: Character = { id: 'augment-traits', name: 'Test', systems: ['sf2e'], level: 5,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const save = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Augmentations c={c} entries={entries} save={save} />))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Add augmentation"]')!.click())
    const dialog = document.querySelector<HTMLElement>('[aria-label="Add augmentation picker"]')!
    const trait = dialog.querySelector<HTMLSelectElement>('[aria-label="Filter augmentations by trait"]')!
    const visible = (name: string) => !!dialog.querySelector(`[aria-label="Select ${name} (level 1)"]`)
    const selectTrait = async (value: string) => act(async () => {
      trait.value = value
      trait.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(visible('Unclassified Implant')).toBe(true)
    expect([...trait.options].filter(option => option.value === 'tech')).toHaveLength(1)
    for (const [value, name] of [['tech', 'Tech Implant'], ['biotech', 'Biotech Implant'],
      ['necrograft', 'Necrograft Implant'], ['magitech', 'Magitech Implant']] as const) {
      await selectTrait(value)
      expect(visible(name)).toBe(true)
      expect(visible('Unclassified Implant')).toBe(false)
    }
    await selectTrait('tech')
    expect(visible('Hybrid Implant')).toBe(true)
    const search = dialog.querySelector<HTMLInputElement>('[aria-label="Search augmentation"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Hybrid')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(visible('Hybrid Implant')).toBe(true)
    expect(visible('Tech Implant')).toBe(false)
    const apex = dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    await act(async () => apex.click())
    expect(dialog.querySelector('[role="status"]')?.textContent).toBe('No matches.')
    await act(async () => apex.click())
    await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="Select Hybrid Implant (level 1)"]')!.click())
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ augmentations: expect.arrayContaining([
      expect.objectContaining({ entryId: 'Hybrid Implant' }),
    ]) }))
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})

it('raises installed dermal plating, applies AC, and disables it when damaged or removed', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  let c: Character = { id: 'plating', name: 'Test', systems: ['sf2e'], level: 5,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, feats: [],
    augmentations: [{ id: 'plate', entryId: 'plate', name: 'Dermal Plating (Tactical)', slot: 'standard' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const render = async () => act(async () => root.render(<>
    <StatusesContent c={c} entries={[]} save={save} />
    <StatusesSummary c={c} entries={[]} save={save} />
    <SkillsSection c={c} entries={[]} save={save} part="defense" />
    <Augmentations c={c} entries={[]} save={save} />
  </>))
  try {
    const baseAc = armorClass(c, [])
    await render()
    const toggle = () => container.querySelector<HTMLInputElement>('[aria-label="Raise Dermal Plating status"]')!
    expect(toggle()).not.toBeNull()
    await act(async () => toggle().click())
    await render()
    expect(c.dermalPlating?.raised).toBe(true)
    expect(armorClass(c, [])).toBe(baseAc + 1)
    expect(container.querySelector<HTMLInputElement>('[aria-label="Raise Dermal Plating (defense)"]')?.checked).toBe(true)
    expect(container.textContent).toContain('Raise Dermal Plating')
    const shield = { id: 'shield', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: true }
    expect(armorClass({ ...c, shield }, [])).toBe(armorClass({ ...c, shield, dermalPlating: undefined }, []))
    c = { ...c, dermalPlating: { ...c.dermalPlating, damaged: true } }
    await render()
    expect(toggle().disabled).toBe(true)
    expect(toggle().checked).toBe(false)
    expect(armorClass(c, [])).toBe(baseAc)
    c = { ...c, augmentations: [], dermalPlating: { raised: true } }
    await render()
    expect(container.querySelector('[aria-label="Raise Dermal Plating status"]')).toBeNull()
    expect(armorClass(c, [])).toBe(baseAc)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})

it('rolls Constellation Vortex damage and shatter with selected weapon count', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const random = vi.spyOn(Math, 'random').mockReturnValue(0)
  const feat: ContentEntry = { id: 'constellation-vortex', systems: ['sf2e'], kind: 'feat', source: 'official',
    name: 'Constellation Vortex', level: 6, traits: ['Solarian'], description: '', data: { actions: 'Single Action' }, effects: [], updatedAt: 0 }
  const c: Character = { id: 'vortex', name: 'Test', systems: ['sf2e'], className: 'Solarian', level: 9,
    solarianAttunement: 'Graviton', solarianWeapon: { damageType: 'Slashing' },
    abilities: { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [{ name: feat.name, type: 'Class Feat', level: 6, slot: 'class:6:0' }],
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0 }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    const render = async (character: Character) => act(async () => root.render(
      <FeatSlots c={character} entries={[feat]} categories={['class']} save={() => {}} />))
    await render(c)
    const roll = () => container.querySelector<HTMLButtonElement>('[aria-label="Roll Constellation Vortex: Damage"]')!
    expect(container.querySelector('[aria-label="Constellation Vortex weapons"]')).toBeNull()
    await act(async () => roll().click())
    const count = container.querySelector<HTMLSelectElement>('[aria-label="Constellation Vortex weapons"]')!
    expect(container.querySelector('[aria-label="Constellation Vortex: Damage results"]')?.textContent).toContain('5 slashing')
    await act(async () => { count.value = '3'; count.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(container.querySelector('[aria-label="Constellation Vortex: Damage results"]')?.textContent).toContain('17 slashing')
    expect(container.querySelector('[aria-label="Constellation Vortex: Damage results"]')?.textContent).toContain('12 slashing')
    await render({ ...c, solarianAttunement: 'Photon' })
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Hide Constellation Vortex results"]')!.click())
    await act(async () => roll().click())
    expect(container.querySelector('[aria-label="Constellation Vortex: Damage results"]')?.textContent).toContain('8 slashing + 6 fire')
    await render({ ...c, level: 5 })
    expect(container.querySelector('[aria-label="Constellation Vortex weapons"]')).toBeNull()
  } finally {
    await act(async () => root.unmount())
    container.remove()
    random.mockRestore()
    vi.unstubAllGlobals()
  }
})

it('shows ancestry feat progress beside the ancestry name', () => {
  const c: Character = {
    id: 'ancestry-progress', systems: ['pf2e'], name: 'Gnome', level: 5, ancestry: 'Gnome', heritage: 'Sensate Gnome',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const slots = plannedSlots(c, []).filter(slot => slot.category === 'ancestry')
  const render = (character: Character) => renderToStaticMarkup(
    <CharacterBuilder character={character} catalog={[]} onClose={() => {}} />,
  )
  expect(render(c)).toContain(`Sensate Gnome (0/${slots.length})`)
  const filled = { ...c, feats: slots.map(slot => ({ name: 'Selected feat', type: 'Ancestry Feat', level: slot.level, slot: slot.key })) }
  expect(render(filled)).toContain(`Sensate Gnome (${slots.length}/${slots.length})`)
})

it('opens Parry rules from Defense and Statuses summaries without toggling either section', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  } })
  const c: Character = { id: 'parry', systems: ['pf2e'], name: 'Test', level: 8, className: 'Ranger', parrying: true,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    weapons: [{ id: 'weapon', name: 'Parry Sword', potency: 0, striking: 0, runes: [] }] }
  const weapon: ContentEntry = { id: 'weapon', name: 'Parry Sword', kind: 'weapon', source: 'official', systems: ['pf2e'],
    level: 1, traits: ['Parry'], description: '', data: { weapon_category: 'Martial', hands: 1 }, effects: [], updatedAt: 0 }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<CharacterBuilder character={c} catalog={[weapon]} onClose={() => {}} />))
    for (const sectionName of ['Defense', 'Statuses']) {
      const section = [...container.querySelectorAll('details')].find(details =>
        details.querySelector(':scope > summary > strong')?.textContent === sectionName)!
      const summary = section.querySelector(':scope > summary')!
      const button = [...summary.querySelectorAll('button')].find(item => item.textContent === 'Parry')!
      expect(button).toBeTruthy()
      await act(async () => button.click())
      expect(section.open).toBe(false)
      const dialog = summary.querySelector('dialog[open]')!
      expect(dialog.textContent).toContain('While wielding a parry weapon')
      dialog.removeAttribute('open')
    }
    expect(container.querySelector<HTMLInputElement>('[aria-label="Parry active (summary)"]')?.checked).toBe(true)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    vi.unstubAllGlobals()
  }
})

it('labels Solar Shield and hides inactive Parry in the Defense summary', () => {
  const c: Character = { id: 'solar-defense', systems: ['sf2e'], name: 'Test', level: 2, className: 'Solarian',
    solarianAttunement: 'Photon', feats: [{ name: 'Solar Shield', type: 'Class Feat', level: 1 }],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
    weapons: [{ id: 'weapon', name: 'Parry Sword', potency: 0, striking: 0, runes: [] }] }
  const weapon: ContentEntry = { id: 'weapon', name: 'Parry Sword', kind: 'weapon', source: 'official', systems: ['sf2e'],
    level: 1, traits: ['Parry'], description: '', data: { weapon_category: 'Martial', hands: 1 }, effects: [], updatedAt: 0 }
  const render = (character: Character) => renderToStaticMarkup(<CharacterBuilder character={character} catalog={[weapon]} onClose={() => {}} />)
  expect(render(c)).toContain('aria-label="Raise Solar Shield (summary)"')
  expect(render(c)).not.toContain('aria-label="Parry active (summary)"')
  expect(render({ ...c, parrying: true })).toContain('aria-label="Parry active (summary)"')
  expect(render({ ...c, solarianAttunement: 'Unattuned' })).toContain('aria-label="Parry active (summary)"')
})

it('updates equipment groups when inventory or catalog changes', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const c: Character = {
    id: 'equipment-updates', systems: ['pf2e'], name: 'Test', level: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const item: ContentEntry = { id: 'item', name: 'Test Item', kind: 'item', systems: ['pf2e'], source: 'official',
    level: 1, traits: [], description: '', data: { item_category: 'Grafts' }, effects: [], updatedAt: 0 }
  const catalog = [item]
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const render = async (character: Character, entries: ContentEntry[]) => {
    await act(async () => root.render(<CharacterBuilder character={character} catalog={entries} onClose={() => {}} />))
  }
  try {
    await render(c, catalog)
    const equipment = [...container.querySelectorAll('details')].find(details =>
      details.querySelector('summary strong')?.textContent === 'Equipment')!
    await act(async () => { equipment.open = true; equipment.dispatchEvent(new Event('toggle')) })
    const group = (name: string) => [...equipment.querySelectorAll('.equipment-group')]
      .find(element => element.querySelector('h4')?.textContent === name)?.textContent ?? ''
    expect(group('Grafts')).not.toContain('Test Item')
    const equipped = { ...c, equipment: [{ name: 'Test Item', qty: 1 }] }
    await render(equipped, catalog)
    expect(group('Grafts')).toContain('Test Item')
    await render(equipped, [{ ...item, data: { item_category: 'Tattoos' } }])
    expect(group('Grafts')).not.toContain('Test Item')
    expect(group('Tattoos')).toContain('Test Item')
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})

it('updates class feat slots and progress when a blank slot is added and filled', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const c: Character = {
    id: 'class-slots', systems: ['pf2e'], name: 'Test', level: 2, className: 'Ranger',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const catalog: ContentEntry[] = []
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const render = async (character: Character) => act(async () => root.render(
    <CharacterBuilder character={character} catalog={catalog} onClose={() => {}} />,
  ))
  try {
    await render(c)
    const section = [...container.querySelectorAll('details')].find(details =>
      details.querySelector('summary strong')?.textContent === 'Class')!
    await act(async () => { section.open = true; section.dispatchEvent(new Event('toggle')) })
    const count = () => [...section.querySelectorAll('.character-subsection > summary h4')]
      .find(heading => heading.textContent?.startsWith('Class Features & Feats'))?.textContent
    const initial = plannedSlots(c, catalog).filter(slot => slot.category === 'class').length
    expect(count()).toBe(`Class Features & Feats 0/${initial}`)
    expect(section.querySelector('[aria-label="L02 Class feat"]')).toBeNull()
    const added: Character = { ...c, extraSlots: [{ category: 'class', level: 2, count: 1 }] }
    await render(added)
    expect(count()).toBe(`Class Features & Feats 0/${initial + 1}`)
    expect(section.querySelector('[aria-label="L02 Class feat"]')).toBeNull()
    const feats = [...section.querySelectorAll<HTMLDetailsElement>('.character-subsection')]
      .find(details => details.querySelector(':scope > summary h4')?.textContent?.startsWith('Class Features & Feats'))!
    await act(async () => { feats.open = true; feats.dispatchEvent(new Event('toggle')) })
    expect(section.querySelectorAll('[aria-label="L02 Class feat"]')).toHaveLength(2)
    await render({ ...added, feats: [{ name: 'Test feat', type: 'Class Feat', level: 2, slot: 'class:2:1' }] })
    expect(count()).toBe(`Class Features & Feats 1/${initial + 1}`)
    expect(section.textContent).toContain('Test feat')
    await render(c)
    expect(count()).toBe(`Class Features & Feats 0/${initial}`)
    await act(async () => { feats.open = false; feats.dispatchEvent(new Event('toggle')) })
    await render(added)
    expect(count()).toBe(`Class Features & Feats 0/${initial + 1}`)
    await act(async () => { feats.open = true; feats.dispatchEvent(new Event('toggle')) })
    expect(section.querySelectorAll('[aria-label="L02 Class feat"]')).toHaveLength(2)
  } finally {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  }
})
