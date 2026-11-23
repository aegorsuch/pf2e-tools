import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, type ComponentProps, type ReactNode } from 'react'
import { expect, it } from 'vitest'
import { mapAonHit } from './aon'
import { activeBattleForm, armorClass, armorClassBreakdown, armorEntry, armorSaveBonus, effectiveArmor, gearPickerEntries, movementSpeeds, ownedArmors, ownedWeapons, perceptionItemBonus, resistances, savingThrowBreakdown, shieldAcBonus, shieldEntry, shieldMaterialOptions, shieldStats, speedBonuses, spellActiveChange, temporaryHpGrant, weaponAttack, wornArmor } from './builder'
import { ArmorList, WeaponList } from './GearSection'
import { ANCESTRAL_AVATAR } from './battleForms'
import { makeNamedArmorEntries, makeNamedShieldEntry, namedArmorAbilities, SCALE_OF_IGROON_FORTRESS } from './namedArmor'
import { specificMagicItemName } from './equipmentGroups'
import { NamedArmorAbilities } from './NamedArmorAbilities'
import { SkillsSection } from './SkillsSection'
import type { Character, ContentEntry, OwnedArmor, OwnedShield } from './types'

const item = (name: string, markdown: string, extra: Record<string, unknown> = {}) => mapAonHit({
  _id: name, _source: { category: 'equipment', name, markdown, level: 20, trait: ['Invested', 'Artifact'], ...extra },
}, 'pf2e')!
const leather = mapAonHit({ _id: 'armor-41', _source: { category: 'armor', name: 'Leather Armor',
  ac: 1, dex_cap: 4, strength: 0, armor_category: 'Light', armor_group: 'Leather', bulk: 1, check_penalty: -1 } }, 'pf2e')!
const hide = mapAonHit({ _id: 'armor-42', _source: { category: 'armor', name: 'Hide Armor',
  ac: 3, dex_cap: 2, strength: 2, armor_category: 'Medium', armor_group: 'Composite', bulk: 2, check_penalty: -2, speed_penalty: -5 } }, 'pf2e')!
const chain = mapAonHit({ _id: 'armor-43', _source: { category: 'armor', name: 'Chain Shirt',
  ac: 2, dex_cap: 3, strength: 1, armor_category: 'Light', armor_group: 'Chain', bulk: 1,
  check_penalty: -1, trait: ['Flexible', 'Noisy'] } }, 'pf2e')!
const elven = item('Elven Chain', "Elven chain is a [chain shirt](/Armor.aspx?ID=6) made of dawnsilver. It has no check penalty. Unlike other chain shirts, elven chain doesn’t have the noisy trait.")
const embrace = item('Ancestral Embrace', [
  '**Base Armor** [Leather Armor](/Armor.aspx?ID=4)', '---',
  'This brightly colored _+4 [major resilient](/Equipment.aspx?ID=279) [leather armor](/Armor.aspx?ID=4)_ grants negative resistance 25 when invested.',
  '**Activate** <actions string="Free Action" /> envision; **Frequency** once per day; **Effect** You gain an additional use of an ancestry feat.',
  '**Activate** <actions string="Free Action" /> envision; **Effect** Reduce legend lore casting time to 1 hour.',
  '**Activate** <actions string="Two Actions" /> command, Interact; **Frequency** once per day; **Effect** The armor casts avatar; Speed 70 feet.',
  '**Destruction** Six generations.',
].join('\n\n'), { resistances: 'negative=25', url: '/Equipment.aspx?ID=1528' })
const hideEmbraceName = 'Ancestral Embrace Hide Armor'
const bane = item("Slithermaw's Bane", [
  '**Base Armor** [Chain Shirt](/Armor.aspx?ID=6)', '---',
  'This suit of _[+2 greater resilient ](/Equipment.aspx?ID=2804) [elven chain](/Equipment.aspx?ID=2801)_ grants poison resistance 10.',
  '**Activate—Calistria’s Sting** <actions string="Reaction" /> (concentrate, divine) **Frequency** once per day; **Trigger** A creature grapples you; **Effect** 7d6 persistent poison damage; DC 34 basic Fortitude save.',
  '**Activate—Terrain Adaptation** 10 minutes (concentrate, divine) **Frequency** once per day; **Effect** You ignore non-magical difficult terrain in the chosen environment.',
].join('\n\n'), { resistances: 'poison=10', bulk: 0.1 })
const artifact = item("Slithermaw's Bane (Artifact)", [
  '**Usage** worn armor', '---',
  '**Perception** +34; precise low-light vision and hearing within 30 feet', '**Will** +34', '---',
  '_Slithermaw’s Bane_ is a suit of _[+3 major resilient ](/Equipment.aspx?ID=2804) [greater fortification](/Equipment.aspx?ID=2789) high-grade [elven chain](/Equipment.aspx?ID=2801)_ that grants poison resistance 15.',
  '**Activate—Calistria’s Sting** <actions string="Reaction" /> (concentrate, poison) **Frequency** once per day; **Effect** 7d6 persistent poison damage.',
  '**Activate—Purge Toxins** <actions string="Two Actions" /> (concentrate) **Frequency** once per minute; **Effect** Counteract rank 9th, +25 modifier (+30 against fiend sources).',
  '**Activate—Adaptation** <actions string="Two Actions" /> (concentrate) **Frequency** once per hour; **Effect** +2 circumstance bonus to saves against environmental hazards from the chosen terrain.',
].join('\n\n'), { resistances: 'poison=15', bulk: 0.1 })
const fortification = item('Fortification', 'This property thickens the armor, increasing its Bulk by 1 and the Strength modifier require to reduce its penalties by 1.',
  { item_subcategory: 'Armor Property Runes' })
