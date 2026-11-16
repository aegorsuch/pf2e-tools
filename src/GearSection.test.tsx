import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ArmorList, Augmentations, BulkLimits, HandwrapsGear, ShieldAttachment, ShieldEquipment, WeaponList } from './GearSection'
import { AnimalFeatureOptions } from './SpellsSection'
import { activeAnimalFeatures, animalStrengthRuneSources, armorClass, armorDisplayName, effectiveWeapon, equippedWeaponHands, hardpointWeaponEligible, movementSpeeds, ownedWeapons, senses, totalHandCapacity, weaponAttack, weaponEquipped } from './builder'
import { INVENTOR_ARMOR_ID } from './grantedArmor'
import type { Character, ContentEntry, OwnedArmor, OwnedWeapon } from './types'
import { ARMOR_GAUNTLETS, GAUNTLET, HAFT_STRIKER_WEAPON, HANDWRAPS, HARDLIGHT_HANDWRAPS, OVERSIZED_THROW } from './supplemental'
import { getSettings, updateSettings } from './settings'
import { canEquipShield, equippedHands, equippedShield, hardwoodShield, shieldEquipChange } from './builder'

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

it.each([false, true])('shows the Oversized Throw two-action icon in both views (displayOnly=%s)', displayOnly => {
  const c = { ...character([{ name: 'Oversized Throw', type: 'Class Feat', level: 4 }]), className: 'Barbarian', raging: true }
  const tree = WeaponList({ c, entries: [], save: () => {}, displayOnly })
  const markup = renderToStaticMarkup(tree)
  expect(markup).toContain('<strong>Oversized Throw</strong> <span class="action-cost" aria-label="Two Actions"')
  expect(weaponAttack(c, [], { id: OVERSIZED_THROW.id, name: OVERSIZED_THROW.name, potency: 0, striking: 0, runes: [] }).damage)
    .toBe('2d10 bludgeoning')
})

it('displays the versatile damage type from cached weapon metadata', () => {
  const clan = { ...weapon, name: 'Clan Dagger', traits: ['Agile', 'Versatile'],
    data: { hands: 1, damage: '1d4 P', damage_type: 'Bludgeoning, Piercing' } }
  const sword = { ...weapon, traits: ['Versatile'], data: { hands: 1, damage: '1d8 S', damage_type: 'Piercing, Slashing' } }
  const c: Character = { ...character([]), weapons: [
    { id: 'clan', name: clan.name, potency: 0, striking: 0, runes: [] },
    { id: 'sword', name: sword.name, potency: 0, striking: 0, runes: [] },
  ] }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[clan, sword]} save={() => {}} />)
  expect(markup).toContain('>Versatile B</button>')
  expect(markup).toContain('>Versatile P</button>')
  expect(markup).not.toContain('>Versatile</button>')
})

it.each([false, true])('syncs weapon equip controls and hand limits across both views (displayOnly=%s)', displayOnly => {
  const sword = { ...weapon, data: { ...weapon.data, hands: 1 } }
  const dagger = { ...weapon, id: 'dagger', name: 'Dagger', data: { hands: 1 } }
  const arbalest = { ...weapon, id: 'arbalest', name: 'Arbalest', data: { hands: 2, weapon_group: 'Crossbow', weapon_type: 'Ranged' } }
  let c: Character = { ...character([]), weapons: [
    { id: 'sword', name: sword.name, potency: 0, striking: 0, runes: [] },
    { id: 'dagger', name: dagger.name, potency: 0, striking: 0, runes: [] },
    { id: 'bow', name: arbalest.name, potency: 0, striking: 0, runes: [], stowed: true },
  ] }
  const entries = [sword, dagger, arbalest]
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const input = (name: string, view = displayOnly) => findElement(WeaponList({ c, entries, save, displayOnly: view }), e => e.props['aria-label'] === `Equipped ${name}`)!
  const toggle = (name: string, checked: boolean) => (input(name).props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked } })
  expect(equippedWeaponHands(c, entries)).toBe(2)
  expect(input('Arbalest').props.disabled).toBe(true)
  expect(input('Fist').props).toMatchObject({ checked: true, disabled: true })
  expect(input('Longsword', !displayOnly).props.checked).toBe(true)
  toggle('Longsword', false)
  expect(input('Longsword', !displayOnly).props.checked).toBe(false)
  expect(input('Arbalest').props.disabled).toBe(true)
  toggle('Dagger', false)
  expect(input('Arbalest').props.disabled).toBe(false)
  toggle('Arbalest', true)
  c = JSON.parse(JSON.stringify(c))
  expect(equippedWeaponHands(c, entries)).toBe(2)
  expect(input('Longsword').props.disabled).toBe(true)
  expect(input('Arbalest').props.checked).toBe(true)
  expect(input('Arbalest', !displayOnly).props).toMatchObject({ checked: true, disabled: false })
  const free = { ...weapon, name: 'Free Hand', traits: ['Free-Hand'], data: { hands: 1 } }
  c.weapons!.push({ id: 'free', name: free.name, potency: 0, striking: 0, runes: [], stowed: true })
  expect(weaponEquipped(c, [...entries, free], c.weapons![3])).toBe(true)
  expect(equippedWeaponHands(c, [...entries, free])).toBe(2)
})

it('uses a shared pool for weapons saved in different hand pairs', () => {
  const sword = { ...weapon, data: { hands: 2 } }
  let c: Character = { ...character([]), systems: ['sf2e'], ancestry: 'Ysoki', heritage: 'Test-Subject Ysoki',
    testSubjectAdaptation: 'Extra Limbs', weapons: [
      { id: 'one', name: sword.name, potency: 0, striking: 0, runes: [], handPair: 1 },
      { id: 'two', name: sword.name, potency: 0, striking: 0, runes: [], handPair: 2 },
    ] }
  expect(equippedWeaponHands(c, [sword])).toBe(4)
  expect(weaponEquipped(c, [sword], c.weapons![0])).toBe(true)
  expect(weaponEquipped(c, [sword], c.weapons![1])).toBe(true)
  const tree = () => WeaponList({ c, entries: [sword], save: patch => { c = { ...c, ...patch } }, displayOnly: true })
  expect(renderToStaticMarkup(tree())).toContain('Hands used: 4/4')
  expect(renderToStaticMarkup(tree())).not.toContain('aria-label="Active hands"')
  expect(renderToStaticMarkup(tree())).not.toContain('Hand pair:')
  expect(c.weapons![0].handPair).toBe(1)
})

it('lists non-removable granted augmentations without using implant slots', () => {
  const c: Character = { ...character([]), systems: ['sf2e'], ancestry: 'Ysoki', heritage: 'Test-Subject Ysoki',
    testSubjectAdaptation: 'Cybernetic Augmentation',
    feats: [{ name: 'Rat Retinal HUD', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }] }
  const markup = renderToStaticMarkup(<Augmentations c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('Datajack')
  expect(markup).toContain('Autorecognition Lens')
  expect(markup).toContain('Implant limit: 0/')
  expect(markup).not.toContain('Remove</button>')
  const removed = renderToStaticMarkup(<Augmentations c={{ ...c, testSubjectAdaptation: undefined, feats: [] }} entries={[]} save={() => {}} />)
  expect(removed).not.toContain('Datajack')
  expect(removed).not.toContain('Autorecognition Lens')
})

it('alphabetizes granted and installed augmentations together without changing saved order', () => {
  const c: Character = { ...character([{ name: 'Rat Retinal HUD', type: 'Ancestry Feat', level: 1 }]),
    systems: ['sf2e'], ancestry: 'Ysoki', heritage: 'Test-Subject Ysoki', testSubjectAdaptation: 'Cybernetic Augmentation',
    augmentations: [
      { id: 'z', entryId: 'z', name: 'Zeta Implant', slot: 'standard' },
      { id: 'b', entryId: 'b', name: 'Beta Implant', slot: 'standard' },
    ] }
  const choices: ContentEntry[] = ['Zeta Implant', 'Beta Implant'].map(name => ({
    ...weapon, id: name, name, kind: 'item', systems: ['sf2e'], data: { item_category: 'Augmentations' },
  }))
  const markup = renderToStaticMarkup(<Augmentations c={c} entries={choices} save={() => {}} />)
  const list = markup.slice(markup.indexOf('<ul>'), markup.indexOf('</ul>'))
  const names = ['Autorecognition Lens', 'Beta Implant', 'Datajack', 'Zeta Implant']
  expect(names.map(name => list.indexOf(name))).toEqual([...names.map(name => list.indexOf(name))].sort((a, b) => a - b))
  expect(names.every(name => list.includes(name))).toBe(true)
  expect(markup.indexOf('Beta Implant (level')).toBeLessThan(markup.indexOf('Zeta Implant (level'))
  expect(c.augmentations?.map(item => item.name)).toEqual(['Zeta Implant', 'Beta Implant'])
})

it('adds the slot-free Test-Subject Datajack to Cyborg only while its house rule is enabled', () => {
  const previous = getSettings().cyborgTestSubject
  const c: Character = { ...character([]), systems: ['sf2e'], ancestry: 'Ysoki', heritage: 'Cyborg' }
  try {
    updateSettings({ cyborgTestSubject: true })
    const markup = renderToStaticMarkup(<Augmentations c={c} entries={[]} save={() => {}} />)
    expect(markup).toContain('Datajack')
    expect(markup).toContain('Implant limit: 0/')
    expect(markup).not.toContain('Remove</button>')
    updateSettings({ cyborgTestSubject: false })
    expect(renderToStaticMarkup(<Augmentations c={c} entries={[]} save={() => {}} />)).not.toContain('Datajack')
  } finally { updateSettings({ cyborgTestSubject: previous }) }
})

it('caps saved Additional Arms selections without removing them and restores repetition when disabled', () => {
  const previous = getSettings().singleAdditionalArms
  const feats: Character['feats'] = [
    { name: 'Additional Arms', type: 'Ancestry Feat', level: 9, slot: 'ancestry:9:0' },
    { name: 'Additional Arms', type: 'Ancestry Feat', level: 9, slot: 'ancestry:13:0' },
  ]
  const c = { ...character([]), level: 17, feats }
  try {
    updateSettings({ singleAdditionalArms: true })
    expect(totalHandCapacity(c)).toBe(4)
    expect(totalHandCapacity({ ...c, level: 8 })).toBe(2)
    updateSettings({ singleAdditionalArms: false })
    expect(totalHandCapacity(c)).toBe(6)
    const sword = { ...weapon, name: 'Cyborg Sword', data: { ...weapon.data, hands: 1 } }
    const equipped = { ...c, weapons: [
      { id: 'one', name: sword.name, potency: 0, striking: 0, runes: [], handPair: 1 },
      { id: 'three', name: sword.name, potency: 0, striking: 0, runes: [], handPair: 3 },
    ], activeHandPair: 3 }
    expect(weaponEquipped(equipped, [sword], equipped.weapons[1])).toBe(true)
    expect(renderToStaticMarkup(<WeaponList c={equipped} entries={[sword]} save={() => {}} displayOnly />))
      .toContain('Hands used: 2/6')
  } finally { updateSettings({ singleAdditionalArms: previous }) }
})

it.each([false, true])('uses one shared shield equip state and counts its hand once (displayOnly=%s)', displayOnly => {
  const sword = { ...weapon, data: { ...weapon.data, hands: 1 } }
  let c: Character = { ...character([]), weapons: [{ id: 'sword', name: sword.name, potency: 0, striking: 0, runes: [] }],
    shield: { id: 'steel', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: true, equipped: false,
      attachedWeapon: { id: 'boss', name: 'Shield Boss', potency: 0, striking: 0, runes: [], attachedTo: 'steel' } } }
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const control = () => findElement(WeaponList({ c, entries: [sword], save, displayOnly }),
    element => element.props['aria-label'] === 'Equipped Shield Boss (Attached to Steel Shield)')!
  const toggle = (checked: boolean) => (control().props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked } })
  expect(control().props.disabled).toBe(false)
  expect(control().props.checked).toBe(false)
  toggle(true)
  expect(equippedShield(c)?.id).toBe('steel')
  expect(equippedHands(c, [sword])).toBe(2)
  for (const Component of [ShieldEquipment, ArmorList]) {
    expect(renderToStaticMarkup(<Component c={c} entries={[sword]} save={save} />))
      .toContain('aria-label="Equipped Steel Shield" checked=""')
  }
  toggle(false)
  expect(equippedShield(c)).toBeUndefined()
  expect(c.shield?.raised).toBe(false)
  expect(equippedHands(c, [sword])).toBe(1)
  c = { ...c, shield: { ...c.shield!, attachedWeapon: undefined } }
  const bash = findElement(WeaponList({ c, entries: [sword], save, displayOnly: true }),
    element => element.props['aria-label'] === 'Equipped Shield Bash (Attached to Steel Shield)')!
  ;(bash.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: true } })
  expect(equippedShield(c)?.id).toBe('steel')
})

