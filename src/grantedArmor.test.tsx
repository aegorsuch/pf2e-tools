import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { armorClass, armorEntry, armorGauntlet, armorSpecialization, defenseSummary, equippedShield, hardwoodShield, ownedArmors, shieldRaisedChange, wornArmor } from './builder'
import { ArmorList } from './GearSection'
import { SkillsSection } from './SkillsSection'
import { grantedArmorEntries, HARDWOOD_ARMOR_ID, INVENTOR_ARMOR_ID } from './grantedArmor'
import { homebrewCharacterOptions } from './supplemental'
import type { Character, ContentEntry } from './types'

const base: Character = {
  id: 'armor', systems: ['pf2e'], name: 'Armor test', level: 1,
  abilities: { str: 16, dex: 18, con: 12, int: 14, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const feat = (name: string, choice?: string, level = 1): Character['feats'][number] =>
  ({ name, choice, level, type: 'Ancestry Feat' })

it.each(['Ranger', 'Druid', 'Kineticist'])('grants locked, scaling Hardwood Armor to %s without replacing owned gear', className => {
  const c: Character = { ...base, className, level: 11, feats: [feat('Hardwood Armor')],
    armors: [{ id: 'existing', name: 'Chain Mail', worn: false, potency: 1, resilient: 0, runes: [] }] }
  const armor = ownedArmors(c, []).find(item => item.id === HARDWOOD_ARMOR_ID)
  expect(armor).toMatchObject({ name: className === 'Kineticist' ? 'Hardwood Armor' : 'Wooden Breastplate',
    potency: 2, resilient: 1, material: 'Duskwood (Standard-Grade)' })
  expect(ownedArmors(c, []).some(item => item.id === 'existing')).toBe(true)
  expect(ownedArmors({ ...c, level: 20 }, [])[0]).toMatchObject({ potency: 3, resilient: 3, material: 'Duskwood (High-Grade)' })
  expect(renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />))
    .not.toContain('aria-label="Remove Duskwood (Standard-Grade) material"')
  expect(ownedArmors({ ...c, feats: [] }, []).some(item => item.id === HARDWOOD_ARMOR_ID)).toBe(false)
  expect(!!hardwoodShield(c)).toBe(className !== 'Ranger')
})

it('preserves ordinary shields while generated hardwood shield is equipped and raised', () => {
  const ordinary = { id: 'ordinary', name: 'Steel Shield', hardness: 5, hp: 20, damage: 2, raised: false }
  let c: Character = { ...base, className: 'Druid', level: 10, feats: [feat('Hardwood Armor')], shield: ordinary }
  expect(equippedShield(c)?.id).toBe('ordinary')
  c = { ...c, hardwoodShield: { equipped: true } }
  expect(hardwoodShield(c)).toMatchObject({ hardness: 6, hp: 24 })
  c = { ...c, ...shieldRaisedChange(c, true) }
  expect(equippedShield(c)).toMatchObject({ id: 'granted-shield:hardwood', raised: true })
  expect(c.shield).toEqual(ordinary)
  expect(equippedShield({ ...c, feats: [] })).toEqual(ordinary)
})

it('provides Ranger and Druid copies without the impulse trait', () => {
  const original: ContentEntry = { id: 'hardwood', kind: 'feat', name: 'Hardwood Armor', systems: ['pf2e'], source: 'official',
    level: 1, traits: ['Impulse', 'Kineticist', 'Wood', 'Primal'], data: {}, description: '', effects: [], updatedAt: 0 }
  const copy = homebrewCharacterOptions([original]).find(entry => entry.name === 'Hardwood Armor')!
  expect(copy.data.class).toBe('Ranger, Druid')
  expect(copy.traits).toEqual(['Wood', 'Primal', 'Ranger', 'Druid'])
  expect(original.traits).toContain('Impulse')
})

function find(node: ReactNode, predicate: (element: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<Record<string, unknown>>(child)) continue
    if (predicate(child)) return child
    const found = find(child.props.children as ReactNode, predicate)
    if (found) return found
  }
}

