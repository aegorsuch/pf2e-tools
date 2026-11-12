import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ArmorList, HandwrapsGear, WeaponList } from './GearSection'
import { AnimalFeatureOptions } from './SpellsSection'
import { activeAnimalFeatures, effectiveWeapon, movementSpeeds, ownedWeapons, senses } from './builder'
import type { Character, ContentEntry, OwnedWeapon } from './types'
import { ARMOR_GAUNTLETS, GAUNTLET, HAFT_STRIKER_WEAPON, HANDWRAPS, HARDLIGHT_HANDWRAPS } from './supplemental'

beforeEach(() => vi.stubGlobal('window', { confirm: vi.fn(() => true) }))
afterEach(() => vi.unstubAllGlobals())

const weapon: ContentEntry = {
  id: 'longsword', systems: ['pf2e'], kind: 'weapon', source: 'official', name: 'Longsword', level: 0,
  traits: [], description: '', data: { weapon_category: 'Martial', damage: '1d8 slashing' }, effects: [], updatedAt: 0,
}
const shifting: ContentEntry = {
  id: 'shifting', systems: ['pf2e'], kind: 'item', source: 'official', name: 'Shifting',
  level: 6, traits: [], description: '', data: { item_subcategory: 'Weapon Property Runes' }, effects: [], updatedAt: 0,
}
const character = (feats: Character['feats'], livingWeapon = false): Character => ({
  id: 'c', systems: ['pf2e'], name: 'Alex', level: 10, className: 'Fighter',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats, equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  weapons: [{ id: 'w', name: 'Longsword', potency: 3, striking: 1, runes: ['Wounding', 'Flaming'], livingWeapon }],
})

it('persists weapon and armor materials before fundamental controls, allowing a fourth Orichalcum rune', () => {
  let c: Character = { ...character([]), armors: [{ id: 'armor', name: 'Chain Mail', worn: true, potency: 3, resilient: 2, runes: [] }] }
  c.weapons![0].runes = ['Flaming', 'Frost', 'Shock']
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  expect(renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={save} />)).not.toContain('aria-label="Add property rune"')
  const material = findElement(WeaponList({ c, entries: [weapon], save }), (element) => element.props['aria-label'] === 'Weapon material')
  if (!material) throw new Error('Missing weapon material')
  ;(material.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Orichalcum' } })
  expect(c.weapons?.[0].material).toBe('Orichalcum')
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={save} />)
  expect(markup).toContain('aria-label="Add property rune"')
  expect(markup.indexOf('aria-label="Weapon material"')).toBeLessThan(markup.indexOf('<label>Potency'))
  const armorMaterial = findElement(ArmorList({ c, entries: [], save }), (element) => element.props['aria-label'] === 'Armor material')
  if (!armorMaterial) throw new Error('Missing armor material')
  ;(armorMaterial.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Orichalcum' } })
  expect(c.armors?.[0]).toMatchObject({ material: 'Orichalcum', potency: 3, resilient: 2 })
  const armorMarkup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={save} />)
  expect(armorMarkup.indexOf('aria-label="Armor material"')).toBeLessThan(armorMarkup.indexOf('<label>Potency'))
  expect(armorMarkup.indexOf('aria-label="Armor material"')).toBeLessThan(armorMarkup.indexOf('<label>Resilient'))
  expect(armorMarkup).not.toContain('One additional property rune slot')
  expect(armorMarkup).not.toContain('Add Custom Shield')
  expect(armorMarkup).not.toContain('<small>Armor Class <b>')
  ;(armorMaterial.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Duskwood' } })
  expect(c.armors?.[0]).toMatchObject({ material: 'Duskwood', potency: 3, resilient: 2 })
  expect(renderToStaticMarkup(<ArmorList c={c} entries={[]} save={save} />)).toContain('<option value="Duskwood" selected="">Duskwood</option>')
  c = { ...c, feats: [{ name: 'Living Weapon', type: 'Class Feat', level: 1 }] }
  c.weapons![0].livingWeapon = true
  const locked = findElement(WeaponList({ c, entries: [weapon], save }), (element) => element.props['aria-label'] === 'Weapon material')
  expect(locked?.props).toMatchObject({ value: 'Peachwood (Greater)', disabled: true })
  expect(c.weapons?.[0].material).toBe('Orichalcum')
  const livingMarkup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={save} />)
  expect(livingMarkup).not.toContain('Material locked by Living Weapon')
  expect(livingMarkup).not.toContain('High-grade peachwood:')
})