it('reserves a free hand for shields, but not bucklers, and switches generated shields without raising the old shield', () => {
  const sword = { ...weapon, data: { ...weapon.data, hands: 2 } }
  const shield = { id: 'steel', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: true, equipped: false }
  let c: Character = { ...character([]), className: 'Kineticist', weapons: [{ id: 'sword', name: sword.name, potency: 0, striking: 0, runes: [] }],
    shield, feats: [{ name: 'Hardwood Armor', type: 'Class Feat', level: 1 }] }
  expect(canEquipShield(c, [sword], shield)).toBe(false)
  expect(canEquipShield(c, [sword], { ...shield, name: 'Buckler' })).toBe(true)
  c = { ...c, shield: { ...shield, name: 'Buckler', equipped: true } }
  expect(equippedHands(c, [sword])).toBe(2)
  c = { ...c, weapons: [], shield: { ...shield, equipped: true } }
  const generated = hardwoodShield(c)
  if (!generated) throw new Error('Expected Hardwood Armor shield')
  c = { ...c, ...shieldEquipChange(c, generated, true) }
  expect(equippedShield(c)?.id).toBe(generated.id)
  expect(c.shield).toMatchObject({ equipped: false, raised: false })
  c = { ...c, ...shieldEquipChange(c, shield, false) }
  expect(equippedShield(c)?.id).toBe(generated.id)
  c = { ...c, ...shieldEquipChange(c, generated, false) }
  expect(equippedShield(c)).toBeUndefined()
  c = { ...c, ...shieldEquipChange(c, shield, true) }
  expect(equippedShield(c)?.id).toBe(shield.id)
  expect(c.hardwoodShield?.equipped).toBe(false)
  c = { ...c, shield: { ...shield, equipped: undefined }, hardwoodShield: { equipped: true, raised: true } }
  c = { ...c, ...shieldEquipChange(c, generated, false) }
  expect(equippedShield(c)).toBeUndefined()
})

it('keeps weapon pair assignments usable with shared hands', () => {
  const sword = { ...weapon, name: 'Cyborg Sword', data: { ...weapon.data, hands: 1 } }
  const c: Character = { ...character([]), systems: ['sf2e'], level: 17, heritage: 'Cyborg',
    feats: [{ name: 'Additional Arms', type: 'Ancestry Feat', level: 9, slot: 'ancestry:9:0' },
      { name: 'Additional Arms', type: 'Ancestry Feat', level: 9, slot: 'ancestry:13:0' }],
    weapons: [{ id: 'one', name: sword.name, potency: 0, striking: 0, runes: [], handPair: 1 },
      { id: 'three', name: sword.name, potency: 0, striking: 0, runes: [], handPair: 3 }],
    activeHandPair: 3 }
  expect(weaponEquipped(c, [sword], c.weapons![0])).toBe(true)
  expect(weaponEquipped(c, [sword], c.weapons![1])).toBe(true)
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[sword]} save={() => {}} displayOnly />)
  expect(markup).toContain('Hands used: 2/4')
  expect(markup).not.toContain('Pair 3')
  expect(weaponEquipped({ ...c, activeHandPair: 1 }, [sword], c.weapons![0])).toBe(true)
})

it('keeps legacy pair assignments usable after arms are removed', () => {
  const sword = { ...weapon, data: { hands: 1 } }
  let c: Character = { ...character([]), systems: ['sf2e'], activeHandPair: 3, weapons: [
    { id: 'one', name: sword.name, potency: 0, striking: 0, runes: [], handPair: 1 },
    { id: 'lost', name: sword.name, potency: 0, striking: 0, runes: [], handPair: 3 },
  ] }
  expect(weaponEquipped(c, [sword], c.weapons![0])).toBe(true)
  expect(weaponEquipped(c, [sword], c.weapons![1])).toBe(true)
  const tree = () => WeaponList({ c, entries: [sword], save: patch => { c = { ...c, ...patch } }, displayOnly: true })
  expect(renderToStaticMarkup(tree())).toContain('Hands used: 2/2')
  expect(renderToStaticMarkup(tree())).not.toContain('Pair 3 (unavailable)')
  expect(equippedWeaponHands(c, [sword])).toBe(2)
})

it('combines a tail with regular hands in the shared pool', () => {
  const sword = { ...weapon, name: 'Tail sword', data: { hands: 1 } }
  const rifle = { ...weapon, name: 'Rifle', data: { hands: 2 } }
  let c: Character = { ...character([{ name: 'Prehensile Tail', type: 'Ancestry Feat', level: 5 }]),
    systems: ['sf2e'], activeHandPair: -1, weapons: [
      { id: 'sword', name: sword.name, potency: 0, striking: 0, runes: [], handPair: -1 },
      { id: 'rifle', name: rifle.name, potency: 0, striking: 0, runes: [], handPair: -1, stowed: true },
    ] }
  const tree = () => WeaponList({ c, entries: [sword, rifle], save: patch => { c = { ...c, ...patch } }, displayOnly: true })
  expect(weaponEquipped(c, [sword, rifle], c.weapons![0])).toBe(true)
  expect(findElement(tree(), e => e.props['aria-label'] === 'Equipped Rifle')!.props.disabled).toBe(false)
  const extraArms = { ...c, feats: [...c.feats, { name: 'Additional Arms', type: 'Ancestry Feat', level: 9 }], level: 10 }
  expect(weaponEquipped(extraArms, [sword, rifle], extraArms.weapons![0])).toBe(true)
  ;(findElement(tree(), e => e.props['aria-label'] === 'Equipped Rifle')!.props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: true } })
  expect(equippedWeaponHands(c, [sword, rifle])).toBe(3)
  expect(renderToStaticMarkup(tree())).toContain('Hands used: 3/3')
})

it.each([false, true])('syncs grip changes between views and preserves over-capacity saved weapons (displayOnly=%s)', displayOnly => {
  const sword = { ...weapon, name: 'Sword', data: { hands: 1 } }
  const spear = { ...weapon, name: 'Spear', data: { hands: '1 or 2' } }
  const dagger = { ...weapon, name: 'Dagger', data: { hands: 1 } }
  let c: Character = { ...character([{ name: 'Prehensile Tail', type: 'Ancestry Feat', level: 5 }]), weapons: [
    { id: 'sword', name: sword.name, potency: 0, striking: 0, runes: [], handPair: 1 },
    { id: 'spear', name: spear.name, potency: 0, striking: 0, runes: [], handPair: -1 },
    { id: 'dagger', name: dagger.name, potency: 0, striking: 0, runes: [], handPair: 3 },
  ] }
  const entries = [sword, spear, dagger]
  const tree = (view = displayOnly) => WeaponList({ c, entries, save: patch => { c = { ...c, ...patch } }, displayOnly: view })
  const grip = () => findElement(tree(), e => e.props['aria-label'] === 'Hands: Spear')!
  expect(findElement(grip(), e => e.type === 'option' && e.props.value === 2)!.props.disabled).toBe(true)
  ;(findElement(tree(), e => e.props['aria-label'] === 'Equipped Dagger')!.props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: false } })
  expect(findElement(grip(), e => e.type === 'option' && e.props.value === 2)!.props.disabled).toBe(false)
  ;(grip().props.onChange as (e: { target: { value: string } }) => void)({ target: { value: '2' } })
  expect(findElement(tree(!displayOnly), e => e.props['aria-label'] === 'Hands: Spear')!.props.value).toBe(2)
  expect(equippedWeaponHands(c, entries)).toBe(3)
  c = { ...c, feats: [] }
  expect(renderToStaticMarkup(tree(true))).toContain('Unequip weapons to use at most 2 hands in total.')
  expect(weaponEquipped(c, entries, c.weapons![1])).toBe(true)
  expect(c.weapons![1].handPair).toBe(-1)
})

it('counts one tail hand even if both Ysoki versions were previously selected', () => {
  const tail = { name: 'Prehensile Tail', type: 'Ancestry Feat', level: 5 }
  const limb = { name: 'Prehensile Limbs', type: 'Ancestry Feat', level: 5 }
  const c: Character = { ...character([tail, limb]), systems: ['sf2e'], ancestry: 'Ysoki' }
  expect(totalHandCapacity(c)).toBe(3)
  expect(totalHandCapacity({ ...c, feats: [] })).toBe(2)
  expect(totalHandCapacity({ ...c, feats: [limb] })).toBe(3)
})