it.each([
  ['Automaton', undefined, 'Reinforced Chassis', 'Reinforced Chassis'],
  ['Lizardfolk', 'Bakuwa Lizardfolk', undefined, 'Bakuwa Plates'],
  ['Conrasu', 'Rite of Reinforcement', undefined, 'Reinforced Exoskeleton'],
  ['Kashrishi', 'Lethoci', 'Tough Skin', 'Tough Skin'],
  ['Surki', 'Hardshell Surki', undefined, 'Hardshell Carapace'],
  ['Nagaji', 'Titan Nagaji', undefined, 'Titan Scales'],
] as const)('automatically equips attached armor for %s without modifying saved data', (ancestry, heritage, name, armorName) => {
  const c: Character = { ...base, ancestry, heritage, feats: name ? [feat(name)] : [] }
  const original = JSON.stringify(c)
  expect(ownedArmors(c, [])).toHaveLength(1)
  expect(wornArmor(c)).toMatchObject({ name: armorName, worn: true })
  expect(armorEntry(c, [], armorName)?.data).toMatchObject({ attached: true, armor_category: 'Medium', armor_group: 'Plate', dex_cap: 1 })
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)
  expect(markup).not.toContain('aria-label="Armor material"')
  expect(markup).not.toContain(`aria-label="Remove ${armorName}"`)
  expect(JSON.stringify(c)).toBe(original)
})

it.each([
  [1, 0, 0, 3], [5, 1, 0, 4], [8, 1, 1, 4], [11, 2, 1, 5],
  [14, 2, 2, 5], [18, 3, 2, 5], [20, 3, 3, 5],
])('scales chassis fundamentals and base AC at level %i with locked Orichalcum', (level, potency, resilient, ac) => {
  const c: Character = { ...base, ancestry: 'Automaton', feats: [feat('Reinforced Chassis')], level }
  expect(wornArmor(c)).toMatchObject({ material: 'Orichalcum', potency, resilient })
  expect(grantedArmorEntries(c)[0].data.ac).toBe(ac)
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('>Orichalcum</button>')
  expect(markup).not.toContain('Remove Orichalcum material')
})

it('uses body armor AC, Dexterity cap, and actual medium armor proficiency', () => {
  const c: Character = { ...base, level: 10, className: 'Fighter', ancestry: 'Nagaji', heritage: 'Titan Nagaji' }
  const fighter: ContentEntry = {
    id: 'fighter', kind: 'class', name: 'Fighter', systems: ['pf2e'], source: 'official', level: 0,
    description: '', traits: [], data: { medium_armor_proficiency: 'Expert' }, effects: [], updatedAt: 0,
  }
  expect(armorClass(c, [fighter])).toBe(30)
})