it('alphabetizes Animal Feature effects, greys out rank-four choices until level seven, and switches a single persisted effect', () => {
  let c: Character = { ...character([{ name: 'Advanced Warden', type: 'Class Feat', level: 4, choice: 'Animal Feature' }]), level: 6, activeSpells: ['Gravity Weapon'] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => AnimalFeatureOptions({ c, entries: [], save })
  const markup = renderToStaticMarkup(tree())
  const names = [...markup.matchAll(/aria-label="Animal Feature: ([^"]+)"/g)].map((match) => match[1])
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  for (const name of ['Fish Tail', 'Owl Eyes', 'Wings']) {
    expect(findElement(tree(), (element) => element.props['aria-label'] === `Animal Feature: ${name}`)?.props.disabled).toBe(true)
  }
  const toggle = (name: string, checked: boolean) => {
    const control = findElement(tree(), (element) => element.props['aria-label'] === `Animal Feature: ${name}`)
    if (!control) throw new Error(`Missing ${name}`)
    ;(control.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked } })
  }
  toggle('Claws', true)
  toggle('Jaws', true)
  expect(c.animalFeature).toBe('Jaws')
  expect(c.activeSpells).toEqual(['Gravity Weapon', 'Animal Feature'])
  expect(ownedWeapons(c, []).map((weapon) => weapon.name)).toContain('Jaws (Animal Feature)')
  expect(ownedWeapons(c, []).map((weapon) => weapon.name)).not.toContain('Claws (Animal Feature)')
  c = { ...c, level: 7 }
  expect(findElement(tree(), (element) => element.props['aria-label'] === 'Animal Feature: Wings')?.props.disabled).toBe(false)
  toggle('Wings', true)
  expect(c.animalFeature).toBe('Wings')
  toggle('Wings', false)
  expect(c.activeSpells).toEqual(['Gravity Weapon'])
})

it('persists independent Animal Features with the homebrew feat, including attacks, senses and movement', () => {
  const warden = { name: 'Advanced Warden', type: 'Class Feat', level: 4, choice: 'Animal Feature' }
  const persistent = { name: 'Persistent Animal Feature', type: 'Class Feat', level: 1 }
  let c: Character = { ...character([warden, persistent]), weapons: [], level: 7, activeSpells: ['Gravity Weapon'] }
  const save = (patch: Partial<Character>) => { c = JSON.parse(JSON.stringify({ ...c, ...patch })) }
  const tree = () => AnimalFeatureOptions({ c, entries: [], save })
  const toggle = (name: string, checked: boolean) => {
    const control = findElement(tree(), (element) => element.props['aria-label'] === `Animal Feature: ${name}`)
    if (!control) throw new Error(`Missing ${name}`)
    ;(control.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked } })
  }
  for (const name of ['Claws', 'Jaws', 'Cat Eyes', 'Owl Eyes', 'Fish Tail', 'Wings']) toggle(name, true)
  expect(activeAnimalFeatures(c, [])).toEqual(['Cat Eyes', 'Claws', 'Fish Tail', 'Jaws', 'Owl Eyes', 'Wings'])
  expect(ownedWeapons(c, []).map((weapon) => weapon.name)).toEqual(['Claws (Animal Feature)', 'Jaws (Animal Feature)'])
  expect(senses(c, []).map((sense) => sense.value)).toEqual(['Darkvision', 'Low-Light Vision'])
  expect(movementSpeeds(c, [])).toEqual([{ name: 'Land', feet: 25 }, { name: 'Fly', feet: 25, source: 'Animal Feature' }, { name: 'Swim', feet: 25, source: 'Animal Feature' }])
  expect(renderToStaticMarkup(tree())).toContain('Animal Feature: choose effects')
  expect(renderToStaticMarkup(tree()).match(/checked=""/g)).toHaveLength(6)
  expect(c.activeSpells).toEqual(['Gravity Weapon', 'Animal Feature'])

  const all = c
  c = { ...c, level: 6 }
  expect(activeAnimalFeatures(c, [])).toEqual(['Cat Eyes', 'Claws', 'Jaws'])
  toggle('Wings', true)
  expect(c.level).toBe(6)
  expect(c.animalFeatures).toEqual(all.animalFeatures)
  toggle('Claws', false)
  expect(c.animalFeatures).toContain('Wings')
  expect(activeAnimalFeatures(c, [])).toEqual(['Cat Eyes', 'Jaws'])
  c = { ...all, feats: [warden] }
  expect(activeAnimalFeatures(c, [])).toEqual(['Wings'])
  expect(renderToStaticMarkup(tree())).toContain('Animal Feature: choose one')
  expect(ownedWeapons(c, []).map((weapon) => weapon.name)).not.toContain('Claws (Animal Feature)')
  c = { ...c, feats: [warden, persistent] }
  expect(activeAnimalFeatures(c, [])).toHaveLength(6)
  for (const patch of [{ activeSpells: [] }, { feats: [persistent] }]) {
    const inactive = { ...c, ...patch }
    expect(activeAnimalFeatures(inactive, [])).toEqual([])
    expect(movementSpeeds(inactive, [])).toEqual([{ name: 'Land', feet: 25 }])
    expect(senses(inactive, [])).toEqual([])
    expect(ownedWeapons(inactive, []).map((weapon) => weapon.name)).toEqual(['Fist'])
  }
  toggle('Claws', false)
  expect(ownedWeapons(c, []).map((weapon) => weapon.name)).toEqual(['Jaws (Animal Feature)'])
  expect(c.activeSpells).toContain('Animal Feature')
  for (const name of ['Jaws', 'Cat Eyes', 'Owl Eyes', 'Fish Tail', 'Wings']) toggle(name, false)
  expect(c.activeSpells).toEqual(['Gravity Weapon'])
  expect(activeAnimalFeatures(c, [])).toEqual([])
})