const greaterFortification = { ...fortification, id: 'greater-fortification', name: 'Fortification (Greater)', level: 18 }
const scale = item('Scale of Igroon', [
  '---',
  'A _scale of Igroon_ (Hardness 20, HP 160, BT 80) recovers 4 Hit Points at the start of its wielder’s turn. Shield Block can block acid, cold, electricity, fire, force, sonic, and physical damage.',
  '**Activate** <actions string="Single Action" /> (manipulate) **Requirements** Bright or dim light; **Effect** +4 item bonus to Stealth to Hide and Sneak until your next turn; ends on Shield Block or another activation.',
  '**Activate** <actions string="Single Action" /> (manipulate) **Requirements** Bright light; **Effect** DC 42 Fortitude, blinded.',
  '**Activate** <actions string="Free Action" /> (manipulate) **Trigger** Shield Block prevents energy damage from a line, ray, or direct attack; **Effect** Reflect the energy.',
  '**Destruction** Stomped in absolute darkness.',
].join('\n\n'), { usage: 'held in 1 hand', url: '/Equipment.aspx?ID=2365' })
const fortressShield: ContentEntry = { id: 'fortress-shield', name: 'Fortress Shield', kind: 'shield', source: 'official',
  systems: ['pf2e'], level: 0, traits: [], description: '', data: { ac: 3, bulk: 5, hands: '2', speed_penalty: -10 },
  effects: [], updatedAt: 0 }