it('preserves ordinary armor and dormant granted configuration when eligibility changes', () => {
  let c: Character = { ...base, ancestry: 'Automaton', feats: [feat('Reinforced Chassis')],
    armors: [{ id: 'purchased', name: 'Chain Mail', worn: true, potency: 1, resilient: 1, runes: ['Shadow'] }] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  expect(ownedArmors(c, []).find(armor => armor.id === 'purchased')?.worn).toBe(false)
  const bodyCard = find(ArmorList({ c, entries: [], save }), element => element.type === 'article'
    && !!find(element.props.children as ReactNode, child => child.type === 'strong'
      && String(child.props.children).includes('Reinforced Chassis')))
  const potency = find(bodyCard, element => element.props.label === 'Potency')
  if (!potency) throw new Error('Missing body armor fundamentals')
  ;(potency.props.onChange as (value: number) => void)(2)
  expect(c.armors?.find(armor => armor.id === 'purchased')?.worn).toBe(true)
  c = { ...c, feats: [] }
  expect(ownedArmors(c, [])).toMatchObject([{ id: 'purchased', worn: true }])
  const ordinaryPotency = find(ArmorList({ c, entries: [], save }), element => element.props.label === 'Potency')
  if (!ordinaryPotency) throw new Error('Missing ordinary armor fundamentals')
  ;(ordinaryPotency.props.onChange as (value: number) => void)(2)
  c = { ...c, feats: [feat('Reinforced Chassis')] }
  expect(wornArmor(c)?.potency).toBe(2)
  expect(ownedArmors({ ...c, feats: [feat('Reinforced Chassis', undefined, 5)] }, [])).toHaveLength(1)
  expect(ownedArmors({ ...c, ancestry: 'Human' }, [])).toHaveLength(1)
})

it.each([
  { className: 'Inventor', subclass: 'Armor' },
  { className: 'Inventor', subclass: 'Construct', feats: [feat('Second Innovation', 'Armor', 8)], level: 8 },
  { className: 'Inventor', subclass: 'Weapon', feats: [feat('Third Innovation', 'Armor', 16)], level: 16 },
  { className: 'Fighter', feats: [feat('Inventor Dedication', 'Armor', 2)], level: 2 },
])('grants one selectable Inventor suit through $className innovation ownership', patch => {
  let c: Character = { ...base, ...patch,
    armors: [{ id: INVENTOR_ARMOR_ID, name: 'Power Suit', worn: true, material: 'Orichalcum', potency: 2, resilient: 2, runes: ['Shadow'] }] }
  expect(ownedArmors(c, [])).toMatchObject([{ id: INVENTOR_ARMOR_ID, name: 'Power Suit' }])
  const picker = find(ArmorList({ c, entries: [], save: change => { c = { ...c, ...change } } }),
    element => element.props['aria-label'] === 'Inventor armor suit')
  if (!picker) throw new Error('Missing suit selector')
  ;(picker.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Subterfuge Suit' } })
  c = JSON.parse(JSON.stringify(c))
  expect(ownedArmors(c, [])).toMatchObject([{ id: INVENTOR_ARMOR_ID, name: 'Subterfuge Suit', material: 'Orichalcum', potency: 2, resilient: 2, runes: ['Shadow'] }])
  expect(armorEntry(c, [], 'Subterfuge Suit')?.data).toMatchObject({ ac: 2, dex_cap: 4, armor_group: 'Composite' })
  expect(renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)).toContain('aria-label="Remove Orichalcum material"')
})

it('does not grant Inventor armor from other innovations or future feats', () => {
  expect(ownedArmors({ ...base, className: 'Inventor', subclass: 'Weapon' }, [])).toHaveLength(0)
  expect(ownedArmors({ ...base, feats: [feat('Inventor Dedication', 'Construct')] }, [])).toHaveLength(0)
  expect(ownedArmors({ ...base, feats: [feat('Inventor Dedication', 'Armor', 2)] }, [])).toHaveLength(0)
})

it('provides the configured gauntlet for a worn Power Suit only', () => {
  const c: Character = { ...base, className: 'Inventor', subclass: 'Armor',
    armors: [{ id: INVENTOR_ARMOR_ID, name: 'Power Suit', worn: true, potency: 1, resilient: 0, runes: [], gauntlet: 'Clawed Gauntlet' }] }
  expect(armorGauntlet(c, [])).toMatchObject({ name: 'Clawed Gauntlet' })
  expect(armorGauntlet({ ...c, inventorArmorSuit: 'Subterfuge Suit' }, [])).toBeUndefined()
})

it.each([
  ['Copaxi', undefined, 'Armored Shell', 'Armored Shell', 3, 1],
  ['Trox', 'Fortified Trox', undefined, 'Fortified Exoskeleton', 4, 1],
  ['Urog', 'Crystal Carapace Urog', undefined, 'Crystal Carapace', 2, 2],
  ['Gnarefuroid', 'Hullborne Gnarefuroid', undefined, 'Hullborne Carapace', 3, 2],
  ['Android', 'Hellforged Android', undefined, 'Hellforged Plates', 5, 0],
  ['Khizar', 'Petrified', undefined, 'Petrified Bark', 4, 1],
  ['Barathu', 'Rugged Explorer Barathu', undefined, 'Rugged Explorer Shell', 2, 2],
  ['Vesk', 'Plated Vesk', undefined, 'Vesk Plates', 3, 1],
] as const)('grants the correct Starfinder %s armor profile', (ancestry, heritage, name, armorName, ac, dexCap) => {
  const c: Character = { ...base, systems: ['sf2e'], ancestry, heritage, feats: name ? [feat(name)] : [] }
  expect(wornArmor(c)?.name).toBe(armorName)
  expect(armorEntry(c, [], armorName)?.data).toMatchObject({ ac, dex_cap: dexCap, attached: true })
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)
  expect(markup).not.toContain('aria-label="Armor material"')
  expect(markup).not.toContain(`aria-label="Remove ${armorName}"`)
  expect(ownedArmors({ ...c, systems: ['pf2e'] }, [])).toHaveLength(0)
})