it('preserves legacy single Animal Feature when gaining Persistent Animal Feature', () => {
  const c: Character = { ...character([
    { name: 'Advanced Warden', type: 'Class Feat', level: 4, choice: 'Animal Feature' },
    { name: 'Persistent Animal Feature', type: 'Class Feat', level: 1 },
  ]), animalFeature: 'Jaws', activeSpells: ['Animal Feature'] }
  expect(activeAnimalFeatures(c, [])).toEqual(['Jaws'])
  expect(renderToStaticMarkup(<AnimalFeatureOptions c={c} entries={[]} save={() => {}} />))
    .toContain('aria-label="Animal Feature: Jaws" checked=""')
})

it('syncs Living Weapon fundamentals and property edits across weapons and inherited Haft Striker after reload', () => {
  const spear: ContentEntry = { ...weapon, name: "Dancer's Spear", data: {
    weapon_category: 'Martial', hands: 2, weapon_group: 'Spear', weapon_type: 'Melee', damage: '1d6 piercing',
  } }
  const second: ContentEntry = { ...weapon, id: 'mace', name: 'Mace', data: { ...weapon.data, damage: '1d6 bludgeoning' } }
  const entries = [spear, second]
  let c: Character = { ...character([
    { name: 'Living Weapon', type: 'Class Feat', level: 1 },
    { name: 'Haft Striker Stance', type: 'Class Feat', level: 4 },
  ]), weapons: [
    { id: 'spear', name: spear.name, livingWeapon: true, potency: 2, striking: 1, runes: ['Flaming'] },
    { id: 'mace', name: second.name, livingWeapon: true, potency: 0, striking: 0, runes: [] },
    { id: 'ordinary', name: second.name, potency: 1, striking: 0, runes: ['Shock'] },
  ] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const card = (name: string) => {
    const result = findElement(WeaponList({ c, entries, save }), (element) => element.type === 'details' && element.props['aria-label'] === name)
    if (!result) throw new Error(`Missing ${name}`)
    return result
  }
  const propertyEditor = () => {
    const result = findElement(card(spear.name), (element) => Array.isArray(element.props.runes) && typeof element.props.onChange === 'function')
    if (!result) throw new Error('Missing shared rune editor')
    return result.props.onChange as (runes: string[]) => void
  }
  const assertShared = (potency: number, striking: number, runes: string[]) => {
    c = JSON.parse(JSON.stringify(c)) as Character
    for (const w of ownedWeapons(c, entries).filter((weapon) => weapon.livingWeapon || weapon.name === HAFT_STRIKER_WEAPON.name)) {
      expect(effectiveWeapon(c, entries, w)).toMatchObject({ potency, striking, runes: [...runes, 'Shifting'] })
    }
    expect(c.weapons?.find((weapon) => weapon.id === 'ordinary')).toMatchObject({ potency: 1, striking: 0, runes: ['Shock'] })
  }
  assertShared(2, 1, ['Flaming'])
  propertyEditor()(['Flaming', 'Frost'])
  assertShared(2, 1, ['Flaming', 'Frost'])
  propertyEditor()(['Frost'])
  assertShared(2, 1, ['Frost'])
  const potency = findElement(card(second.name), (element) => element.props.label === 'Potency')
  if (!potency) throw new Error('Missing potency')
  ;(potency.props.onChange as (value: number) => void)(3)
  assertShared(3, 1, ['Frost'])
  const striking = findElement(card(second.name), (element) => element.props.label === 'Striking')
  if (!striking) throw new Error('Missing striking')
  ;(striking.props.onChange as (value: number) => void)(3)
  assertShared(3, 3, ['Frost'])
  const tag = findElement(card(second.name), (element) => element.props['aria-label'] === 'Living Weapon: grant Shifting rune')
  if (!tag) throw new Error('Missing Living Weapon toggle')
  ;(tag.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: false } })
  expect(effectiveWeapon(c, entries, c.weapons![1])).toMatchObject({ potency: 0, striking: 0, runes: [] })
  assertShared(3, 3, ['Frost'])
})