it('allows an Ord tail to pair with a hand without adding a fourth hand', () => {
  const sword = { ...weapon, name: 'Ord sword', data: { hands: 1 } }
  const rifle = { ...weapon, name: 'Ord rifle', data: { hands: 2 } }
  const c: Character = { ...character([{ name: 'Prehensile Tail', type: 'Ancestry Feat', level: 5 }]),
    systems: ['sf2e'], ancestry: 'Ord', activeHandPair: -1, weapons: [
      { id: 'one', name: sword.name, potency: 0, striking: 0, runes: [], handPair: 1 },
      { id: 'two', name: rifle.name, potency: 0, striking: 0, runes: [], handPair: -1 },
      { id: 'three', name: sword.name, potency: 0, striking: 0, runes: [], handPair: 1, stowed: true },
    ] }
  expect(totalHandCapacity(c)).toBe(3)
  expect(weaponEquipped(c, [sword, rifle], c.weapons![1])).toBe(true)
  const tree = WeaponList({ c, entries: [sword, rifle], save: () => {}, displayOnly: true })
  const held = (node: ReactNode): ReactElement[] => {
    if (!isValidElement(node)) return []
    const element = node as ReactElement<{ children?: ReactNode; 'aria-label'?: string }>
    return [...(element.props['aria-label'] === 'Equipped Ord sword' ? [element] : []),
      ...Children.toArray(element.props.children).flatMap(held)]
  }
  expect(held(tree).at(-1)?.props).toMatchObject({ checked: false, disabled: true })
})

it('pairs a prehensile limb with an existing hand without creating a fourth hand', () => {
  const sword = { ...weapon, name: 'Limb sword', data: { hands: 1 } }
  let c: Character = { ...character([{ name: 'Prehensile Limbs', type: 'Ancestry Feat', level: 5 }]),
    systems: ['sf2e'], activeHandPair: -2, weapons: [
      { id: 'one', name: sword.name, potency: 0, striking: 0, runes: [], handPair: 1 },
      { id: 'two', name: sword.name, potency: 0, striking: 0, runes: [], handPair: -2 },
      { id: 'three', name: sword.name, potency: 0, striking: 0, runes: [], handPair: -2 },
      { id: 'four', name: sword.name, potency: 0, striking: 0, runes: [], handPair: 1, stowed: true },
    ] }
  const tree = () => WeaponList({ c, entries: [sword], save: patch => { c = { ...c, ...patch } }, displayOnly: true })
  expect(equippedWeaponHands(c, [sword])).toBe(3)
  const inputs = (node: ReactNode): ReactElement[] => {
    if (!isValidElement(node)) return []
    const element = node as ReactElement<{ children?: ReactNode; 'aria-label'?: string }>
    return [...(element.props['aria-label'] === 'Equipped Limb sword' ? [element] : []),
      ...Children.toArray(element.props.children).flatMap(inputs)]
  }
  expect(inputs(tree()).at(-1)?.props).toMatchObject({ checked: false, disabled: true })
  c = { ...c, weapons: c.weapons!.map(w => w.id === 'one' ? { ...w, stowed: true } : w) }
  expect(inputs(tree()).at(-1)?.props).toMatchObject({ checked: false, disabled: false })
})

it('restricts Hardpoint to eligible owned weapons and marks the drawn weapon as integrated', () => {
  const light = { ...weapon, name: 'Light gun', data: { hands: 1, bulk: 0.1 } }
  const heavy = { ...weapon, name: 'Heavy gun', data: { hands: 1, bulk: 1 } }
  const twoHanded = { ...weapon, name: 'Rifle', data: { hands: 2, bulk: 0.1 } }
  const missing = { ...weapon, name: 'Unknown bulk', data: { hands: 1 } }
  const weapons = [light, heavy, twoHanded, missing].map((entry, index) => ({
    id: `${index}`, name: entry.name, potency: 0, striking: 0, runes: [], stowed: index > 0,
  }))
  const c: Character = { ...character([{ name: 'Hardpoint', type: 'Ancestry Feat', level: 5 }]),
    systems: ['sf2e'], weapons, hardpointWeaponId: '0' }
  const entries = [light, heavy, twoHanded, missing]
  expect(weapons.map(w => hardpointWeaponEligible(c, entries, w))).toEqual([true, false, false, false])
  const thresher = { ...c, feats: [...c.feats, { name: 'Thresher Ko-1 Frame', type: 'Ancestry Feat', level: 1 }] }
  expect(hardpointWeaponEligible(thresher, entries, weapons[1])).toBe(true)
  expect(hardpointWeaponEligible({ ...c, feats: [] }, entries, weapons[0])).toBe(false)
  expect(renderToStaticMarkup(<Augmentations c={c} entries={entries} save={() => {}} />)).toContain('Hardpoint weapon')
  expect(renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} displayOnly />)).toContain('Integrated weapon: cannot be disarmed')
  expect(renderToStaticMarkup(<WeaponList c={{ ...c, weapons: weapons.map(w => ({ ...w, stowed: true })) }} entries={entries} save={() => {}} displayOnly />)).not.toContain('Integrated weapon: cannot be disarmed')
})

it('tracks at most two Secondary Power Source selections and their daily uses', () => {
  const c: Character = { ...character([{ name: 'Secondary Power Source', type: 'Ancestry Feat', level: 13 }]),
    systems: ['sf2e'], level: 17,
    augmentations: ['First', 'Second', 'Third'].map(name => ({ id: name, name, entryId: name, slot: 'standard' })),
    secondaryPowerSourceIds: ['First', 'Second', 'stale'], secondaryPowerUses: { First: 1 } }
  const markup = renderToStaticMarkup(<Augmentations c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('aria-label="First uses"')
  expect(markup).toContain('<option value="1" selected="">1/2</option>')
  expect(markup).toMatch(/aria-label="Secondary Power Source: Third" disabled=""/)
  expect(markup).toContain('Verify the item&#x27;s frequency before selecting it.')
  expect(renderToStaticMarkup(<Augmentations c={{ ...c, level: 12 }} entries={[]} save={() => {}} />))
    .not.toContain('Secondary Power Source: First')
})

it('upgrades Thresher plating and applies its raised shield bonus only while usable', () => {
  const c: Character = { ...character([{ name: 'Thresher Ko-1 Frame', type: 'Ancestry Feat', level: 1 }]),
    systems: ['sf2e'], dermalPlating: { grade: 'Tactical', raised: true } }
  const markup = renderToStaticMarkup(<Augmentations c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('Dermal Plating (Tactical)')
  expect(markup).toContain('Tactical (Hardness 10)')
  expect(armorClass(c, [])).toBe(armorClass({ ...c, dermalPlating: { ...c.dermalPlating, raised: false } }, []) + 1)
  expect(armorClass({ ...c, dermalPlating: { ...c.dermalPlating, damaged: true } }, []))
    .toBe(armorClass({ ...c, dermalPlating: undefined }, []))
  const shield = { id: 'shield', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: true }
  expect(armorClass({ ...c, shield }, [])).toBe(armorClass({ ...c, shield, dermalPlating: undefined }, []))
})

it('links attached weapons to their firearm and persists selection without extra hands', () => {
  const gun = { ...weapon, name: 'Arbalest', data: { hands: 2, weapon_group: 'Crossbow', weapon_type: 'Ranged' } }
  const sword = { ...weapon, data: { hands: 1 } }
  let c: Character = { ...character([]), weapons: [
    { id: 'gun', name: gun.name, potency: 2, striking: 1, runes: ['Flaming'], material: 'Orichalcum' },
    { id: 'sword', name: sword.name, potency: 0, striking: 0, runes: [], stowed: true },
  ] }
  const entries = [gun, sword]
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => WeaponList({ c, entries, save })
  const offense = () => WeaponList({ c, entries, save, displayOnly: true })
  const select = (value: string) => (findElement(tree(), e => e.props['aria-label'] === 'Attached weapon: Arbalest')!
    .props.onChange as (e: { target: { value: string } }) => void)({ target: { value } })
  select('Bayonet')
  c = JSON.parse(JSON.stringify(c))
  const attached = ownedWeapons(c, entries).find(w => w.attachedTo === 'gun')!
  expect(attached.name).toBe('Bayonet')
  expect(effectiveWeapon(c, entries, attached)).toMatchObject({ potency: 2, striking: 1, runes: ['Flaming'], material: 'Orichalcum' })
  expect(equippedWeaponHands(c, entries)).toBe(2)
  expect(weaponEquipped(c, entries, attached)).toBe(true)
  expect(c.weapons?.some(w => w.attachedTo)).toBe(false)
  const linked = findElement(offense(), e => e.props['aria-label'] === 'Equipped Bayonet (Attached to Arbalest)')!
  expect(linked.props).toMatchObject({ checked: true, disabled: true })
  const base = findElement(offense(), e => e.props['aria-label'] === 'Equipped Arbalest')!
  ;(base.props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: false } })
  expect(weaponEquipped(c, entries, attached)).toBe(false)
  select('Reinforced Stock')
  expect(ownedWeapons(c, entries).find(w => w.attachedTo === 'gun')?.name).toBe('Reinforced Stock')
  expect(renderToStaticMarkup(offense())).toContain('Reinforced Stock (Attached to Arbalest)')
  expect(renderToStaticMarkup(tree())).toContain('Reinforced Stock (Attached to Arbalest)')
  select('')
  expect(ownedWeapons(c, entries).some(w => w.attachedTo)).toBe(false)
})