it('applies Starfinder heavy armor upgrades only while their feats are active', () => {
  const trox: Character = { ...base, systems: ['sf2e'], ancestry: 'Trox', heritage: 'Fortified Trox', feats: [feat('Heavy Exoskeleton', undefined, 9)], level: 8 }
  expect(grantedArmorEntries(trox)[0].data).toMatchObject({ ac: 5, armor_category: 'Medium' })
  expect(grantedArmorEntries({ ...trox, level: 9 })[0]).toMatchObject({
    data: { ac: 6, armor_category: 'Heavy', speed_penalty: -10, medium_proficiency: true }, traits: ['Bulwark', 'Comfort', 'Exposed', 'Resilient'],
  })
  const android: Character = { ...base, systems: ['sf2e'], ancestry: 'Android', heritage: 'Hellforged Android', feats: [feat('Hardened Plates')] }
  expect(grantedArmorEntries(android)[0]).toMatchObject({
    data: { ac: 6, dex_cap: 0, armor_category: 'Heavy', strength: 4 }, traits: ['Bulwark', 'Comfort'],
  })
})

it('keeps Copaxi armor rune-free, supports Enhanced Shell, and permits eligible flight suits without replacing body armor', () => {
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Copaxi', level: 20,
    feats: [feat('Armored Shell'), feat('Enhanced Shell', undefined, 5)],
    armors: [
      { id: 'granted-armor:copaxi', name: 'Armored Shell', potency: 3, resilient: 3, runes: ['Shadow'], worn: true },
      { id: 'flight', name: 'Flight Suit', potency: 0, resilient: 0, runes: [], worn: true },
      { id: 'heavy', name: 'Heavy Armor', potency: 0, resilient: 0, runes: [], worn: true },
    ] }
  expect(grantedArmorEntries(c)[0].data).toMatchObject({ ac: 7, upgrade_slots: 5, runes_allowed: false })
  expect(wornArmor(c)).toMatchObject({ name: 'Armored Shell', potency: 0, resilient: 0, runes: [] })
  expect(ownedArmors(c, []).find(armor => armor.id === 'flight')?.worn).toBe(true)
  expect(ownedArmors(c, []).find(armor => armor.id === 'heavy')?.worn).toBe(false)
  expect(c.armors?.[0].runes).toEqual(['Shadow'])
})

it('uses explicit shell training without unarmored proficiency, and medium proficiency for Heavy Exoskeleton', () => {
  const caster: ContentEntry = {
    id: 'caster', name: 'Test Class', kind: 'class', systems: ['sf2e'], source: 'official', level: 0,
    description: '', traits: [], data: { unarmored_proficiency: 'Legendary', medium_armor_proficiency: 'Expert', heavy_armor_proficiency: 'Trained' },
    effects: [], updatedAt: 0,
  }
  const c: Character = { ...base, systems: ['sf2e'], className: 'Test Class', ancestry: 'Copaxi', feats: [feat('Armored Shell')] }
  expect(armorClass(c, [caster])).toBe(17)
  expect(armorClass({ ...c, ancestry: 'Trox', heritage: 'Fortified Trox', level: 9, feats: [feat('Heavy Exoskeleton', undefined, 9)] }, [caster])).toBe(30)
  expect(armorClass({ ...c, ancestry: 'Urog', heritage: 'Crystal Carapace Urog', feats: [] }, [caster])).toBe(17)
  expect(armorClass({ ...c, ancestry: 'Android', heritage: 'Hellforged Android', feats: [] }, [caster])).toBe(20)
})

it.each([['Barathu', 'Rugged Explorer Barathu', 2, 4], ['Vesk', 'Plated Vesk', 3, 5]] as const)(
  'combines %s heritage and grade improvements at level 5 without double-counting', (ancestry, heritage, before, after) => {
    const c: Character = { ...base, systems: ['sf2e'], ancestry, heritage, level: 4 }
    expect(grantedArmorEntries(c)[0].data.ac).toBe(before)
    expect(grantedArmorEntries({ ...c, level: 5 })[0].data.ac).toBe(after)
  },
)