it('lets users select the Haft Striker source and keeps all inherited enhancements read-only', () => {
  let c = character([{ name: 'Haft Striker Stance', type: 'Class Feat', level: 4 }])
  c.weapons = [{ ...c.weapons![0], id: 'first', name: 'Spear' }, { ...c.weapons![0], id: 'second', name: 'Hammer', runes: ['Frost'] }]
  const entries = [
    { ...weapon, name: 'Spear', data: { hands: 2, weapon_group: 'Spear', damage: '1d8 piercing' } },
    { ...weapon, name: 'Hammer', data: { hands: 2, weapon_group: 'Hammer', damage: '1d12 bludgeoning' } },
  ]
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const selector = findElement(WeaponList({ c, entries, save }), (element) => element.props['aria-label'] === 'Haft weapon')
  if (!selector) throw new Error('Missing haft source selector')
  ;(selector.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'second' } })
  expect(c.haftStrikerWeaponId).toBe('second')
  const card = findElement(WeaponList({ c, entries, save }), (element) => element.props['aria-label'] === 'Haft Striker Stance')
  if (!card) throw new Error('Missing haft card')
  const markup = renderToStaticMarkup(card)
  expect(markup).toContain('title="Inherited from Hammer"')
  expect(markup).not.toContain('aria-label="Remove Frost rune"')
  expect(markup).not.toContain('aria-label="Add property rune"')
  expect(markup).not.toContain('aria-label="Weapon material"')
})

it('shows rune levels and sorts existing weapon runes alphabetically', () => {
  const c = character([])
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon, shifting]} save={() => {}} />)

  expect(markup).toContain('<option value="Shifting">Shifting (Level 6)</option>')
  expect(markup.indexOf('Remove Flaming rune')).toBeLessThan(markup.indexOf('Remove Wounding rune'))
  expect(markup).not.toContain('>Stow</button>')
  expect(markup).not.toContain('>Draw</button>')
})

it('adds free Shifting only when Living Weapon is selected on the weapon', () => {
  const feat = { name: 'Living Weapon', type: 'General Feat', level: 1 }
  const enabled = renderToStaticMarkup(<WeaponList c={character([feat], true)} entries={[weapon, shifting]} save={() => {}} />)
  expect(enabled).toContain('aria-label="Living Weapon: grant Shifting rune" checked=""')
  expect(enabled.indexOf('aria-label="Weapon material"')).toBeLessThan(enabled.indexOf('aria-label="Living Weapon: grant Shifting rune"'))
  expect(enabled.indexOf('aria-label="Living Weapon: grant Shifting rune"')).toBeLessThan(enabled.indexOf('<label>Potency'))
  expect(enabled).toContain('title="Granted by Living Weapon"')
  expect(enabled).not.toContain('<option value="Shifting">')

  const disabled = renderToStaticMarkup(<WeaponList c={character([], true)} entries={[weapon, shifting]} save={() => {}} />)
  expect(disabled).not.toContain('Living Weapon: grant Shifting rune')
  expect(disabled).not.toContain('title="Granted by Living Weapon"')
})

it('omits the no-armor helper text', () => {
  const markup = renderToStaticMarkup(<ArmorList c={character([])} entries={[]} save={() => {}} />)
  expect(markup).not.toContain('No armor worn')
})

it('blocks Living Weapon on free-hand weapons even when previously enabled', () => {
  for (const trait of ['Free-Hand', 'free-hand', 'Free Hand']) {
    const c = character([{ name: 'Living Weapon', type: 'Class Feat', level: 1 }], true)
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={[{ ...weapon, traits: [trait] }, shifting]} save={() => {}} />)
    expect(markup).not.toContain('Living Weapon: grant Shifting rune')
    expect(markup).not.toContain('title="Granted by Living Weapon"')
    expect(markup).toContain('<option value="Shifting">')
  }
})

it('allows Living Weapon on ranged weapons while keeping the free-hand exclusion', () => {
  const c = character([{ name: 'Living Weapon', type: 'Class Feat', level: 1 }], true)
  c.weapons![0] = { ...c.weapons![0], name: 'Longbow', runes: [] }
  const bow: ContentEntry = {
    ...weapon, name: 'Longbow',
    data: { weapon_category: 'Martial', weapon_type: 'Ranged', range: 100, damage: '1d8 piercing' },
  }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[bow, shifting]} save={() => {}} />)
  expect(markup).toContain('aria-label="Living Weapon: grant Shifting rune" checked=""')
  expect(markup).toContain('title="Granted by Living Weapon"')
  const freeHand = renderToStaticMarkup(<WeaponList c={c} entries={[{ ...bow, traits: ['Free-Hand'] }, shifting]} save={() => {}} />)
  expect(freeHand).not.toContain('Living Weapon: grant Shifting rune')
  expect(freeHand).not.toContain('title="Granted by Living Weapon"')
})