const mask = item('Shadowed Scale, the Jungle Secret', [
  '---',
  'When you wear the mask, you are always concealed while in a jungle. It can replace a Magaambyan mask.',
  '**Activate** <actions string="Single Action" /> envision; **Requirements** Your last action was a melee Strike that killed a living creature or destroyed an undead creature; **Effect** Decompose the body into soil.',
  '**Activate** <actions string="Single Action" /> Interact; **Frequency** once per hour; **Requirements** Adjacent to the body of a creature you killed that decomposed into soil; **Effect** Cast summon plant or fungus at half the slain creature’s level, rounded up.',
  '**Destruction** Stomped by the progenitor of all mokele-mbembes.',
].join('\n\n'), { usage: 'worn mask', url: '/Equipment.aspx?ID=1530' })
const entries = [leather, hide, chain, elven, embrace, bane, artifact, fortification, greaterFortification, scale, fortressShield, mask]
const character: Character = {
  id: 'armor-test', systems: ['pf2e'], name: 'Armor test', level: 20,
  abilities: { str: 14, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const owned = (name: string): OwnedArmor => ({ id: name, name, potency: 0, resilient: 0, runes: [], worn: true })
const shield: OwnedShield = { id: 'scale', name: scale.name, hardness: 0, hp: 0, raised: false, damage: 8 }

it('derives named bastion plate profiles and fixed runes even without rune catalog records', () => {
  const found = makeNamedArmorEntries(bastionEntries, [])
  expect(found.map(entry => entry.name)).toEqual([
    'Highhelm Stronghold Bastion Plate', 'Bastion Plate of the Inheritor', 'Immortal Bastion Plate',
  ])
  expect(found.map(entry => specificMagicItemName(entry))).toEqual([
    'Highhelm Stronghold Bastion Plate', 'Bastion Plate of the Inheritor', 'Immortal Bastion Plate',
  ])
  expect(specificMagicItemName(found[1], found[1].name, true)).toBe('Bastion Plate of the Inheritor')
  expect(found.map(entry => [entry.data.named_armor_potency, entry.data.named_armor_resilient, entry.data.named_armor_runes,
    entry.data.bulk, entry.data.strength])).toEqual([
    [2, 1, 'Fortification', 5, 5], [2, 1, '', 5, 4], [3, 2, 'Fortification (Greater)', 5, 5],
  ])
  expect(gearPickerEntries(bastionEntries, 'armor').map(entry => entry.name)).toContain('Immortal Bastion Plate')
})

const bastionPlate: ContentEntry = { ...hide, id: 'bastion', name: 'Bastion Plate', traits: ['Bulwark', 'Entrench'],
  data: { ...hide.data, ac: 6, dex_cap: 0, strength: 4, armor_category: 'Heavy', armor_group: 'Plate', bulk: 5, speed_penalty: -10 } }
const bastionItem = (name: string, enhancement: string, actions: string[]) => item(name, [
  '**Base Armor** [Bastion Plate](/Armor.aspx?ID=17)', '---',
  `This is +${enhancement} bastion plate.`,
  ...actions.map(action => `**Activate** <actions string="${action}" /> (concentrate) **Effect** Use the armor.`),
].join('\n\n'), { bulk: 5 })
const bastionEntries: ContentEntry[] = [
  bastionPlate,
  bastionItem('Highhelm Stronghold Plate', '2 resilient fortification', ['Three Actions']),
  bastionItem('Bastion of the Inheritor', '2 resilient', ['Single Action']),
  bastionItem('Immortal Bastion', '3 greater resilient greater fortification', ['Reaction', 'Reaction']),
]
const bastionFighter: ContentEntry = { ...hide, id: 'fighter', kind: 'class', name: 'Fighter',
  data: { heavy_armor_proficiency: 'trained', unarmored_proficiency: 'trained' } }
const plateGroup: ContentEntry = { ...hide, id: 'plate-group', kind: 'armorGroup', name: 'Plate', data: {}, description: 'Plate armor.' }
const armorExpertise: ContentEntry = { ...hide, id: 'armor-expertise', kind: 'classFeature', name: 'Armor Expertise',
  level: 1, data: { class: 'Fighter' }, description: 'Gain armor specialization.' }

it('scales Immortal Bastion fundamentals and grants Orichalcum without changing saved armor', () => {
  const armor = { ...owned('Immortal Bastion Plate'), potency: 3, resilient: 2, material: 'Duskwood' as const }
  const original = JSON.stringify(armor)
  for (const [level, potency, resilient] of [[1, 0, 0], [4, 0, 0], [5, 1, 0], [7, 1, 0], [8, 1, 1],
    [10, 1, 1], [11, 2, 1], [13, 2, 1], [14, 2, 2], [17, 2, 2], [18, 3, 2], [19, 3, 2], [20, 3, 3]]) {
    const c = { ...character, className: 'Fighter', level, armors: [armor] }
    const effective = effectiveArmor(c, bastionEntries, armor)
    expect(effective).toMatchObject({ potency, resilient, material: 'Orichalcum', runes: ['Fortification (Greater)'] })
    expect(armorSaveBonus(c, bastionEntries)).toBe(resilient)
    const html = renderToStaticMarkup(<ArmorList c={c} entries={bastionEntries} save={() => {}} part="armor" />)
    expect(html).toContain('Material: Orichalcum')
    if (potency) expect(html).toContain(`+${potency} Potency`)
    if (resilient) expect(html).toContain(['', 'Resilient', 'Greater Resilient', 'Major Resilient'][resilient])
    expect(html).not.toContain('aria-label="Potency"')
    expect(html).not.toContain('aria-label="Resilient"')
  }
  expect(JSON.stringify(armor)).toBe(original)
})

it('scales Highhelm fundamentals and property runes with fixed Keep Stone', () => {
  const armor = { ...owned('Highhelm Stronghold Bastion Plate'), potency: 3, resilient: 3,
    material: 'Duskwood' as const, runes: ['Moonweave (Major)', 'Fortification (Greater)', 'Shadow'] }
  const original = JSON.stringify(armor)
  const cases: [number, number, number, string[]][] = [
    [1, 0, 0, []], [5, 1, 0, ['Moonweave']], [7, 1, 0, ['Moonweave', 'Sunweave']],
    [8, 1, 1, ['Moonweave', 'Sunweave']], [11, 2, 1, ['Moonweave', 'Sunweave (Greater)']],
    [12, 2, 1, ['Moonweave', 'Sunweave (Greater)', 'Fortification']],
    [13, 2, 1, ['Moonweave (Greater)', 'Sunweave (Greater)', 'Fortification']],
    [14, 2, 2, ['Moonweave (Greater)', 'Sunweave (Greater)', 'Fortification']],
    [17, 2, 2, ['Moonweave (Major)', 'Sunweave (Greater)', 'Fortification']],
    [18, 3, 2, ['Moonweave (Major)', 'Sunweave (Major)', 'Fortification (Greater)']],
    [20, 3, 3, ['Moonweave (Major)', 'Sunweave (Major)', 'Fortification (Greater)']],
  ]
  for (const [level, potency, resilient, runes] of cases) {
    const c = { ...character, level, armors: [armor] }
    expect(effectiveArmor(c, bastionEntries, armor)).toMatchObject({
      potency, resilient, material: 'Keep Stone', runes: [...(potency > runes.length ? ['Shadow'] : []), ...runes],
    })
    expect(armorEntry(c, bastionEntries, armor.name)?.data.strength).toBe(level >= 12 ? 5 : 4)
    const html = renderToStaticMarkup(<ArmorList c={c} entries={bastionEntries} save={() => {}} part="armor" />)
    expect(html).toContain('Material:</span>')
    expect(html).toContain('>Keep Stone</button>')
    expect(html).not.toContain('aria-label="Potency"')
    expect(html).not.toContain('aria-label="Resilient"')
    for (const rune of runes) {
      expect(html).toContain(rune)
      expect(html).not.toContain(`aria-label="Remove ${rune} rune"`)
    }
  }
  expect(JSON.stringify(armor)).toBe(original)
})

it('shows scaled armor runes in descriptions and exposes Keep Stone armor details', () => {
  const keepStone = item('Keep Stone Armor', 'Keep stone armor protects against spells.', { item_category: 'Armor' })
  const data = [...bastionEntries, keepStone]
  for (const [name, level, description] of [
    ['Highhelm Stronghold Bastion Plate', 5, '+1 moonweave bastion plate'],
    ['Highhelm Stronghold Bastion Plate', 11, '+2 resilient moonweave greater sunweave bastion plate'],
    ['Highhelm Stronghold Bastion Plate', 18, '+3 greater resilient major moonweave major sunweave greater fortification bastion plate'],
    ['Highhelm Stronghold Bastion Plate', 20, '+3 major resilient major moonweave major sunweave greater fortification bastion plate'],
    ['Bastion Plate of the Inheritor', 1, 'This is bastion plate.'],
    ['Bastion Plate of the Inheritor', 20, '+3 major resilient major moonweave major sunweave greater fortification greater advancing bastion plate'],
    ['Immortal Bastion Plate', 20, '+3 major resilient greater fortification bastion plate'],
  ] as const) {
    const c = { ...character, level, armors: [owned(name)] }
    const html = renderToStaticMarkup(<ArmorList c={c} entries={data} save={() => {}} part="armor" />)
    expect(html).toContain(description)
    if (name.startsWith('Highhelm')) {
      expect(html).toContain('>Keep Stone</button>')
      expect(html).toContain('Keep stone armor protects against spells.')
      expect(html).not.toContain('aria-label="Remove Keep Stone material"')
    }
  }
  expect(bastionEntries[1].description).toContain('+2 resilient fortification bastion plate')
})

it('uses Orichalcum to allow one additional Immortal Bastion property rune', () => {
  const armor = { ...owned('Immortal Bastion Plate'), runes: ['Shadow', 'Slick'] }
  const render = (runes: string[]) => renderToStaticMarkup(<ArmorList c={{ ...character, level: 18, armors: [{ ...armor, runes }] }}
    entries={bastionEntries} save={() => {}} part="armor" />)
  expect(render(armor.runes)).toContain('aria-label="Add property rune"')
  expect(render([...armor.runes, 'Glamered'])).not.toContain('aria-label="Add property rune"')
})

it('scales Inheritor fundamentals and property runes at each progression boundary', () => {
  const armor = { ...owned('Bastion Plate of the Inheritor'), potency: 3, resilient: 3,
    material: 'Duskwood' as const, runes: ['Moonweave (Major)', 'Fortification (Greater)', 'Shadow'] }
  const original = JSON.stringify(armor)
  const cases: [number, number, number, string[]][] = [
    [1, 0, 0, []], [4, 0, 0, []], [5, 1, 0, ['Moonweave']],
    [7, 1, 0, ['Moonweave', 'Sunweave']], [8, 1, 1, ['Moonweave', 'Sunweave']],
    [9, 1, 1, ['Moonweave', 'Sunweave', 'Advancing']],
    [11, 2, 1, ['Moonweave', 'Sunweave (Greater)', 'Advancing']],
    [12, 2, 1, ['Moonweave', 'Sunweave (Greater)', 'Fortification', 'Advancing']],
    [13, 2, 1, ['Moonweave (Greater)', 'Sunweave (Greater)', 'Fortification', 'Advancing']],
    [14, 2, 2, ['Moonweave (Greater)', 'Sunweave (Greater)', 'Fortification', 'Advancing']],
    [16, 2, 2, ['Moonweave (Greater)', 'Sunweave (Greater)', 'Fortification', 'Advancing (Greater)']],
    [17, 2, 2, ['Moonweave (Major)', 'Sunweave (Greater)', 'Fortification', 'Advancing (Greater)']],
    [18, 3, 2, ['Moonweave (Major)', 'Sunweave (Major)', 'Fortification (Greater)', 'Advancing (Greater)']],
    [20, 3, 3, ['Moonweave (Major)', 'Sunweave (Major)', 'Fortification (Greater)', 'Advancing (Greater)']],
  ]
  for (const [level, potency, resilient, automatic] of cases) {
    const c = { ...character, level, armors: [armor] }
    const effective = effectiveArmor(c, bastionEntries, armor)
    const available = Math.max(0, (potency ? potency + 1 : 0) - automatic.length)
    expect(effective).toMatchObject({ potency, resilient, material: 'Orichalcum',
      runes: [...(available ? ['Shadow'] : []), ...automatic] })
    expect(armorEntry(c, bastionEntries, armor.name)?.data).toMatchObject({
      bulk: level >= 12 ? 6 : 5, strength: level >= 12 ? 5 : 4,
    })
    expect(armorSaveBonus(c, bastionEntries)).toBe(resilient)
    const html = renderToStaticMarkup(<ArmorList c={c} entries={bastionEntries} save={() => {}} part="armor" />)
    expect(html).toContain('Material: Orichalcum')
    expect(html).not.toContain('aria-label="Potency"')
    expect(html).not.toContain('aria-label="Resilient"')
    for (const rune of automatic) {
      expect(html).toContain(rune)
      expect(html).not.toContain(`aria-label="Remove ${rune} rune"`)
    }
    if (level >= 12) expect(html).not.toContain('aria-label="Add property rune"')
  }
  expect(JSON.stringify(armor)).toBe(original)
})

it('preserves dormant Inheritor runes and fundamentals when changing armor settings', () => {
  const armor = { ...owned('Bastion Plate of the Inheritor'), potency: 2, resilient: 1,
    material: 'Duskwood' as const, runes: ['Moonweave (Major)', 'Shadow', 'Slick'] }
  const c = { ...character, level: 20, armors: [armor] }
  let patch: Partial<Character> = {}
  const tree = ArmorList({ c, entries: bastionEntries, save: change => { patch = change }, part: 'armor' })
  const find = (node: ReactNode): ((event: { target: { checked: boolean } }) => void) | undefined => {
    let result: ((event: { target: { checked: boolean } }) => void) | undefined
    Children.forEach(node, child => {
      if (result || !isValidElement<{ children?: ReactNode; 'aria-label'?: string; onChange?: typeof result }>(child)) return
      if (child.props['aria-label'] === `Worn ${armor.name}`) result = child.props.onChange
      else result = find(child.props.children)
    })
    return result
  }
  find(tree)!({ target: { checked: false } })
  expect(patch.armors?.[0]).toMatchObject({ potency: 2, resilient: 1, material: 'Duskwood',
    runes: expect.arrayContaining(armor.runes) })
  expect(effectiveArmor({ ...c, level: 5 }, bastionEntries, patch.armors![0]).runes).toEqual(['Shadow', 'Moonweave'])
})

it('applies Highhelm piercing specialization only while armor benefits apply', () => {
  const data = [...bastionEntries, bastionFighter, plateGroup, armorExpertise]
  const armor = owned('Highhelm Stronghold Bastion Plate')
  const c = { ...character, className: 'Fighter', armors: [armor] }
  expect(resistances(c, data)).toEqual(expect.arrayContaining([
    expect.objectContaining({ damage: 'Slashing', value: 5 }),
    expect.objectContaining({ damage: 'Piercing', value: 5, source: armor.name }),
  ]))
  const wall = { ...c, armors: [{ ...armor, strongholdWallActive: true }] }
  expect(wornArmor(wall, data)).toBeUndefined()
  expect(resistances(wall, data).some(resistance => resistance.source === armor.name)).toBe(false)
  expect(armorClass(wall, data)).toBeLessThan(armorClass(c, data))
  expect(resistances({ ...c, className: undefined }, data).some(resistance => resistance.source === armor.name)).toBe(false)
})

it('calculates conditional melee AC without stacking circumstance bonuses', () => {
  const data = [...bastionEntries, bastionFighter]
  const armor = { ...owned('Immortal Bastion Plate'), entrenchMeleeActive: true }
  const c = { ...character, className: 'Fighter', armors: [armor], shield: { id: 'shield', name: 'Shield', hardness: 5,
    hp: 20, damage: 0, raised: true } }
  const ac = armorClassBreakdown(c, data)
  expect(ac.notes).toContain(`Entrench Melee: AC ${ac.total} against melee attacks (+2 circumstance; circumstance bonuses do not stack).`)
  expect(armorClassBreakdown({ ...c, armors: [{ ...armor, worn: false }] }, data).notes?.join(' ')).not.toContain('Entrench Melee')
})

it('shows Inheritor Diplomacy only with its white cloak and grants melee protection when red', () => {
  const data = [...bastionEntries, bastionFighter]
  const armor = owned('Bastion Plate of the Inheritor')
  const c = { ...character, className: 'Fighter', armors: [armor] }
  const render = (value: Character) => renderToStaticMarkup(<SkillsSection c={value} entries={data} save={() => {}} />)
  expect(render(c)).toContain('to Make an Impression against targets without enmity toward Iomedae')
  const red = { ...c, armors: [{ ...armor, inheritorCloakRed: true }] }
  expect(render(red)).not.toContain('to Make an Impression against targets without enmity toward Iomedae')
  expect(armorClassBreakdown(red, data).notes?.join(' ')).toContain('against melee attacks (+1 circumstance')
  expect(render({ ...c, armors: [{ ...armor, worn: false }] })).not.toContain('to Make an Impression against targets')
})

it('tracks armor activations independently and restores armor when the wall is dismissed', () => {
  const data = [...bastionEntries, bastionFighter]
  let c: Character = { ...character, className: 'Fighter', armors: [owned('Highhelm Stronghold Bastion Plate')] }
  const props = () => {
    let result: ComponentProps<typeof NamedArmorAbilities> | undefined
    const visit = (node: ReactNode) => Children.forEach(node, child => {
      if (!isValidElement<{ children?: ReactNode }>(child)) return
      if (child.type === NamedArmorAbilities) result = child.props as ComponentProps<typeof NamedArmorAbilities>
      else visit(child.props.children)
    })
    visit(ArmorList({ c, entries: data, save: patch => { c = { ...c, ...patch } }, part: 'armor' }))
    return result!
  }
  props().activations!['Activation 1'].toggle()
  expect(c.armors?.[0]).toMatchObject({ worn: false, strongholdWallActive: true, strongholdWallUsed: true })
  expect(wornArmor(c, data)).toBeUndefined()
  props().activations!['Activation 1'].toggle()
  expect(c.armors?.[0]).toMatchObject({ worn: true, strongholdWallActive: false, strongholdWallUsed: true })
  expect(props().activations!['Activation 1'].disabled).toBe(true)

  c = { ...c, armors: [owned('Immortal Bastion Plate')] }
  props().activations!['Activation 1'].toggle()
  expect(props().activations!['Activation 2'].disabled).toBe(false)
  props().activations!['Activation 2'].toggle()
  expect(c.armors?.[0]).toMatchObject({ immortalSurvivalUsed: true, immortalConditionUsed: true })
})

it('shows active Immortal Bastion temporary HP beside HP without stacking grants', () => {
  const data = [...bastionEntries, bastionFighter]
  const armor = { ...owned('Immortal Bastion Plate'), entrenchMeleeActive: true }
  const c = { ...character, className: 'Fighter', armors: [armor] }
  const render = (value: Character) => renderToStaticMarkup(<SkillsSection c={value} entries={data} save={() => {}} part="defense" />)
  expect(temporaryHpGrant(c, data)?.value).toBe(10)
  expect(render(c)).toContain('Temporary HP granted</small><b>10')
  const survival = { ...c, armors: [{ ...armor, immortalSurvivalActive: true }] }
  expect(temporaryHpGrant(survival, data)?.value).toBe(100)
  expect(render(survival)).toContain('Temporary HP granted</small><b>100')
  expect(temporaryHpGrant({ ...survival, armors: [{ ...armor, worn: false, immortalSurvivalActive: true }] }, data)).toBeUndefined()
  expect(temporaryHpGrant({ ...c, armors: [{ ...armor, entrenchMeleeActive: false }] }, data)).toBeUndefined()
})

it('gives Ancestral Embrace built-in major weave runes and its worn Sunweave Perception bonus', () => {
  const c = { ...character, armors: [owned(hideEmbraceName)] }
  expect(effectiveArmor(c, entries, c.armors[0]).runes).toEqual(['Moonweave (Major)', 'Sunweave (Major)', 'Fortification (Greater)'])
  expect(perceptionItemBonus(c, entries)).toBe(3)
  expect(perceptionItemBonus({ ...c, armors: [{ ...c.armors[0], worn: false }] }, entries)).toBe(0)
  const html = renderToStaticMarkup(<ArmorList c={c} entries={entries} save={() => {}} part="armor" />)
  expect(html).toContain('>Ancestral Embrace Hide Armor</button>')
  expect(html).toContain('major resilient hide armor grants negative resistance 25')
  expect(html).not.toContain('<summary>Summary')
  expect(html).toContain('<summary>Activation')
  expect(html).toContain('Moonweave (Major)')
  expect(html).toContain('Sunweave (Major)')
  expect(html).toContain('Fortification (Greater)')
  expect(html).not.toContain('aria-label="Remove Moonweave (Major) rune"')
  expect(html).not.toContain('aria-label="Remove Sunweave (Major) rune"')
  expect(c.armors[0].name).toBe(hideEmbraceName)
  expect(c.armors[0].runes).toEqual([])
})

it('activates and dismisses the armor avatar with its battle form and specific attacks', () => {
  const c = { ...character, armors: [owned(hideEmbraceName)], activeSpells: ['Pest Form'] }
  let patch: Partial<Character> = {}
  const armorTree = ArmorList({ c, entries, save: change => { patch = change }, part: 'armor' })
  const findAbilities = (node: ReactNode): ComponentProps<typeof NamedArmorAbilities> | undefined => {
    let result: ComponentProps<typeof NamedArmorAbilities> | undefined
    Children.forEach(node, child => {
      if (result || !isValidElement<{ children?: ReactNode }>(child)) return
      if (child.type === NamedArmorAbilities) result = child.props as ComponentProps<typeof NamedArmorAbilities>
      else result = findAbilities(child.props.children)
    })
    return result
  }
  const tree = NamedArmorAbilities(findAbilities(armorTree)!)
  const findButton = (node: ReactNode): (() => void) | undefined => {
    let result: (() => void) | undefined
    Children.forEach(node, child => {
      if (result || !isValidElement<{ children?: ReactNode; 'aria-label'?: string; onClick?: (event: { preventDefault: () => void; stopPropagation: () => void }) => void }>(child)) return
      if (child.props['aria-label'] === 'Activate Ancestral Embrace Avatar')
        result = () => child.props.onClick?.({ preventDefault: () => {}, stopPropagation: () => {} })
      else result = findButton(child.props.children)
    })
    return result
  }
  findButton(tree)!()
  expect(patch.activeSpells).toEqual([ANCESTRAL_AVATAR])
  const transformed = { ...c, ...patch }
  expect(transformed.activeSpells).toEqual([ANCESTRAL_AVATAR])
  expect(activeBattleForm(transformed, entries)).toMatchObject({ size: 'Huge', ac: 45, temporaryHp: 30, attack: 33, athletics: 35,
    note: 'Air walk; ignore difficult terrain and greater difficult terrain.' })
  expect(temporaryHpGrant(transformed, entries)?.value).toBe(30)
  expect(armorClass(transformed, entries)).toBe(45)
  expect(movementSpeeds(transformed, entries)[0].feet).toBe(70)
  const attacks = ownedWeapons(transformed, entries)
  expect(attacks.map(a => a.name)).toEqual(['Avatar Spear', 'Avatar Blowgun'])
  expect(weaponAttack(transformed, entries, attacks[0])).toMatchObject({ attack: 33, damage: '6d6+6 piercing', reach: 15, thrownRange: 50 })
  expect(weaponAttack(transformed, entries, attacks[1])).toMatchObject({ attack: 33, damage: '1d6+3 piercing', range: 120,
    additionalDamage: expect.arrayContaining([expect.objectContaining({ value: '5d6 poison' })]) })
  expect(renderToStaticMarkup(<WeaponList c={transformed} entries={entries} save={() => {}} displayOnly />)).toContain('5d6 poison')
  expect(activeBattleForm({ ...transformed, ...spellActiveChange(transformed, ANCESTRAL_AVATAR, false) }, entries)).toBeUndefined()
  expect(activeBattleForm({ ...transformed, armors: [{ ...c.armors[0], worn: false }] }, entries)).toBeUndefined()
})

it('shows ordinary armor descriptions without a Summary toggle', () => {
  const described = { ...leather, description: 'Flexible leather armor.' }
  const c = { ...character, armors: [owned(described.name)] }
  const html = renderToStaticMarkup(<ArmorList c={c} entries={[described]} save={() => {}} part="armor" />)
  expect(html).toContain('<small>Flexible leather armor.</small>')
  expect(html).not.toContain('<summary>Summary</summary>')
})

it('derives named armor bases, fundamental runes, elven construction, and immutable source metadata', () => {
  const before = JSON.stringify(entries)
  expect(gearPickerEntries(entries, 'armor').filter(entry => entry.data.named_armor).map(entry => entry.name))
    .toEqual([hideEmbraceName, bane.name, artifact.name])
  expect(armorEntry(character, entries, hideEmbraceName)?.data).toMatchObject({
    ac: 3, dex_cap: 2, named_armor_potency: 4, named_armor_resilient: 3,
    named_armor_rune_limit: 3, url: embrace.data.url, price: '',
  })

  expect(effectiveArmor(character, entries, owned(hideEmbraceName))).toMatchObject({ potency: 4, resilient: 3 })
  expect(effectiveArmor(character, entries, owned(bane.name))).toMatchObject({ potency: 2, resilient: 2 })
  const upgraded = { ...owned(artifact.name), potency: 4, runes: ['Shadow', 'Fortification (Greater)'] }
  expect(effectiveArmor(character, entries, upgraded)).toMatchObject({
    potency: 4, resilient: 3, runes: ['Fortification (Greater)', 'Shadow'],
  })
  const generated = armorEntry(character, entries, artifact.name)!
  expect(generated.data).toMatchObject({ ac: 2, dex_cap: 3, check_penalty: 0, strength: 2, bulk: 1.1 })
  expect(generated.traits).toContain('Flexible')
  expect(generated.traits).not.toContain('Noisy')
  expect(JSON.stringify(entries)).toBe(before)
  expect(upgraded.runes).toEqual(['Shadow', 'Fortification (Greater)'])
})

it('builds a Fortress Shield variant that retains Scale of Igroon effects and adds its profile', () => {
  const variant = makeNamedShieldEntry(entries, SCALE_OF_IGROON_FORTRESS)!
  expect(variant).toMatchObject({ name: SCALE_OF_IGROON_FORTRESS, kind: 'shield',
    data: { ac: 3, bulk: 5, speed_penalty: -10, hardness: 20, hp: 160, bt: 80, named_shield_fortress: true } })
  expect(variant.description).toContain('Fortress Shield profile')
  const shield: OwnedShield = { id: variant.id, name: variant.name, hardness: 20, hp: 160, damage: 0,
    equipped: true, raised: true, takingCover: true }
  const c = { ...character, shield }
  expect(shieldAcBonus(c, entries)).toBe(4)
  expect(shieldAcBonus({ ...c, shield: { ...shield, raised: false } }, entries)).toBe(3)
  expect(speedBonuses(c, entries)).toContainEqual({ source: 'Fortress Shield', feet: -10 })
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={entries} save={() => {}} part="shield" />)
  expect(markup).toContain('aria-label="Taking Cover behind Fortress Shield"')
  expect(markup).toContain('Take Cover (+1 AC)')
})

it('automatically applies Great Shield Mastery while eligible shields are raised', () => {
  const feat = { name: 'Great Shield Mastery', type: 'Class Feat', level: 20 }
  const tower: ContentEntry = { ...fortressShield, id: 'tower', name: 'Tower Shield', data: { ac: 2 } }
  const other: ContentEntry = { ...tower, id: 'other', name: 'Custom Cover Shield',
    description: 'Take Cover behind this shield to gain a +5 circumstance bonus to AC.' }
  const ordinary: ContentEntry = { ...tower, id: 'ordinary', name: 'Steel Shield' }
  const allEntries = [...entries, tower, other, ordinary]
  for (const [name, base, cover] of [[tower.name, 2, 4], [fortressShield.name, 3, 4],
    [SCALE_OF_IGROON_FORTRESS, 3, 4], [other.name, 2, 5], [ordinary.name, 2, 2]] as const) {
    const shield: OwnedShield = { id: name, name, hardness: 6, hp: 24, damage: 0, equipped: true, raised: true }
    const c = { ...character, shield, feats: [feat] }
    expect(shieldAcBonus(c, allEntries)).toBe(cover)
    expect(shieldAcBonus({ ...c, shield: { ...shield, raised: false } }, allEntries)).toBe(base)
    expect(shieldAcBonus({ ...c, feats: [] }, allEntries)).toBe(base)
    expect(shieldAcBonus({ ...c, level: 19 }, allEntries)).toBe(base)
    expect(armorClass(c, allEntries) - armorClass({ ...c, shield: { ...shield, raised: false } }, allEntries)).toBe(cover)
  }
  const c = { ...character, shield: { ...shield, name: SCALE_OF_IGROON_FORTRESS, raised: true }, feats: [feat] }
  expect(renderToStaticMarkup(<ArmorList c={c} entries={allEntries} save={() => {}} part="shield" />))
    .not.toContain('aria-label="Taking Cover behind Fortress Shield"')
})

it('applies passive armor defenses only while worn, including legacy equipment-only saves', () => {
  for (const [name, damage, value, resilient] of [[hideEmbraceName, 'Negative', 25, 3], [bane.name, 'Poison', 10, 2], [artifact.name, 'Poison', 15, 3]] as const) {
    const c = { ...character, armors: [owned(name)], equipment: [{ name, qty: 1 }] }
    expect(resistances(c, entries)).toEqual([{ damage, value, source: name }])
    expect(resistances({ ...c, armors: [{ ...owned(name), worn: false }] }, entries)).toEqual([])
    expect(armorSaveBonus(c, entries)).toBe(resilient)
    expect(savingThrowBreakdown(c, entries, 'Fortitude').parts.find(part => part.label.includes('resilient'))?.value).toBe(resilient)
    const legacy = { ...character, equipment: [{ name, qty: 1 }] }
    expect(ownedArmors(legacy, entries)[0]).toMatchObject({ name, worn: true, resilient })
    expect(resistances(legacy, entries)).toEqual([{ damage, value, source: name }])
    expect(armorClass(legacy, entries)).toBe(armorClass(c, entries))
  }
  const legacy = { ...character, equipment: [{ name: bane.name, qty: 1 }, { name: embrace.name, qty: 1 }] }
  expect(ownedArmors(legacy, entries).find(armor => armor.worn)?.name).toBe(hideEmbraceName)
})

it('keeps situational effects manual and exposes source activations in expandable armor, shield, and mask details', () => {
  const c = { ...character, armors: [owned(hideEmbraceName), { ...owned(artifact.name), worn: false }], shield }
  const html = renderToStaticMarkup(<ArmorList c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Potency <b>+4</b>')
  expect(html).toContain('Built into Slithermaw')
  expect(html).toContain('High-grade dawnsilver elven chain')
  expect(html).toContain('<summary>Calistria’s Sting ')
  expect(html).toContain('<summary>Purge Toxins ')
  expect(html).toContain('Counteract rank 9th')
  expect(html).not.toContain('additional +1 item bonus only on saves versus poison')
  expect(html).not.toContain('tracked manually')
  expect(html).toContain('Hardness 20; Hit Points 160; Broken Threshold 80')
  expect(html).toContain('Recover 4 HP (start of wielder’s turn)')
  expect(namedArmorAbilities(armorEntry(c, entries, hideEmbraceName)).map(ability => ability.actions))
    .toEqual([undefined, 'Free Action', 'Free Action', 'Two Actions', undefined])
  expect(namedArmorAbilities(armorEntry(c, entries, bane.name)).find(ability => ability.name === 'Terrain Adaptation')?.paragraphs.join(' '))
    .toContain('10 minutes')
  const maskHtml = renderToStaticMarkup(<NamedArmorAbilities entry={mask} />)
  expect(maskHtml).not.toContain('Concealment applies only while wearing the mask in a jungle, not everywhere')
  expect(maskHtml).toContain('once per hour')
  expect(maskHtml).toContain('rounded up')
  expect(maskHtml).toContain('aria-label="Single Action"')
  expect(gearPickerEntries(entries, 'armor').some(entry => entry.name === mask.name)).toBe(false)
  expect(gearPickerEntries(entries, 'shield').some(entry => entry.name === scale.name)).toBe(true)
})

it('uses source shield durability and preserves saved base stats without material or rune upgrades', () => {
  expect(shieldStats(shield, character, entries)).toMatchObject({ hardness: 20, hp: 160 })
  expect(shieldStats({ ...shield, hardness: 25, hp: 200 }, character, entries)).toMatchObject({ hardness: 25, hp: 200 })
  expect(shieldStats({ ...shield, material: { name: 'Custom material', hardness: 50, hp: 500 },
    reinforcingRune: 'Supreme' }, character, entries)).toMatchObject({ hardness: 20, hp: 160 })
  expect(shieldMaterialOptions(entries, shield, character.systems)).toEqual([])
  expect(shieldEntry(entries, scale.name)?.data.url).toBe(scale.data.url)
  expect(armorSaveBonus({ ...character, shield }, entries)).toBe(0)
  expect(resistances({ ...character, shield, equipment: [{ name: mask.name, qty: 1 }] }, entries)).toEqual([])
  expect(makeNamedArmorEntries([embrace], [])).toEqual([])
  expect(makeNamedArmorEntries([chain, artifact], [{ name: 'Fortification (Greater)' }])).toEqual([])
  expect(makeNamedArmorEntries([chain, elven, artifact], [{ name: 'Fortification' }])[0].data.named_armor_runes)
    .toBe('Fortification (Greater)')
  expect(makeNamedShieldEntry([{ ...scale, description: 'Unavailable rules.' }], scale.name)).toBeUndefined()
})

it('keeps only artifact Ancestral Embrace Hide Armor with a three-property-rune cap', () => {
  const armors = makeNamedArmorEntries(entries, [fortification, greaterFortification])
  expect(armors.filter(a => a.name.includes('Ancestral Embrace')).map(a => a.name)).toEqual([hideEmbraceName])
  const hideEmbrace = armors.find(a => a.name === hideEmbraceName)!
  expect(hideEmbrace.data.named_armor_base).toBe('Hide Armor')
  expect(hideEmbrace.data.named_armor_material).toBe('Orichalcum')
  expect(hideEmbrace.traits).toContain('Artifact')
  expect(String(hideEmbrace.data.named_armor_runes).split(';')).toEqual([
    'Moonweave (Major)', 'Sunweave (Major)',
  ])
  expect(hideEmbrace.description).not.toMatch(/brightly colored/i)
  expect(hideEmbrace.description).not.toMatch(/leather armor|brightly colored/i)
  const c = { ...character, armors: [{ ...owned(hideEmbraceName), material: 'Grisantian Hide' as const }] }
  const html = renderToStaticMarkup(<ArmorList c={c} entries={entries} save={() => {}} part="armor" />)
  expect(html).toContain(`>${hideEmbraceName}</button>`)
  expect(html).not.toContain('aria-label="Add property rune"')
  expect(effectiveArmor(c, entries, { ...c.armors[0], runes: ['Shadow', 'Acid Resistant'] }).runes)
    .toEqual(['Moonweave (Major)', 'Sunweave (Major)', 'Fortification (Greater)'])
})

it.each([
  [11, undefined, 2, 2],
  [12, 'Fortification', 3, 3],
  [17, 'Fortification', 3, 3],
  [18, 'Fortification (Greater)', 3, 3],
])('scales Ancestral Embrace Fortification at level %i without changing saved runes', (level, rune, bulk, strength) => {
  const armor = { ...owned(hideEmbraceName), runes: ['Shadow'] }
  const c = { ...character, level, armors: [armor] }
  const entry = armorEntry(c, entries, armor.name)!
  expect(entry.data).toMatchObject({ bulk, strength })
  expect(effectiveArmor(c, entries, armor).runes)
    .toEqual(['Moonweave (Major)', 'Sunweave (Major)', rune ?? 'Shadow'])
  expect(armor.runes).toEqual(['Shadow'])
})

it('preserves displaced saved runes when changing Ancestral Embrace while Fortification is active', () => {
  const armor = { ...owned(hideEmbraceName), runes: ['Shadow'] }
  const c = { ...character, armors: [armor] }
  let patch: Partial<Character> = {}
  const tree = ArmorList({ c, entries, save: change => { patch = change }, part: 'armor' })
  const find = (node: ReactNode): ((event: { target: { checked: boolean } }) => void) | undefined => {
    let result: ((event: { target: { checked: boolean } }) => void) | undefined
    Children.forEach(node, child => {
      if (result || !isValidElement<{ children?: ReactNode; 'aria-label'?: string; onChange?: typeof result }>(child)) return
      if (child.props['aria-label'] === `Worn ${hideEmbraceName}`) result = child.props.onChange
      else result = find(child.props.children)
    })
    return result
  }
  find(tree)!({ target: { checked: false } })
  expect(patch.armors?.[0].runes).toContain('Shadow')
  expect(patch.armors?.[0].runes).not.toContain('Fortification (Greater)')
  expect(effectiveArmor({ ...c, level: 11 }, entries, patch.armors![0]).runes).toContain('Shadow')
})

it("labels Slithermaw's Bane as an Elven Chain Shirt", () => {
  const generated = armorEntry(character, entries, bane.name)!
  expect(specificMagicItemName(generated)).toBe("Slithermaw's Bane Elven Chain Shirt")
})

it("gives Slithermaw's Bane the major weave runes and Orichalcum", () => {
  const generated = armorEntry(character, entries, bane.name)!
  expect(String(generated.data.named_armor_runes).split(';')).toEqual(expect.arrayContaining(['Moonweave (Major)', 'Sunweave (Major)']))
  expect(generated.data.named_armor_material).toBe('Orichalcum')
})

it("orders Slithermaw's Bane artifact sections as senses, summary, then alphabetized activations", () => {
  const abilities = namedArmorAbilities({ ...artifact, data: { ...artifact.data, named_armor: true } })
  expect(abilities.map(ability => ability.name)).toEqual(['Senses', 'Summary', 'Adaptation', "Calistria’s Sting", 'Purge Toxins'])
  expect(abilities[0].paragraphs).toEqual(['Perception +34; precise low-light vision and hearing within 30 feet', 'Will +34'])
})