it.each([
  [1, 'Commercial', 0, 0, 1], [4, 'Commercial', 0, 0, 1],
  [5, 'Tactical', 1, 0, 2], [7, 'Tactical', 1, 0, 2],
  [8, 'Advanced', 1, 1, 2], [10, 'Advanced', 1, 1, 2],
  [11, 'Superior', 2, 1, 3], [13, 'Superior', 2, 1, 3],
  [14, 'Elite', 2, 2, 3], [17, 'Elite', 2, 2, 3],
  [18, 'Ultimate', 3, 2, 4], [19, 'Ultimate', 3, 2, 4],
  [20, 'Paragon', 3, 3, 4],
] as const)('automatically applies Starfinder grades at level %i without fundamental runes', (level, grade, acBonus, resilient, slots) => {
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Gnarefuroid', heritage: 'Hullborne Gnarefuroid', level,
    armors: [{ id: 'granted-armor:gnarefuroid', name: 'Hullborne Carapace', potency: 3, resilient: 3, runes: [], worn: true }] }
  expect(wornArmor(c)).toMatchObject({ potency: 0, resilient: 0 })
  expect(grantedArmorEntries(c)[0].data).toMatchObject({
    armor_grade: grade, ac: 3 + acBonus, grade_save_bonus: resilient, upgrade_slots: slots,
  })
  expect(armorClass(c, [])).toBe(15 + acBonus)
  const defenses = defenseSummary(c, [])
  const withoutArmor = defenseSummary({ ...c, heritage: undefined }, [])
  for (const save of ['fortitude', 'reflex', 'will'] as const) expect(defenses[save] - withoutArmor[save]).toBe(resilient)
  expect(defenses.perception).toBe(withoutArmor.perception)
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain(`Grade: ${grade} (automatic)`)
  expect(markup).not.toContain('>SF2e</small>')
  expect(markup).not.toContain('<label>Potency ')
  expect(markup).not.toContain('<label>Resilient ')
  expect(c.armors?.[0]).toMatchObject({ potency: 3, resilient: 3 })
})

it('distinguishes PF2e and SF2e armor progression in mixed-system characters', () => {
  const c: Character = { ...base, systems: ['pf2e', 'sf2e'], level: 20, className: 'Inventor', subclass: 'Armor',
    ancestry: 'Vesk', heritage: 'Plated Vesk' }
  expect(ownedArmors(c, [])).toMatchObject([
    { name: 'Vesk Plates', potency: 0, resilient: 0, worn: true },
    { name: 'Power Suit', potency: 3, resilient: 3, worn: false },
  ])
  expect(grantedArmorEntries(c)).toMatchObject([{ systems: ['sf2e'] }, { systems: ['pf2e'] }])
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)
  expect(markup).not.toContain('>PF2e</small>')
  expect(markup).not.toContain('>SF2e</small>')
  expect(markup).toContain('Grade: Paragon (automatic)')
  expect(markup).toContain('Armor upgrades cannot be installed on this armor')
  expect(grantedArmorEntries(c)[0].data.upgrade_slots).toBe(0)
})

it('shows native grade saving throw bonuses in defense rows, matching the calculator', () => {
  const c: Character = { ...base, systems: ['sf2e'], level: 20, ancestry: 'Gnarefuroid', heritage: 'Hullborne Gnarefuroid' }
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="defense" />)
  expect(markup).toContain('Fortitude +4: show breakdown')
  expect(markup).toContain('Reflex +7: show breakdown')
  expect(markup).toContain('Will +3: show breakdown')
})

it('uses native grade resilience rather than PF2e potency for Starfinder armor specialization', () => {
  const specialization: ContentEntry = {
    id: 'specialization', name: 'Armor Specialization', kind: 'feat', systems: ['sf2e'], source: 'official',
    level: 1, description: '', traits: [], data: { grants_armor_specialization: true }, effects: [], updatedAt: 0,
  }
  const plate: ContentEntry = { ...specialization, id: 'plate', name: 'Plate', kind: 'armorGroup', data: {} }
  const c: Character = { ...base, systems: ['sf2e'], ancestry: 'Trox', heritage: 'Fortified Trox',
    level: 5, feats: [feat('Armor Specialization')] }
  expect(armorSpecialization(c, [specialization, plate])?.benefit).toMatchObject({ value: 1, damage: 'Slashing' })
  expect(armorSpecialization({ ...c, level: 8 }, [specialization, plate])?.benefit).toMatchObject({ value: 2 })
  expect(armorSpecialization({ ...c, level: 20, feats: [...c.feats, feat('Heavy Exoskeleton', undefined, 9)] }, [specialization, plate])?.benefit).toMatchObject({ value: 5 })
})