it('keeps purchased and free Shifting runes out of weapon damage', () => {
  for (const free of [false, true]) {
    const c = character([{ name: 'Living Weapon', type: 'Class Feat', level: 1 }], free)
    c.weapons![0].runes = free ? ['Flaming'] : ['Shifting', 'Flaming']
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon, shifting]} save={() => {}} />)
    expect(markup).toContain('Damage 2d8 S + Flaming')
    expect(markup).toContain(free ? 'title="Granted by Living Weapon"' : 'aria-label="Remove Shifting rune"')
  }
})

it('shows Impactful force damage without scaling it with striking', () => {
  for (const rune of ['Impactful', 'Impactful (Greater)', 'Greater Impactful']) {
    for (const striking of [1, 3]) {
      const c = character([])
      c.weapons![0] = { ...c.weapons![0], striking, runes: [rune, 'Shifting'] }
      const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon, shifting]} save={() => {}} />)
      expect(markup).toContain(`Damage ${1 + striking}d8 S + 1d6 force`)
      expect(markup).toContain(`aria-label="Remove ${rune} rune"`)
    }
  }
})

it('provides graded rune descriptions and AoN links separately from removal', () => {
  const c = character([])
  c.weapons![0].runes = ['Impactful (Greater)']
  const impactful: ContentEntry = {
    ...shifting, id: 'impactful', name: 'Greater Impactful', level: 17,
    description: 'Greater Impactful description from synced content.',
    data: { ...shifting.data, url: 'https://2e.aonprd.com/Equipment.aspx?ID=1062' },
  }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon, impactful]} save={() => {}} />)
  expect(markup).toContain('aria-haspopup="dialog">Impactful (Greater)</button>')
  expect(markup).toContain('aria-label="Remove Impactful (Greater) rune"')
  expect(markup).toContain('<dialog')
  expect(markup).toContain(impactful.description)
  expect(markup).toContain('href="https://2e.aonprd.com/Equipment.aspx?ID=1062"')
  expect(markup).toContain('method="dialog"')
})

it.each([
  ['Astral', '1d6 spirit', undefined],
  ['Astral (Greater)', '1d6 spirit', 'Greater Astral: spirit damage ignores spirit resistance.'],
  ['Holy', '1d4 spirit', 'Holy: 2d4 spirit instead against unholy targets.'],
  ['Unholy', '1d4 spirit', 'Unholy: 2d4 spirit instead against holy targets.'],
] as const)('shows %s damage numerically with compact conditional markers', (rune, damage, note) => {
  const c = character([])
  c.weapons![0].runes = [rune]
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={() => {}} />)
  expect(markup).toContain(`Damage 2d8 S + ${damage}`)
  expect(markup).not.toContain('class="gear-damage"')
  if (note) {
    expect(markup).toContain(`title="${note}"`)
    expect(markup).toContain(`aria-label="${rune} note"`)
    expect(markup).toContain(`*</button> (${rune})`)
    expect(markup).toContain('popover="auto"')
  }
})

it('shows attack and compact damage including rune damage in the weapon summary', () => {
  const c = character([])
  c.level = 20
  c.abilities.str = 18
  c.weapons![0] = { ...c.weapons![0], name: "Dancer's Spear", striking: 3, runes: ['Shifting', 'Impactful (Greater)'] }
  const spear: ContentEntry = { ...weapon, name: "Dancer's Spear", data: { weapon_category: 'Martial', damage: '1d6 piercing' } }
  const fighter: ContentEntry = {
    ...weapon, id: 'fighter', kind: 'class', name: 'Fighter',
    data: { attack_proficiency: 'Legendary in martial weapons' },
  }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[spear, fighter]} save={() => {}} />)
  const summary = /<summary>(.*?)<\/summary>/.exec(markup)?.[1]
  expect(summary).toContain('Attack +35, Damage 4d6+4 P + 1d6 force')
  expect(summary).not.toContain('Shifting')
  expect(markup).not.toContain('class="gear-damage"')
})

it('adds Hooked Trip trait without adding damage or duplicating a natural Trip trait', () => {
  const c = character([])
  c.weapons![0].runes = ['Hooked']
  for (const traits of [[], ['Trip']]) {
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={[{ ...weapon, traits }]} save={() => {}} />)
    expect(markup).not.toContain('class="gear-damage"')
    expect(markup).toContain('Damage 2d8 S')
    expect(markup).not.toContain('slashing + Hooked')
    expect(markup.match(/<span>Trip<\/span>/g)).toHaveLength(1)
    expect(markup).toContain('aria-label="Remove Hooked rune"')
  }
})

it('keeps Grievous visible as a rune but excludes it from both damage displays', () => {
  const c = character([])
  c.weapons![0].runes = ['Grievous', 'Impactful (Greater)']
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={() => {}} />)
  expect(markup).toContain('Damage 2d8 S + 1d6 force')
  expect(markup).toContain('aria-label="Remove Grievous rune"')
})