it.each(['Katana', 'Claymore'])('changes %s damage with its saved grip in Equipment and Offense', name => {
  const katana: ContentEntry = { ...weapon, id: 'katana', name: 'Katana', traits: ['Two-Hand d10', 'Deadly d8'],
    data: { ...weapon.data, url: 'https://2e.aonprd.com/Weapons.aspx?ID=411', hands: 1, damage: '1d6 slashing' } }
  const claymore: ContentEntry = { ...katana, id: 'claymore', name: 'Claymore', source: 'homebrew', traits: ['Two-Hand', 'Deadly'] }
  const entries = [katana, claymore]
  let c: Character = { ...character([]), weapons: [{ id: 'blade', name, potency: 1, striking: 2, runes: [] }] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const damage = () => weaponAttack(c, entries, c.weapons![0]).damage
  expect(weaponAttack(c, entries, c.weapons![0]).traits).toContain('Deadly d8')
  for (const displayOnly of [false, true]) {
    const change = (hands: string) => {
      const select = findElement(WeaponList({ c, entries, save, displayOnly }), element => element.props['aria-label'] === `Hands: ${name}`)!
      ;(select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: hands } })
    }
    expect(damage()).toBe('3d6 slashing')
    change('2')
    c = JSON.parse(JSON.stringify(c))
    expect(damage()).toBe('3d10 slashing')
    for (const view of [false, true]) {
      expect(renderToStaticMarkup(<WeaponList c={c} entries={entries} save={save} displayOnly={view} />)).toContain('3d10 S')
    }
    change('1')
    expect(damage()).toBe('3d6 slashing')
  }
  expect(claymore.traits).toEqual(['Two-Hand', 'Deadly'])
  const custom = { ...claymore, traits: ['Two-Hand 1d12'] }
  expect(weaponAttack(c, [katana, custom], { ...c.weapons![0], name: 'Claymore', handsHeld: 2 }).damage).toBe('3d12 slashing')
})

it('uses the attached weapon two-hand die based on its base weapon grip', () => {
  const gun = { ...weapon, name: 'Gun', data: { hands: '1 or 2', weapon_group: 'Firearm', weapon_type: 'Ranged' } }
  const stock = { ...weapon, name: 'Reinforced Stock', traits: ['Attached', 'Finesse', 'Two-Hand'],
    data: { hands: '1 or 2', damage: '1d4 bludgeoning' } }
  const c: Character = { ...character([]), weapons: [
    { id: 'gun', name: gun.name, potency: 1, striking: 1, runes: [], attachedWeapon: 'Reinforced Stock' },
  ] }
  const entries = [gun, stock]
  const attack = () => weaponAttack(c, entries, ownedWeapons(c, entries).find(w => w.attachedTo === 'gun')!)
  expect(attack().damage).toBe('2d4 bludgeoning')
  expect(attack().traits).toContain('Two-Hand d8')
  c.weapons![0].handsHeld = 2
  expect(attack().damage).toBe('2d8 bludgeoning')
  expect(renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} displayOnly />)).toContain('2d8 B')
  gun.data.hands = '2'
  delete c.weapons![0].handsHeld
  expect(attack().damage).toBe('2d8 bludgeoning')
  c.weapons![0].attachedWeapon = 'Bayonet'
  expect(attack().damage).toBe('2d4 piercing')
})

it('syncs Dynamic Weighting grip controls, damage, and hand usage across both weapon views', () => {
  const prototype = { ...weapon, name: 'Prototype', data: { weapon_category: 'Martial', hands: 1, damage: '1d6 slashing' } }
  let c: Character = { ...character([]), className: 'Inventor', subclass: 'Weapon', level: 1, weapons: [
    { id: 'prototype', name: prototype.name, potency: 0, striking: 1, runes: [], inventorInnovation: true,
      inventorModifications: { initial: 'Dynamic Weighting' } },
  ] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  for (const displayOnly of [false, true]) {
    const select = findElement(WeaponList({ c, entries: [prototype], save, displayOnly }),
      element => element.props['aria-label'] === 'Hands: Prototype')!
    ;(select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: '2' } })
    expect(equippedWeaponHands(c, [prototype])).toBe(2)
    for (const view of [false, true]) {
      const markup = renderToStaticMarkup(<WeaponList c={c} entries={[prototype]} save={save} displayOnly={view} />)
      expect(markup).toContain('2d8 S')
      expect(markup).toContain('<option value="2" selected="">2</option>')
    }
    c = { ...c, weapons: c.weapons!.map(w => ({ ...w, handsHeld: 1 })) }
  }
})

it.each(['Phase Cutlass', 'Reality Ripper'])('persists %s modes and syncs mode damage and traits in both weapon views', name => {
  const phase = name === 'Phase Cutlass'
  const firstType = phase ? 'slashing' : 'acid'
  const die = phase ? 6 : 8
  const entry: ContentEntry = { ...weapon, name, systems: ['sf2e'],
    traits: ['Modular', 'Tech', ...(phase ? ['Analog', 'Powered'] : ['Razing', 'Deadly'])],
    data: { hands: phase ? 1 : 2, damage: `2d${die} Modular`, weapon_type: phase ? 'Melee' : 'Ranged',
      weapon_category: 'Martial', weapon_tracking: 1, upgrade_slots: 2 },
    weaponModes: [
      { id: 'mode-1', damageType: firstType, traits: phase ? ['Analog'] : ['Tech', 'Razing'] },
      { id: 'mode-2', damageType: 'void', traits: phase ? ['Powered', 'Tech'] : ['Tech', 'Deadly d10'] },
    ] }
  let c: Character = { ...character([]), systems: ['sf2e'],
    weapons: [{ id: 'mode-weapon', name, potency: 0, striking: 0, runes: [] }] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  for (const displayOnly of [false, true]) {
    const change = (mode: string) => {
      const select = findElement(WeaponList({ c, entries: [entry], save, displayOnly }),
        element => element.props['aria-label'] === `Mode: ${name}`)!
      ;(select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: mode } })
    }
    expect(weaponAttack(c, [entry], c.weapons![0]).damage).toBe(`2d${die} ${firstType}`)
    change('mode-2')
    c = JSON.parse(JSON.stringify(c))
    expect(c.weapons![0].weaponMode).toBe('mode-2')
    expect(weaponAttack(c, [entry], c.weapons![0]).damage).toBe(`2d${die} void`)
    for (const view of [false, true]) {
      const markup = renderToStaticMarkup(<WeaponList c={c} entries={[entry]} save={save} displayOnly={view} />)
      expect(markup).toContain(`2d${die} void`)
      expect(markup).toContain(phase ? 'Powered' : 'Deadly d10')
      expect(markup).not.toContain(phase ? '>Analog' : '>Razing')
    }
    change('invalid')
    expect(c.weapons![0].weaponMode).toBe('mode-2')
    change('mode-1')
    expect(weaponAttack(c, [entry], c.weapons![0]).damage).toBe(`2d${die} ${firstType}`)
  }
  c = { ...c, weapons: c.weapons!.map(w => ({ ...w, weaponMode: 'unavailable' })) }
  expect(renderToStaticMarkup(<WeaponList c={c} entries={[entry]} save={save} />))
    .toContain('Saved mode unavailable; showing first mode')
})

it.each(['Lesser', 'Moderate', 'Major'] as const)('protects installed %s reinforcement while Blessed Shield is selected', rune => {
  const c: Character = { ...character([]), className: 'Champion', level: 10, blessing: 'Blessed Shield',
    shield: { id: 'shield', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: false, reinforcingRune: rune } }
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} part="shield" />)
  expect(markup).toContain(`Reinforcing Rune (${rune})`)
  expect(markup).toContain('Protected by Blessed Shield')
  expect(markup).not.toContain('aria-label="Remove Reinforcing Rune')
  const unblessed = renderToStaticMarkup(<ArmorList c={{ ...c, blessing: 'Blessed Swiftness' }} entries={[]} save={() => {}} part="shield" />)
  expect(unblessed).toContain(`aria-label="Remove Reinforcing Rune (${rune}) rune"`)
})

it('automates shield weapon enhancements without helper text and preserves editable property runes', () => {
  const entries = ['Shield Spikes', 'Shield Pistol', 'Shield Boss'].map(name => ({
    ...weapon, id: name, name, traits: ['Attached'],
    data: { hands: 1, damage: name === 'Shield Boss' ? '1d6 B' : '1d6 P', weapon_group: name === 'Shield Pistol' ? 'Firearm' : 'Shield' },
  }))
  let c: Character = { ...character([]), weapons: [],
    shield: { id: 'shield', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: false,
      material: { name: 'Orichalcum' } },
  }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const select = (value: string) => {
    const control = findElement(ShieldAttachment({ c, entries, save, shield: c.shield! }), e => e.type === 'select')!
    ;(control.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } })
  }
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={entries} save={save} part="shield" />)
  expect(markup).toContain('aria-label="Attached weapon: Steel Shield"')
  expect(markup.indexOf('Shield Boss')).toBeLessThan(markup.indexOf('Shield Pistol'))
  expect(markup.indexOf('Shield Pistol')).toBeLessThan(markup.indexOf('Shield Spikes'))
  select('Shield Boss')
  const attachment = () => ownedWeapons(c, entries).find(w => w.attachedTo === 'shield')!
  expect(attachment().name).toBe('Shield Boss')
  expect(equippedWeaponHands(c, entries)).toBe(0)
  expect(weaponEquipped(c, entries, attachment())).toBe(true)
  const card = findElement(WeaponList({ c, entries, save }), e => e.props['aria-label'] === 'Shield Boss (Attached to Steel Shield)')!
  const runes = findElement(card, e => Array.isArray(e.props.runes) && typeof e.props.onChange === 'function')!
  ;(runes.props.onChange as (value: string[]) => void)(['Flaming'])
  expect(c.shield?.attachedWeapon?.runes).toEqual(['Flaming'])
  expect(c.weapons?.some(w => w.attachedTo)).toBe(false)
  expect(effectiveWeapon(c, entries, attachment())).toMatchObject({ potency: 2, striking: 1, material: 'Orichalcum' })
  c = { ...c, shield: { ...c.shield!, material: { name: 'Cold Iron (Low-Grade)' } } }
  expect(effectiveWeapon(c, entries, attachment()).material).toBe('Cold Iron (Low-Grade)')
  const gear = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={save} />)
  expect(gear).not.toContain('(from Steel Shield)')
  expect(gear).not.toContain('Cold Iron (Low-Grade)')
  expect(gear).not.toContain('Potency')
  expect(gear).not.toContain('Striking')
  expect(gear).not.toContain('aria-label="Weapon material"')
  expect(gear).toContain('Flaming')
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  select('Shield Spikes')
  expect(attachment().name).toBe('Shield Boss')
  select('Shield Pistol')
  c = JSON.parse(JSON.stringify(c))
  expect(attachment().name).toBe('Shield Pistol')
  expect(weaponAttack(c, entries, attachment()).entry?.name).toBe('Shield Pistol')
  select('')
  expect(attachment().name).toBe('Shield Bash')
  expect(c.shield?.attachedWeapon).toBeUndefined()
})