it.each(['Crushing', 'Crushing (Greater)', 'Greater Crushing'])('shows %s critical conditions and Shockwave splash separately from normal damage', (rune) => {
  for (const striking of [1, 3]) {
    const c = character([])
    c.weapons![0] = { ...c.weapons![0], name: 'Maul', striking, runes: [rune, 'Shockwave', 'Impactful'] }
    const maul: ContentEntry = { ...weapon, name: 'Maul', data: { weapon_category: 'Martial', damage: '1d12 bludgeoning' } }
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={[maul]} save={() => {}} />)
    const dice = striking + 1
    const severity = rune === 'Crushing' ? 1 : 2
    expect(markup).toContain(`Damage ${dice}d12 B + 1d6 force, ${dice} B splash`)
    expect(markup).toContain(`Critical hit: clumsy ${severity} and enfeebled ${severity} until the end of your next turn.`)
    expect(markup).toContain('Shockwave splash does not harm you.')
    expect(markup).toContain(`aria-label="Remove ${rune} rune"`)
    expect(markup).toContain('aria-label="Remove Shockwave rune"')
    expect(/<summary>(.*?)<\/summary>/.exec(markup)?.[1]).not.toMatch(/Crushing|Shockwave/)
  }
})

it('locks the feat-granted Haft Striker weapon only with a qualifying carried weapon', () => {
  const c = character([{ name: 'Haft Striker Stance', type: 'Class Feat', level: 2 }])
  c.weapons![0].name = 'Maul'
  const maul = { ...weapon, name: 'Maul', data: { hands: 2, weapon_group: 'Hammer', damage: '1d12 bludgeoning' } }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[maul, HAFT_STRIKER_WEAPON]} save={() => {}} />)
  expect(markup).toContain('<strong>Haft Striker Stance</strong>')
  expect(markup).not.toContain('aria-label="Remove Haft Striker Stance"')
  const manual = { ...c, feats: [], weapons: [{ id: 'manual', name: HAFT_STRIKER_WEAPON.name, potency: 0, striking: 0, runes: [] }] }
  expect(renderToStaticMarkup(<WeaponList c={manual} entries={[HAFT_STRIKER_WEAPON]} save={() => {}} />))
    .not.toContain('<strong>Haft Striker Stance</strong>')
})

it('locks full plate gauntlets and keeps their saved configuration when other weapons change while armor is unworn', () => {
  let c: Character = {
    ...character([]),
    armors: [{ id: 'plate', name: 'Full Plate', potency: 0, resilient: 0, runes: [], worn: true }],
  }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={save} />)
  expect(markup).toContain('<strong>Gauntlet</strong>')
  expect(markup).not.toContain('aria-label="Remove Gauntlet"')
  const gauntlet = { id: GAUNTLET.id, name: 'Gauntlet', potency: 2, striking: 1, runes: ['Flaming'] }
  c = { ...c, weapons: [...c.weapons!, gauntlet], armors: c.armors!.map((armor) => ({ ...armor, worn: false })) }
  expect(renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={save} />)).not.toContain('<strong>Gauntlet</strong>')
  const remove = findElement(WeaponList({ c, entries: [weapon], save }), (element) => element.props['aria-label'] === 'Remove Longsword')
  if (!remove) throw new Error('Missing weapon removal')
  ;(remove.props.onClick as () => void)()
  expect(c.weapons).toContainEqual(gauntlet)
})

it.each(ARMOR_GAUNTLETS)('inherits plate material for armor-provided %s without changing purchased weapons or stored enhancements', (name) => {
  const saved: OwnedWeapon = { id: GAUNTLET.id, name, material: 'Peachwood (Greater)', potency: 3, striking: 1,
    runes: ['Flaming', 'Frost', 'Shock', 'Thundering'] }
  let c: Character = { ...character([]), weapons: [saved],
    armors: [{ id: 'plate', name: 'Full Plate', material: 'Orichalcum', gauntlet: name, worn: true, potency: 0, resilient: 0, runes: [] }] }
  const material = () => findElement(WeaponList({ c, entries: [], save: () => {} }), (element) => element.props['aria-label'] === 'Weapon material')
  expect(material()?.props).toMatchObject({ value: 'Orichalcum', disabled: true })
  expect(effectiveWeapon(c, [], saved)).toMatchObject({ material: 'Orichalcum', potency: 3, striking: 1, runes: saved.runes })
  expect(effectiveWeapon(c, [], { ...saved, id: 'purchased' }).material).toBe('Peachwood (Greater)')
  c = { ...c, armors: c.armors!.map((armor) => ({ ...armor, material: undefined })) }
  expect(material()?.props).toMatchObject({ value: '', disabled: true })
  expect(effectiveWeapon(c, [], saved)).toMatchObject({ material: undefined, runes: saved.runes.slice(0, 3) })
  c = { ...c, armors: c.armors!.map((armor) => ({ ...armor, material: 'Duskwood' })) }
  expect(material()?.props).toMatchObject({ value: 'Duskwood', disabled: true })
  expect(renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)).toContain('<option selected="">Duskwood</option>')
  expect(saved).toMatchObject({ material: 'Peachwood (Greater)', runes: ['Flaming', 'Frost', 'Shock', 'Thundering'] })
})

it.each(['Half Plate', 'Hellknight Plate'])('selects %s gauntlet variants without changing separately purchased gauntlets or other armor choices', (armorName) => {
  let c: Character = {
    ...character([]),
    armors: [
      { id: 'half', name: armorName, worn: true, potency: 0, resilient: 0, runes: [] },
      { id: 'splint', name: 'Splint Mail', worn: false, gauntlet: 'Spiked Gauntlet', potency: 0, resilient: 0, runes: [] },
    ],
    weapons: [{ id: GAUNTLET.id, name: 'Gauntlet', potency: 2, striking: 1, runes: ['Flaming'] }],
  }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  for (const name of ARMOR_GAUNTLETS) {
    const select = findElement(WeaponList({ c, entries: [], save }), (element) => element.props['aria-label'] === 'Armor gauntlet')
    if (!select) throw new Error('Missing armor gauntlet selector')
    ;(select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: name } })
    expect(c.armors?.find((armor) => armor.id === 'half')?.gauntlet).toBe(name)
    expect(c.armors?.find((armor) => armor.id === 'splint')?.gauntlet).toBe('Spiked Gauntlet')
    expect(c.weapons![0]).toMatchObject({ potency: 2, striking: 1, runes: ['Flaming'] })
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={save} />)
    expect(markup).toContain(`<strong>${name}</strong>`)
    expect(markup).not.toContain(`aria-label="Remove ${name}"`)
    expect(markup.indexOf('>Bladed Gauntlet</option>')).toBeLessThan(markup.indexOf('>Clawed Gauntlet</option>'))
    expect(markup.indexOf('>Gauntlet</option>')).toBeLessThan(markup.indexOf('>Spiked Gauntlet</option>'))
  }
  c = { ...c, weapons: [...c.weapons!, { id: 'purchased', name: 'Gauntlet', potency: 0, striking: 0, runes: [] }] }
  expect(renderToStaticMarkup(<WeaponList c={c} entries={[]} save={save} />)).toContain('aria-label="Remove Gauntlet"')
  c = { ...c, armors: c.armors!.map((armor) => ({ ...armor, worn: false })) }
  const unworn = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={save} />)
  expect(unworn).not.toContain('aria-label="Armor gauntlet"')
  expect(unworn).not.toContain('<strong>Clawed Gauntlet</strong>')
})