it('defaults to Shield Bash without extra hands or weapon enhancements', () => {
  const c: Character = { ...character([]), level: 20, weapons: [],
    shield: { id: 'shield', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: false,
      material: { name: 'Cold Iron Shield (High-Grade)' } },
  }
  const bash = ownedWeapons(c, []).find(w => w.name === 'Shield Bash')!
  expect(weaponEquipped(c, [], bash)).toBe(true)
  expect(equippedWeaponHands(c, [])).toBe(0)
  expect(weaponAttack(c, [], bash).damage).toBe('1d4 bludgeoning')
  expect(effectiveWeapon(c, [], bash)).toMatchObject({ potency: 0, striking: 0, runes: [], material: c.shield?.material?.name })
  const gear = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)
  expect(gear).toContain('Shield Bash (Attached to Steel Shield)')
  expect(gear).not.toContain('<label>Potency')
  expect(gear).not.toContain('Add rune')
  expect(renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} part="shield" />))
    .toContain('Shield Bash (default)')
  expect(ownedWeapons({ ...c, shield: undefined }, []).some(w => w.name === 'Shield Bash')).toBe(false)
})

it('keeps attachments on their own shields when switching to a generated hardwood shield', () => {
  const attachedWeapon: OwnedWeapon = { id: 'boss', name: 'Shield Boss', potency: 1, striking: 1, runes: ['Flaming'] }
  let c: Character = { ...character([{ name: 'Hardwood Armor', type: 'Class Feat', level: 1 }]), className: 'Druid',
    shield: { id: 'steel', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: false, attachedWeapon },
    hardwoodShield: { equipped: true, attachedWeapon: { ...attachedWeapon, id: 'spikes', name: 'Shield Spikes' } },
  }
  const weapons = () => ownedWeapons(c, [])
  const boss = weapons().find(w => w.id === 'boss')!
  const spikes = weapons().find(w => w.id === 'spikes')!
  expect(weaponEquipped(c, [], boss)).toBe(false)
  expect(weaponEquipped(c, [], spikes)).toBe(true)
  expect(effectiveWeapon(c, [], spikes)).toMatchObject({ potency: 2, striking: 1, material: 'Duskwood (Standard-Grade)', runes: ['Flaming'] })
  c = { ...c, level: 20, hardwoodShield: { ...c.hardwoodShield, equipped: false } }
  expect(weaponEquipped(c, [], spikes)).toBe(false)
  expect(weaponEquipped(c, [], boss)).toBe(true)
  expect(effectiveWeapon(c, [], spikes).material).toBe('Duskwood (High-Grade)')
  c = { ...c, shield: undefined }
  expect(weapons().some(w => w.id === 'boss')).toBe(false)
})

it.each([
  [1, 0, 0], [2, 1, 0], [4, 1, 1], [10, 2, 1],
  [12, 2, 2], [16, 3, 2], [19, 3, 3],
] as const)('automatically scales shield weapon fundamentals at level %i', (level, potency, striking) => {
  const c: Character = { ...character([]), level, weapons: [], shield: {
    id: 'shield', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: false,
    material: { name: 'Orichalcum Shield (High-Grade)' },
    attachedWeapon: { id: 'spikes', name: 'Shield Spikes', potency: 0, striking: 0, runes: [] },
  } }
  const entry = { ...weapon, id: 'spikes', name: 'Shield Spikes', data: { ...weapon.data, damage: '1d6 piercing', hands: 1 } }
  const attack = ownedWeapons(c, [entry]).find(w => w.id === 'spikes')!
  expect(effectiveWeapon(c, [entry], attack)).toMatchObject({ potency, striking })
  expect(weaponAttack(c, [entry], attack).damage).toBe(`${1 + striking}d6 piercing`)
  expect(effectiveWeapon(c, [entry], attack).material).toBe('Orichalcum Shield (High-Grade)')
  expect(c.shield?.attachedWeapon).toMatchObject({ potency: 0, striking: 0 })
})

it.each([[4, ''], [5, "Bolka's Blessing"], [11, "Greater Bolka's Blessing"]])(
  'grants locked clan dagger filigrees at level %i', (level, expected) => {
    const c: Character = { ...character([]), level, weapons: [{ id: 'dagger', name: 'Clan Dagger', potency: 0, striking: 0, runes: [] }] }
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)
    if (!expected) expect(markup).not.toContain("Bolka&#x27;s Blessing")
    else {
      expect(markup).toContain(expected.replace("'", '&#x27;'))
      expect(markup).toContain(`${level >= 11 ? 'Greater ' : ''}Kols&#x27;s Oath`)
      expect(markup).toContain(`${level >= 11 ? 'Greater ' : ''}Trudd&#x27;s Strength`)
      expect(markup).not.toContain('aria-label="Remove Bolka')
      expect(markup).not.toContain('aria-label="Remove Greater Bolka')
    }
  },
)

it('follows selected haft source including a staff wielded in two hands', () => {
  const staff = { ...weapon, name: 'Staff', traits: ['Two-Hand d8'], data: { hands: 1, weapon_group: 'Club' } }
  let c: Character = { ...character([{ name: 'Haft Striker Stance', type: 'Class Feat', level: 4 }]),
    weapons: [{ id: 'staff', name: 'Staff', potency: 0, striking: 0, runes: [], handsHeld: 2 }] }
  const entries = [staff]
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const get = () => ownedWeapons(c, entries).find(w => w.name === HAFT_STRIKER_WEAPON.name)!
  expect(weaponEquipped(c, entries, get())).toBe(true)
  expect(equippedWeaponHands(c, entries)).toBe(2)
  const input = findElement(WeaponList({ c, entries, save, displayOnly: true }), e => e.props['aria-label'] === 'Equipped Haft Striker Stance')!
  expect(input.props).toMatchObject({ checked: true, disabled: true })
  const grip = findElement(WeaponList({ c, entries, save, displayOnly: true }), e => e.props['aria-label'] === 'Hands: Staff')!
  ;(grip.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: '1' } })
  expect(weaponEquipped(c, entries, get())).toBe(false)
  expect(equippedWeaponHands(c, entries)).toBe(1)
})

it('blocks equipping when a held weapon has unknown handedness without changing legacy state', () => {
  const known = { ...weapon, name: 'Dagger', data: { hands: 1 } }
  const c: Character = { ...character([]), weapons: [
    { id: 'unknown', name: 'Unknown weapon', potency: 0, striking: 0, runes: [] },
    { id: 'known', name: 'Dagger', potency: 0, striking: 0, runes: [], stowed: true },
  ] }
  const tree = WeaponList({ c, entries: [known], save: () => {}, displayOnly: true })
  expect(findElement(tree, e => e.props['aria-label'] === 'Equipped Unknown weapon')?.props)
    .toMatchObject({ checked: true, disabled: false })
  expect(findElement(tree, e => e.props['aria-label'] === 'Equipped Dagger')?.props.disabled).toBe(true)
  expect(renderToStaticMarkup(tree)).toContain('Equipped weapon hands unavailable')
})

it.each<[string, OwnedArmor['material'], string]>([
  ['Hide Armor', 'Grisantian Hide', 'Grisantian Hide Armor'],
  ['Hide Armor', 'Grisantian Hide (High-Grade)', 'Grisantian Hide Armor'],
  ['Hellknight Plate', 'Orichalcum', 'Orichalcum Hellknight Plate'],
  ['Wood Breastplate', 'Duskwood', 'Duskwood Breastplate'],
  ['Wooden Breastplate', 'Duskwood', 'Duskwood Breastplate'],
  ['Grisantian Hide Armor', 'Grisantian Hide', 'Grisantian Hide Armor'],
  ['Hide Armor', undefined, 'Hide Armor'],
])('combines %s and %s into a material-aware armor name without changing its identity', (name, material, expected) => {
  const armor = { name, material }
  expect(armorDisplayName(armor)).toBe(expected)
  expect(armor.name).toBe(name)
})

it('omits ruleset badges from owned armor cards', () => {
  const c: Character = { ...character([]), armors: [{ id: 'hide', name: 'Hide Armor', potency: 0, resilient: 0, runes: [], worn: true }] }
  const armor: ContentEntry = { ...weapon, id: 'hide', name: 'Hide Armor', kind: 'armor', data: { armor_category: 'Medium' } }
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[armor]} save={() => {}} />)
  expect(markup).toContain('<strong>Hide Armor</strong>')
  expect(markup).not.toContain('>PF2e</small>')
  expect(markup).not.toContain('>PF2E</small>')
})

it('displays locked Living Weapon fundamentals as rune text while retaining genuinely editable upgrades', () => {
  const c: Character = { ...character([{ name: 'Living Weapon', type: 'Class Feat', level: 1 }], true), level: 20 }
  const render = (character: Character) => {
    const card = findElement(WeaponList({ c: character, entries: [weapon], save: () => {} }),
      element => element.type === 'details' && element.props['aria-label'] === weapon.name)!
    return renderToStaticMarkup(card)
  }
  const locked = render(c)
  expect(locked).toContain('<span>Potency <b>+3</b></span>')
  expect(locked).toContain('<span>Striking <b>Major Striking</b></span>')
  expect(locked).not.toContain('<label>Potency')
  expect(locked).not.toContain('<label>Striking')
  const upgradeable = render({ ...c, level: 10 })
  expect(upgradeable).toContain('<label>Potency <select')
  expect(upgradeable).toContain('<label>Striking <select')
  const ordinary = render({ ...c, feats: [] })
  expect(ordinary).toContain('<label>Potency <select')
  expect(ordinary).toContain('<label>Striking <select')
})

it('tracks loaded ammunition for capacity weapons and clamps controls to capacity', () => {
  const capacityWeapon: ContentEntry = { ...weapon, id: 'repeating-hand-crossbow', name: 'Repeating Hand Crossbow',
    traits: ['Capacity 5'] }
  let c: Character = { ...character([]), weapons: [{ id: 'repeater', name: capacityWeapon.name,
    potency: 0, striking: 0, runes: [] }] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = (displayOnly = false) => WeaponList({ c, entries: [capacityWeapon], save, displayOnly })
  expect(renderToStaticMarkup(tree())).toContain('5/5 loaded')
  expect(findElement(tree(), element => element.props['aria-label'] === 'Decrease Repeating Hand Crossbow loaded ammunition')?.props.disabled)
    .toBe(false)
  expect(findElement(tree(), element => element.props['aria-label'] === 'Increase Repeating Hand Crossbow loaded ammunition')?.props.disabled)
    .toBe(true)
  ;(findElement(tree(), element => element.props['aria-label'] === 'Decrease Repeating Hand Crossbow loaded ammunition')!
    .props.onClick as () => void)()
  expect(c.weapons?.[0].capacityLoaded).toBe(4)
  expect(renderToStaticMarkup(tree())).toContain('4/5 loaded')
  ;(findElement(tree(), element => element.props['aria-label'] === 'Increase Repeating Hand Crossbow loaded ammunition')!
    .props.onClick as () => void)()
  expect(c.weapons?.[0].capacityLoaded).toBe(5)

  c = { ...c, weapons: c.weapons?.map(item => ({ ...item, capacityLoaded: 0 })) }
  expect(findElement(tree(), element => element.props['aria-label'] === 'Decrease Repeating Hand Crossbow loaded ammunition')?.props.disabled)
    .toBe(true)
  expect(renderToStaticMarkup(tree(true))).toContain('0/5 loaded')
  expect(renderToStaticMarkup(tree(true))).not.toContain('aria-label="Increase Repeating Hand Crossbow loaded ammunition"')
})

it('shows precise Bulk thresholds and Hardy Traveler contribution without claiming to measure carried inventory', () => {
  const c: Character = { ...character([{ name: 'Hardy Traveler', level: 9, type: 'Ancestry Feat', slot: 'ancestry:9:0' }]),
    abilities: { ...character([]).abilities, str: 14 } }
  const feat: ContentEntry = { ...weapon, id: 'hardy', kind: 'feat', name: 'Hardy Traveler',
    description: 'Increase your maximum and encumbered Bulk limits by 1.', data: {}, level: 9 }
  const markup = renderToStaticMarkup(<BulkLimits c={c} entries={[feat]} />)
  expect(markup).toContain('aria-label="Bulk limits"')
  expect(markup).toContain('Encumbered above <b>8</b> Bulk; maximum <b>13</b> Bulk.')
  expect(markup).toContain('Strength +2; size Medium; Hardy Traveler +1')
  expect(markup).toContain('Worn-item bonuses and temporary size changes are not tracked.')
  expect(renderToStaticMarkup(<BulkLimits c={{ ...c, level: 8 }} entries={[feat]} />))
    .toContain('Encumbered above <b>7</b> Bulk; maximum <b>12</b> Bulk.')
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
  expect(markup.indexOf('aria-haspopup="dialog">Orichalcum')).toBeLessThan(markup.indexOf('<label>Potency'))
  const armorMaterial = findElement(ArmorList({ c, entries: [], save }), (element) => element.props['aria-label'] === 'Armor material')
  if (!armorMaterial) throw new Error('Missing armor material')
  ;(armorMaterial.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Orichalcum' } })
  expect(c.armors?.[0]).toMatchObject({ material: 'Orichalcum', potency: 3, resilient: 2 })
  const armorMarkup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={save} />)
  expect(armorMarkup).toContain('<strong>Orichalcum Chain Mail</strong>')
  expect(armorMarkup.indexOf('aria-haspopup="dialog">Orichalcum')).toBeLessThan(armorMarkup.indexOf('<label>Potency'))
  expect(armorMarkup.indexOf('aria-haspopup="dialog">Orichalcum')).toBeLessThan(armorMarkup.indexOf('<label>Resilient'))
  expect(armorMarkup).not.toContain('One additional property rune slot')
  expect(armorMarkup).not.toContain('Add Custom Shield')
  expect(armorMarkup).not.toContain('<small>Armor Class <b>')
  ;(armorMaterial.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Duskwood' } })
  expect(c.armors?.[0]).toMatchObject({ material: 'Duskwood', potency: 3, resilient: 2 })
  expect(renderToStaticMarkup(<ArmorList c={c} entries={[]} save={save} />)).toContain('aria-haspopup="dialog">Duskwood (Standard-Grade)</button>')
  c = { ...c, feats: [{ name: 'Living Weapon', type: 'Class Feat', level: 1 }] }
  c.weapons![0].livingWeapon = true
  const locked = findElement(WeaponList({ c, entries: [weapon], save }), (element) => element.props['aria-label'] === 'Weapon material')
  expect(locked).toBeUndefined()
  expect(c.weapons?.[0].material).toBe('Orichalcum')
  const livingMarkup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={save} />)
  expect(livingMarkup).toContain('aria-haspopup="dialog">Peachwood (Standard-Grade)</button>')
  expect(livingMarkup).not.toContain('aria-label="Remove Peachwood (Standard-Grade) material"')
  expect(livingMarkup).not.toContain('Material locked by Living Weapon')
  expect(livingMarkup).not.toContain('High-grade peachwood:')
})

it('allows a fifth Orichalcum rune with Inventor Rune Capacity modification on weapon or armor', () => {
  const weaponCharacter: Character = {
    ...character([]), className: 'Inventor', subclass: 'Weapon', level: 15,
    weapons: [{
      id: 'innovation', name: 'Longsword', potency: 3, striking: 3, inventorInnovation: true,
      runes: ['Flaming', 'Frost', 'Shock', 'Wounding'],
      inventorModifications: { revolutionary: 'Rune Capacity' },
    }],
  }
  const weaponMarkup = renderToStaticMarkup(<WeaponList c={weaponCharacter} entries={[weapon]} save={() => {}} />)
  expect(weaponMarkup).toContain('aria-label="Add property rune"')
  expect(renderToStaticMarkup(<WeaponList c={{
    ...weaponCharacter,
    weapons: [{ ...weaponCharacter.weapons![0], inventorModifications: undefined }],
  }} entries={[weapon]} save={() => {}} />)).not.toContain('aria-label="Add property rune"')

  const armorCharacter: Character = {
    ...character([]), className: 'Inventor', subclass: 'Armor', level: 15,
    armors: [{
      id: INVENTOR_ARMOR_ID, name: 'Power Suit', material: 'Orichalcum', potency: 3, resilient: 3, worn: true,
      runes: ['Flaming', 'Frost', 'Shock', 'Wounding'],
    }],
    inventorArmorModifications: { revolutionary: 'Rune Capacity' },
  }
  expect(renderToStaticMarkup(<ArmorList c={armorCharacter} entries={[]} save={() => {}} />))
    .toContain('aria-label="Add property rune"')
})

it('offers one Grisantian Hide choice and automatically displays its level-appropriate grade', () => {
  let c: Character = { ...character([]), level: 18,
    armors: [{ id: 'armor', name: 'Hide Armor', worn: true, potency: 2, resilient: 1, runes: [] }] }
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const initial = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={save} />)
  expect(initial.match(/<option>Grisantian Hide<\/option>/g)).toHaveLength(1)
  expect(initial).not.toContain('<option>Grisantian Hide (')
  const picker = findElement(ArmorList({ c, entries: [], save }), element => element.props['aria-label'] === 'Armor material')
  if (!picker) throw new Error('Missing material picker')
  ;(picker.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Grisantian Hide' } })
  expect(c.armors?.[0].material).toBe('Grisantian Hide')
  expect(renderToStaticMarkup(<ArmorList c={c} entries={[]} save={save} />)).toContain('>Grisantian Hide (Standard-Grade)</button>')
  c = { ...c, level: 19 }
  expect(renderToStaticMarkup(<ArmorList c={c} entries={[]} save={save} />)).toContain('>Grisantian Hide (High-Grade)</button>')
  expect(c.armors?.[0]).toMatchObject({ material: 'Grisantian Hide', potency: 2, resilient: 1 })
  expect(save).toHaveBeenCalledTimes(1)
})

it('opens grade-specific weapon and armor material rules with the correct item level', () => {
  const item = (name: string, level: number, description: string): ContentEntry =>
    ({ ...weapon, id: name, kind: 'item', name, level, description })
  const entries = [
    weapon, item('Peachwood Weapon', 12, 'Base weapon rules.'),
    item('Peachwood Weapon (High-Grade)', 18, 'High-grade weapon rules.'),
    item('Grisantian Pelt Armor', 12, 'Base armor rules.'),
    item('Grisantian Pelt Armor (High-Grade)', 19, 'High-grade armor rules.'),
    item('Grisantian Pelt', 0, 'Object rules.'),
  ]
  const c: Character = { ...character([{ name: 'Living Weapon', level: 1, type: 'Class Feat' }], true), level: 19,
    armors: [{ id: 'armor', name: 'Hide Armor', worn: true, material: 'Grisantian Hide (High-Grade)', potency: 0, resilient: 0, runes: [] }] }
  const weapons = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} />)
  expect(weapons).toContain('Peachwood (High-Grade)<small> (Level 18)</small>')
  expect(weapons).toContain('High-grade weapon rules.')
  expect(weapons).not.toContain('Base weapon rules.')
  const armor = renderToStaticMarkup(<ArmorList c={c} entries={entries} save={() => {}} />)
  expect(armor).toContain('Grisantian Hide (High-Grade)<small> (Level 19)</small>')
  expect(armor).toContain('High-grade armor rules.')
  expect(armor).not.toContain('Object rules.')
  expect(armor).toContain('aria-label="Remove Grisantian Hide (High-Grade) material"')
})