function findElement(node: ReactNode, matches: (element: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> | undefined {
  let found: ReactElement<Record<string, unknown>> | undefined
  Children.forEach(node, (child) => {
    if (found || !isValidElement<Record<string, unknown>>(child)) return
    found = matches(child) ? child : findElement(child.props.children as ReactNode, matches)
  })
  return found
}

it('configures shared handwraps without copying inherited runes into stored attacks', () => {
  let c = character([])
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => HandwrapsGear({ c, entries: [weapon], save })
  const weapons = () => WeaponList({ c, entries: [weapon], save })
  const add = findElement(tree(), (element) => element.type === 'button' && Children.toArray(element.props.children as ReactNode).join('') === `Add ${HANDWRAPS.name}`)
  if (!add) throw new Error('Missing Add Handwraps button')
  ;(add.props.onClick as () => void)()
  const card = findElement(tree(), (element) => element.type === 'details' && element.props['aria-label'] === HANDWRAPS.name)
  if (!card) throw new Error('Missing handwrap card')
  const potency = findElement(card, (element) => element.props.label === 'Potency')
  if (!potency) throw new Error('Missing shared potency control')
  ;(potency.props.onChange as (value: number) => void)(2)
  expect(c.handwraps).toEqual({ potency: 2, striking: 0, runes: [] })
  const sword = findElement(weapons(), (element) => element.type === 'details' && element.props['aria-label'] === 'Longsword')
  const striking = findElement(sword, (element) => element.props.label === 'Striking')
  if (!striking) throw new Error('Missing sword striking control')
  ;(striking.props.onChange as (value: number) => void)(2)
  expect(c.weapons?.find((attack) => attack.name === 'Fist')).toMatchObject({ potency: 0, striking: 0, runes: [] })
  expect(c.handwraps).toEqual({ potency: 2, striking: 0, runes: [] })
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={save} />)
  expect(markup).not.toContain(`inherited from ${HANDWRAPS.name}`)
  expect(markup).toContain('<strong>Fist</strong> <small>Attack +14, Damage 1d4 B')
  expect(markup).not.toContain(`aria-label="${HANDWRAPS.name}"`)
  expect(markup).not.toContain(`Add ${HANDWRAPS.name}`)
  expect(renderToStaticMarkup(<HandwrapsGear c={c} entries={[weapon]} save={save} />)).toContain(`aria-label="${HANDWRAPS.name}"`)
})

it('shows only compatible inherited runes on buff attacks and no removal controls on those attacks', () => {
  const c: Character = {
    ...character([{ name: 'Advanced Warden', type: 'Class Feat', level: 4, choice: 'Animal Feature' }]),
    weapons: [], activeSpells: ['Animal Feature'], handwraps: { potency: 2, striking: 1, runes: ['Wounding', 'Impactful (Greater)'] },
  }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('<strong>Claws</strong> <small>Attack +14, Damage 2d6 S + 1d6 force, Wounding')
  expect(markup).not.toContain('<strong>Jaws</strong>')
  expect(renderToStaticMarkup(<WeaponList c={{ ...c, animalFeature: 'Jaws' }} entries={[]} save={() => {}} />))
    .toContain('<strong>Jaws</strong> <small>Attack +14, Damage 2d8 P + 1d6 force, Wounding')
  expect(markup).not.toContain('Claws (Animal Feature)')
  expect(markup).not.toContain('Jaws (Animal Feature)')
  expect(markup).not.toContain('aria-label="Remove Claws"')
  expect(markup).not.toContain('aria-label="Remove Jaws"')
  expect(markup).not.toContain('aria-label="Remove Wounding rune"')
  expect(renderToStaticMarkup(<HandwrapsGear c={c} entries={[]} save={() => {}} />).match(/aria-label="Remove Wounding rune"/g)).toHaveLength(1)
  expect(markup).not.toContain('Granted by Living Weapon')
  expect(markup).toContain(`title="Inherited from ${HANDWRAPS.name}"`)
})

it('never offers direct unarmed rune, potency, or striking controls, including without handwraps', () => {
  const c: Character = {
    ...character([]),
    weapons: [{ id: 'legacy-fist', name: 'Fist', potency: 3, striking: 3, runes: ['Flaming'] }],
  }
  const tree = WeaponList({ c, entries: [], save: () => {} })
  const fist = findElement(tree, (element) => element.type === 'details' && element.props['aria-label'] === 'Fist')
  expect(fist).toBeDefined()
  expect(findElement(fist, (element) => element.props.label === 'Potency' || element.props.label === 'Striking')).toBeUndefined()
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)
  expect(markup).not.toContain('through handwraps in Gear')
  expect(markup).not.toContain('aria-label="Add property rune"')
  expect(markup).not.toContain('aria-label="Remove Flaming rune"')
  expect(markup).not.toContain('Flaming')
  expect(markup).toContain('Damage 1d4 B')
})

it('adds and configures hardlight handwraps in Gear with grade-based capacity and read-only inherited attack runes', () => {
  let c: Character = { ...character([]), systems: ['pf2e', 'sf2e'], weapons: [] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => HandwrapsGear({ c, entries: [], save })
  const add = findElement(tree(), (element) => element.type === 'button'
    && Children.toArray(element.props.children as ReactNode).join('') === `Add ${HARDLIGHT_HANDWRAPS.name}`)
  if (!add) throw new Error('Missing Add Hardlight Handwraps button')
  ;(add.props.onClick as () => void)()
  const selectGrade = (value: string) => {
    const grade = findElement(tree(), (element) => element.props['aria-label'] === 'Hardlight handwraps grade')
    if (!grade) throw new Error('Missing Hardlight grade selector')
    ;(grade.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } })
  }
  selectGrade('Advanced')
  expect(c.handwraps).toMatchObject({ kind: 'hardlight', grade: 'Advanced', potency: 1, striking: 1 })
  c = { ...c, handwraps: { ...c.handwraps!, runes: ['Flaming', 'Impactful'] } }
  const attack = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={save} />)
  expect(attack).not.toContain('inherited from Hardlight Handwraps')
  expect(attack).toContain('Damage 2d4 B')
  expect(attack).not.toContain('aria-label="Remove Flaming rune"')
  expect(attack).not.toContain('aria-label="Add property rune"')
  expect(renderToStaticMarkup(<HandwrapsGear c={c} entries={[]} save={save} />)).toContain('aria-label="Remove Flaming rune"')
  selectGrade('Commercial')
  expect(c.handwraps?.runes).toEqual(['Flaming'])
  const remove = findElement(tree(), (element) => element.props['aria-label'] === 'Remove Hardlight Handwraps')
  if (!remove) throw new Error('Missing Hardlight removal')
  ;(remove.props.onClick as () => void)()
  expect(c.handwraps).toBeUndefined()
})