it('preserves a dormant deity weapon when editing other gear and restores its identity after changing class back', () => {
  const dormant: OwnedWeapon = { id: 'deity-weapon:longsword', name: 'Longsword', potency: 3, striking: 3, runes: ['Flaming'] }
  let c: Character = { ...character([]), deity: 'Iomedae', weapons: [...character([]).weapons!, dormant] }
  const entries: ContentEntry[] = [weapon, { ...weapon, id: 'deity', kind: 'deity', name: 'Iomedae', data: { favored_weapon: 'longsword' } }]
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const control = findElement(WeaponList({ c, entries, save }), element => element.props.label === 'Potency')
  if (!control) throw new Error('Missing purchased weapon potency')
  ;(control.props.onChange as (value: number) => void)(2)
  expect(c.weapons?.find(w => w.id === dormant.id)).toEqual(dormant)
  c = { ...c, className: 'Cleric' }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={save} />)
  expect(markup.match(/aria-label="Remove Longsword"/g)).toHaveLength(1)
  expect(effectiveWeapon(c, entries, dormant)).toMatchObject({ potency: 3, striking: 3, runes: ['Flaming'] })
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
  let c = character([{ name: 'Haft Striker Stance', type: 'Class Feat', level: 4 },
    { name: 'Living Weapon', type: 'Class Feat', level: 1 }])
  c.weapons = [{ ...c.weapons![0], id: 'first', name: 'Spear', livingWeapon: true }, { ...c.weapons![0], id: 'second', name: 'Hammer', runes: ['Frost'] }]
  const entries = [
    { ...weapon, name: 'Spear', data: { hands: 2, weapon_group: 'Spear', damage: '1d8 piercing' } },
    { ...weapon, name: 'Hammer', data: { hands: 2, weapon_group: 'Hammer', damage: '1d12 bludgeoning' } },
  ]
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const living = findElement(WeaponList({ c, entries, save }), element => element.props['aria-label'] === 'Living Weapon: inherited from Spear')!
  expect(living.props).toMatchObject({ checked: true, disabled: true })
  expect(living.props.onChange).toBeUndefined()
  const haft = ownedWeapons(c, entries).find(weapon => weapon.name === HAFT_STRIKER_WEAPON.name)!
  expect(effectiveWeapon(c, entries, haft)).toMatchObject({ livingWeapon: true, material: 'Peachwood (Standard-Grade)' })
  const selector = findElement(WeaponList({ c, entries, save }), (element) => element.props['aria-label'] === 'Haft weapon')
  if (!selector) throw new Error('Missing haft source selector')
  ;(selector.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'second' } })
  expect(c.haftStrikerWeaponId).toBe('second')
  c = JSON.parse(JSON.stringify(c))
  expect(effectiveWeapon(c, entries, haft).livingWeapon).toBe(false)
  const card = findElement(WeaponList({ c, entries, save }), (element) => element.props['aria-label'] === 'Haft Striker Stance')
  if (!card) throw new Error('Missing haft card')
  const markup = renderToStaticMarkup(card)
  expect(findElement(card, element => element.props['aria-label'] === 'Living Weapon: inherited from Hammer')!.props)
    .toMatchObject({ checked: false, disabled: true })
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
    expect(markup).toContain('Damage 2d8 S + 1d6 fire')
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
  ['Flaming', '1d6 fire', '1d10 persistent fire damage on a critical hit.'],
  ['Flaming (Greater)', '1d6 fire', '2d10 persistent fire damage on a critical hit; fire damage from this weapon ignores fire resistance.'],
  ['Ashen', '1d4 persistent fire', 'On hit, target must attempt a DC 25 Will save or be confused for 1 round.'],
  ['Ashen (Greater)', '1d8 persistent fire', 'On hit, target must attempt a DC 35 Will save or be confused for 1 round; critical failure extends confusion to 1 minute.'],
] as const)('shows %s damage numerically with compact conditional markers', (rune, damage, note) => {
  const c = character([])
  c.weapons![0].runes = [rune]
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={() => {}} />)
  expect(markup).toContain(`Damage 2d8 S + ${damage}`)
  expect(markup).not.toContain('class="gear-damage"')
  if (note) {
    expect(markup).toContain(`title="${note} (${rune})"`)
    expect(markup).toContain(`aria-label="${rune} note"`)
    expect(markup).not.toContain(`*</button> (${rune})`)
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
  expect(summary).toContain('attack +35: show breakdown')
  expect(summary).toContain('Damage 4d6+4 P + 1d6 force')
  expect(summary).not.toContain('Shifting')
  expect(markup).not.toContain('class="gear-damage"')
})

it('omits rune names from multiple damage notes in editable and display-only views', () => {
  const c = character([])
  c.weapons![0].runes = ['Astral (Greater)', 'Holy']
  for (const displayOnly of [false, true]) {
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={() => {}} displayOnly={displayOnly} />)
    expect(markup).toMatch(/Damage 2d8 S \+ 1d6 spirit<button[^>]*>\*<\/button><span[^>]*>.*?<\/span>, 1d4 spirit<button/)
    expect(markup).not.toContain('*</button> (Astral (Greater))')
    expect(markup).not.toContain('*</button> (Holy)')
    expect(markup).toContain('Greater Astral: spirit damage ignores spirit resistance.')
    expect(markup).toContain('Holy: 2d4 spirit instead against unholy targets.')
  }
})

it('adds Hooked Trip trait without adding damage or duplicating a natural Trip trait', () => {
  const c = character([])
  c.weapons![0].runes = ['Hooked']
  for (const traits of [[], ['Trip']]) {
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={[{ ...weapon, traits }]} save={() => {}} />)
    expect(markup).not.toContain('class="gear-damage"')
    expect(markup).toContain('Damage 2d8 S')
    expect(markup).not.toContain('slashing + Hooked')
    expect(markup.match(/class="gear-trait" aria-haspopup="dialog">Trip<\/button>/g)).toHaveLength(1)
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

it.each(ARMOR_GAUNTLETS)('inherits plate material and fundamentals for armor-provided %s without changing purchased weapons or stored enhancements', (name) => {
  const saved: OwnedWeapon = { id: GAUNTLET.id, name, material: 'Peachwood (Greater)', potency: 3, striking: 1,
    runes: ['Flaming', 'Frost', 'Shock', 'Thundering'] }
  let c: Character = { ...character([]), weapons: [saved],
    armors: [{ id: 'plate', name: 'Full Plate', material: 'Orichalcum', gauntlet: name, worn: true, potency: 0, resilient: 0, runes: [] }] }
  const material = () => findElement(WeaponList({ c, entries: [], save: () => {} }), (element) => element.props['aria-label'] === 'Weapon material')
  expect(material()).toBeUndefined()
  expect(renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)).toContain('aria-haspopup="dialog">Orichalcum</button>')
  expect(effectiveWeapon(c, [], saved)).toMatchObject({ material: 'Orichalcum', potency: 0, striking: 0, runes: [] })
  const card = findElement(WeaponList({ c, entries: [], save: () => {} }),
    element => element.type === 'details' && element.props['aria-label'] === name)!
  const markup = renderToStaticMarkup(card)
  expect(markup).toContain('<span>Potency <b>None</b></span>')
  expect(markup).toContain('<span>Striking <b>None</b></span>')
  expect(markup).not.toContain('<label>Potency')
  expect(markup).not.toContain('<label>Striking')
  expect(effectiveWeapon(c, [], { ...saved, id: 'purchased' }).material).toBe('Peachwood (Standard-Grade)')
  c = { ...c, armors: c.armors!.map((armor) => ({ ...armor, material: undefined })) }
  expect(material()).toBeUndefined()
  expect(effectiveWeapon(c, [], saved)).toMatchObject({ material: undefined, runes: [] })
  c = { ...c, armors: c.armors!.map((armor) => ({ ...armor, material: 'Duskwood' })) }
  expect(material()).toBeUndefined()
  expect(renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)).toContain('aria-haspopup="dialog">Duskwood (Standard-Grade)</button>')
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

it('persists individual weapon collapse state across reloads without changing weapon configuration', () => {
  let c = character([])
  const weapons = structuredClone(c.weapons)
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const card = (name: string) => findElement(WeaponList({ c, entries: [weapon], save }),
    element => element.type === 'details' && element.props['aria-label'] === name)!
  const toggle = (name: string, open: boolean) => {
    const target = { open }
    ;(card(name).props.onToggle as (event: { target: typeof target; currentTarget: typeof target }) => void)({ target, currentTarget: target })
  }
  expect(card('Longsword').props.open).toBe(true)
  toggle('Longsword', true)
  expect(save).not.toHaveBeenCalled()
  toggle('Longsword', false)
  expect(c.collapsedWeaponIds).toEqual(['w'])
  c = JSON.parse(JSON.stringify(c))
  expect(card('Longsword').props.open).toBe(false)
  expect(card('Fist').props.open).toBe(true)
  toggle('Longsword', false)
  expect(save).toHaveBeenCalledTimes(1)
  toggle('Fist', false)
  const fist = ownedWeapons(c, [weapon]).find(attack => attack.name === 'Fist')!
  expect(c.collapsedWeaponIds).toEqual(['w', fist.id])
  toggle('Longsword', true)
  c = JSON.parse(JSON.stringify(c))
  expect(card('Longsword').props.open).toBe(true)
  expect(card('Fist').props.open).toBe(false)
  expect(c.collapsedWeaponIds).toEqual([fist.id])
  expect(c.weapons).toEqual(weapons)
  c = { ...c, id: 'another-character', collapsedWeaponIds: undefined }
  expect(card('Fist').props.open).toBe(true)
})

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
  expect(c.handwraps).toEqual({ potency: 2, striking: 1, runes: [] })
  const sword = findElement(weapons(), (element) => element.type === 'details' && element.props['aria-label'] === 'Longsword')
  const striking = findElement(sword, (element) => element.props.label === 'Striking')
  if (!striking) throw new Error('Missing sword striking control')
  ;(striking.props.onChange as (value: number) => void)(2)
  expect(c.weapons?.find((attack) => attack.name === 'Fist')).toMatchObject({ potency: 0, striking: 0, runes: [] })
  expect(c.handwraps).toEqual({ potency: 2, striking: 1, runes: [] })
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={save} />)
  expect(markup).not.toContain(`inherited from ${HANDWRAPS.name}`)
  expect(markup).toContain('Fist attack +14: show breakdown')
  expect(markup).toContain('Damage 2d4 B')
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
  expect(markup).toContain('Claws attack +14: show breakdown')
  expect(markup).toContain('Damage 2d6 S + 1d6 force, Wounding')
  expect(markup).not.toContain('<strong>Jaws</strong>')
  const jawsMarkup = renderToStaticMarkup(<WeaponList c={{ ...c, animalFeature: 'Jaws' }} entries={[]} save={() => {}} />)
  expect(jawsMarkup).toContain('Jaws attack +14: show breakdown')
  expect(jawsMarkup).toContain('Damage 2d8 P + 1d6 force, Wounding')
  expect(markup).not.toContain('Claws (Animal Feature)')
  expect(markup).not.toContain('Jaws (Animal Feature)')
  expect(markup).not.toContain('aria-label="Remove Claws"')
  expect(markup).not.toContain('aria-label="Remove Jaws"')
  expect(markup).not.toContain('aria-label="Remove Wounding rune"')
  expect(renderToStaticMarkup(<HandwrapsGear c={c} entries={[]} save={() => {}} />).match(/aria-label="Remove Wounding rune"/g)).toHaveLength(1)
  expect(markup).not.toContain('Granted by Living Weapon')
  expect(markup).toContain(`title="Inherited from ${HANDWRAPS.name}"`)
})

it('copies a chosen carried weapon onto Animal Feature attacks instead of handwraps and records critical bleed', () => {
  let c: Character = { ...character([
    { name: 'Advanced Warden', type: 'Class Feat', level: 4, choice: 'Animal Feature' },
    { name: 'Animal Strength', type: 'Class Feat', level: 6, slot: 'class:6:0' },
  ]), activeSpells: ['Animal Feature'], handwraps: { potency: 3, striking: 3, runes: ['Flaming'] },
    weapons: [{ id: 'w', name: 'Longsword', potency: 2, striking: 1, runes: ['Wounding', 'Shifting'] }] }
  const tree = () => WeaponList({ c, entries: [weapon], save: patch => { c = { ...c, ...patch } } })
  const control = findElement(tree(), element => element.props['aria-label'] === 'Animal Strength runes: Claws')!
  ;(control.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'w' } })
  c = JSON.parse(JSON.stringify(c))
  const claws = ownedWeapons(c, []).find(attack => attack.name === 'Claws (Animal Feature)')!
  expect(effectiveWeapon(c, [weapon], claws)).toMatchObject({ potency: 2, striking: 1, runes: ['Wounding'] })
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('Critical hit: 1d6 persistent bleed (Animal Strength).')
  expect(markup).toContain('title="Animal Strength: Longsword"')
  const withoutFeat = { ...c, feats: c.feats.filter(feat => feat.name !== 'Animal Strength') }
  expect(effectiveWeapon(withoutFeat, [weapon], claws)).toMatchObject({ potency: 3, striking: 3, runes: ['Flaming'] })
  expect(renderToStaticMarkup(<WeaponList c={withoutFeat} entries={[weapon]} save={() => {}} />))
    .not.toContain('Critical hit: 1d6 persistent bleed')
  c = { ...c, weapons: [] }
  expect(effectiveWeapon(c, [weapon], claws)).toMatchObject({ potency: 3, striking: 3, runes: ['Flaming'] })
  expect(renderToStaticMarkup(tree())).toContain('Saved Animal Strength weapon unavailable')
})

it('groups identical transferable Animal Strength runes despite Living Weapon Shifting, preserving distinct fundamentals and saved sources', () => {
  const bow = { ...weapon, id: 'bow', name: 'Composite Longbow', data: { weapon_category: 'Martial', damage: '1d8 piercing', range: 100 } }
  const spear = { ...weapon, id: 'spear', name: "Dancer's Spear" }
  const runes = ['Flaming', 'Frost']
  let c: Character = { ...character([
    { name: 'Advanced Warden', type: 'Class Feat', level: 4, choice: 'Animal Feature' },
    { name: 'Animal Strength', type: 'Class Feat', level: 6 },
    { name: 'Living Weapon', type: 'Class Feat', level: 1 },
  ]), activeSpells: ['Animal Feature'], weapons: [
    { id: 'bow', name: bow.name, potency: 2, striking: 1, runes },
    { id: 'spear', name: spear.name, potency: 2, striking: 1, runes: [...runes].reverse(), livingWeapon: true },
    { id: 'potency', name: 'Higher Potency', potency: 3, striking: 1, runes },
    { id: 'striking', name: 'Higher Striking', potency: 2, striking: 2, runes },
    { id: 'property', name: 'Other Properties', potency: 2, striking: 1, runes: ['Shock'] },
  ] }
  const claws = ownedWeapons(c, [bow, spear]).find(attack => attack.name === 'Claws (Animal Feature)')!
  c = { ...c, animalStrengthWeapons: { [claws.id]: 'spear' } }
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const control = () => findElement(WeaponList({ c, entries: [bow, spear], save }),
    element => element.props['aria-label'] === 'Animal Strength runes: Claws')!
  const markup = renderToStaticMarkup(control())
  expect([...markup.matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map(match => match[1])).toEqual([
    'Composite Longbow', 'Higher Potency', 'Higher Striking', 'No runes', 'Other Properties',
  ])
  expect(markup).toContain('>Composite Longbow</option>')
  expect(markup).not.toContain('value="spear"')
  for (const id of ['potency', 'striking', 'property']) expect(markup).toContain(`value="${id}"`)
  expect(control().props.value).toBe('bow')
  expect(save).not.toHaveBeenCalled()
  expect(c.animalStrengthWeapons?.[claws.id]).toBe('spear')
  expect(effectiveWeapon(c, [bow, spear], claws)).toMatchObject({ potency: 2, striking: 1, runes: ['Frost', 'Flaming'] })
  c = JSON.parse(JSON.stringify(c))
  c = { ...c, weapons: c.weapons?.filter(source => source.id !== 'bow') }
  expect(control().props.value).toBe('spear')
  expect(renderToStaticMarkup(control())).toContain('value="spear"')
  ;(control().props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'potency' } })
  expect(effectiveWeapon(c, [bow, spear], claws).potency).toBe(3)
})

it('groups Animal Strength rune sources separately for slashing Claws and piercing Jaws', () => {
  const c: Character = { ...character([{ name: 'Animal Strength', type: 'Class Feat', level: 6 }]), weapons: [
    { id: 'vorpal', name: weapon.name, potency: 2, striking: 1, runes: ['Flaming', 'Vorpal'] },
    { id: 'plain', name: weapon.name, potency: 2, striking: 1, runes: ['Flaming'] },
  ] }
  const target: OwnedWeapon = { id: 'claws', name: 'Claws (Animal Feature)', potency: 0, striking: 0, runes: [] }
  expect(animalStrengthRuneSources(c, [weapon], target)).toHaveLength(2)
  expect(animalStrengthRuneSources(c, [weapon], { ...target, id: 'jaws', name: 'Jaws (Animal Feature)' }))
    .toMatchObject([{ weapon: { id: 'vorpal' }, ids: ['vorpal', 'plain'] }])
})

const handwrapSourceCases: [Character['handwraps'], string][] = [
  [undefined, 'No runes'],
  [{ potency: 1, striking: 1, runes: [] }, HANDWRAPS.name],
  [{ kind: 'hardlight', grade: 'Commercial', potency: 0, striking: 0, runes: [] }, HARDLIGHT_HANDWRAPS.name],
]

it.each(handwrapSourceCases)('names the default Animal Strength source from equipped handwraps (%j)', (handwraps, label) => {
  const c: Character = { ...character([
    { name: 'Advanced Warden', type: 'Class Feat', level: 4, choice: 'Animal Feature' },
    { name: 'Animal Strength', type: 'Class Feat', level: 6 },
  ]), activeSpells: ['Animal Feature'], handwraps }
  const tree = WeaponList({ c, entries: [weapon], save: () => {} })
  const control = findElement(tree, element => element.props['aria-label'] === 'Animal Strength runes: Claws')!
  expect(renderToStaticMarkup(control)).toContain(`>${label}</option>`)
  const markup = renderToStaticMarkup(tree)
  expect(markup).not.toContain('>Normal unarmed runes</option>')
  expect(markup).not.toContain('<label>Animal Strength runes')
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

it('keeps saved hardlight runes inactive and provides grade-based upgrade slots', () => {
  let c: Character = { ...character([]), systems: ['pf2e', 'sf2e'], weapons: [] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => HandwrapsGear({ c, entries: [], save })
  const add = findElement(tree(), (element) => element.type === 'button'
    && Children.toArray(element.props.children as ReactNode).join('') === `Add ${HARDLIGHT_HANDWRAPS.name}`)
  if (!add) throw new Error('Missing Add Hardlight Handwraps button')
  ;(add.props.onClick as () => void)()
  expect(c.handwraps).toMatchObject({ kind: 'hardlight', grade: 'Superior', potency: 2, striking: 1 })
  const selectGrade = (value: string) => {
    const grade = findElement(tree(), (element) => element.props['aria-label'] === 'Hardlight handwraps grade')
    if (!grade) throw new Error('Missing Hardlight grade selector')
    ;(grade.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } })
  }
  selectGrade('Advanced')
  expect(c.handwraps).toMatchObject({ kind: 'hardlight', grade: 'Superior', potency: 2, striking: 1 })
  c = { ...c, handwraps: { ...c.handwraps!, runes: ['Flaming', 'Impactful'] } }
  const attack = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={save} />)
  expect(attack).not.toContain('inherited from Hardlight Handwraps')
  expect(attack).toContain('Damage 2d4 B')
  expect(attack).not.toContain('aria-label="Remove Flaming rune"')
  expect(attack).not.toContain('aria-label="Add property rune"')
  expect(renderToStaticMarkup(<HandwrapsGear c={c} entries={[]} save={save} />)).toContain('Saved runes are inactive')
  expect(renderToStaticMarkup(<HandwrapsGear c={c} entries={[]} save={save} />)).toContain('Upgrade slots: 0/2')
  selectGrade('Commercial')
  expect(c.handwraps).toMatchObject({ grade: 'Superior', runes: ['Flaming', 'Impactful'] })
  const remove = findElement(tree(), (element) => element.props['aria-label'] === 'Remove Hardlight Handwraps')
  if (!remove) throw new Error('Missing Hardlight removal')
  ;(remove.props.onClick as () => void)()
  expect(c.handwraps).toBeUndefined()
})

it('installs compatible weapon upgrades within capacity without changing saved runes', () => {
  const laser: ContentEntry = { ...weapon, name: 'Laser', systems: ['sf2e'], traits: ['Tech'],
    data: { hands: 1, weapon_type: 'Ranged', damage: '1d6 F', upgrade_slots: 1, weapon_ammunition: '10 charges' } }
  const upgrade = (id: string, usage: string): ContentEntry => ({ ...shifting, id, name: id, systems: ['sf2e'],
    data: { item_subcategory: 'Weapon Upgrades', usage, url: id } })
  const sight = upgrade('Sight', 'installed in a weapon (sight)')
  const bipod = upgrade('Bipod', 'installed in a weapon with the kickback trait')
  let c: Character = { ...character([]), systems: ['sf2e'], weapons: [
    { id: 'laser', name: laser.name, potency: 1, striking: 0, runes: ['Flaming'] },
  ] }
  const entries = [laser, sight, bipod]
  const tree = () => WeaponList({ c, entries, save: patch => { c = { ...c, ...patch } } })
  const component = findElement(tree(), element => typeof element.type === 'function' && element.type.name === 'WeaponUpgrades')!
  const content = (component.type as (props: typeof component.props) => ReactNode)(component.props)
  const select = findElement(content, element => element.props['aria-label'] === 'Add weapon upgrade')!
  expect(renderToStaticMarkup(select)).toContain('Sight')
  expect(renderToStaticMarkup(select)).not.toContain('Bipod')
  ;(select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Sight' } })
  expect(c.weapons?.[0]).toMatchObject({ upgrades: ['Sight'], runes: ['Flaming'] })
  const full = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} />)
  expect(full).toContain('Upgrade slots: 1/1')
  expect(full).not.toContain('aria-label="Add weapon upgrade"')
})
