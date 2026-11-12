import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import {
  activeAnimalFeatures, blessedArmamentRuneOptions, blessedArmamentTargets, championBlessings, characterSummary, defenseSummary, deitySanctification, effectiveWeapon, eligibleFeats,
  featChoiceOptions, heritagesFor, initiativeBonus, magicHideChange, maxPropertyRunes, movementSpeeds, ownedArmors, ownedWeapons, plannedSlots, ragingAthleteBenefits, resistances, senses, speed, weaponAttack,
} from './builder'
import { companionStats } from './companions'
import { ArmorList, WeaponList } from './GearSection'
import { ClassFeatures } from './ClassFeatures'
import { SkillsSection } from './SkillsSection'
import { MinionsSection } from './MinionsSection'
import { SpellsSection } from './SpellsSection'
import { homebrewCharacterOptions, HAFT_STRIKER_WEAPON, ORC_TUSKS, OVERSIZED_THROW } from './supplemental'
import type { Character, ContentEntry, OwnedWeapon } from './types'

const base: Character = {
  id: 'c', systems: ['pf2e'], name: 'Test', level: 10, className: 'Champion', deity: 'Iomedae',
  abilities: { str: 12, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const feat = (name: string, level = 1, choice?: string) => ({ name, level, choice, type: 'Class Feat' })
const content = (kind: ContentEntry['kind'], name: string, data: ContentEntry['data'] = {}, level = 1, traits: string[] = []): ContentEntry =>
  ({ id: name, systems: ['pf2e'], kind, source: 'official', name, data, level, traits, description: '', effects: [], updatedAt: 1 })
const sword = content('weapon', 'Longsword', { damage: '1d8 slashing', hands: 1, weapon_category: 'Martial' })
const deity = content('deity', 'Iomedae', { favored_weapon: 'longsword', sanctification: 'holy', sanctification_required: true })
const main: OwnedWeapon = { id: 'main', name: 'Longsword', potency: 3, striking: 1, runes: [] }

it('gives Orichalcum one extra rune slot without increasing fundamental limits or stacking initiative circumstances', () => {
  for (const potency of [1, 2, 3]) expect(maxPropertyRunes(potency, 'Orichalcum')).toBe(potency + 1)
  expect(maxPropertyRunes(0, 'Orichalcum')).toBe(0)
  const c: Character = { ...base, armors: [{ id: 'a', name: 'Plate', material: 'Orichalcum', potency: 3, resilient: 3, worn: true, runes: [] }] }
  const normal = initiativeBonus({ ...c, armors: [] }, [])
  expect(initiativeBonus(c, [])).toBe(normal + 1)
  expect(initiativeBonus({ ...c, feats: [feat('Incredible Initiative')] }, [])).toBe(normal + 2)
  expect(initiativeBonus({ ...c, armors: c.armors!.map((armor) => ({ ...armor, worn: false })) }, [])).toBe(normal)
})

it('locks Wood-group armor to level-scaled Duskwood without changing stored material or non-Wood armor', () => {
  const wood = content('armor', 'Wooden Breastplate', { armor_group: 'Wood' })
  const armor = { id: 'armor', name: wood.name, material: 'Orichalcum' as const, potency: 3, resilient: 2, worn: true, runes: [] }
  const c: Character = { ...base, armors: [armor] }
  for (const [level, material] of [[1, 'Duskwood (Standard-Grade)'], [18, 'Duskwood (Standard-Grade)'], [19, 'Duskwood (High-Grade)']] as const) {
    const character = { ...c, level }
    expect(ownedArmors(character, [wood])[0].material).toBe(material)
    const markup = renderToStaticMarkup(<ArmorList c={character} entries={[wood]} save={() => {}} />)
    expect(markup).toContain(`aria-label="Armor material" disabled=""`)
    expect(markup).toContain(`<option selected="">${material}</option>`)
    expect(initiativeBonus(character, [wood])).toBe(initiativeBonus({ ...character, armors: [] }, [wood]))
  }
  expect(c.armors?.[0].material).toBe('Orichalcum')
  const metal = { ...wood, data: { armor_group: 'Plate' } }
  expect(ownedArmors(c, [metal])[0].material).toBe('Orichalcum')
  expect(ownedArmors({ ...c, armors: undefined, equipment: [{ name: wood.name, qty: 1 }] }, [wood])[0].material)
    .toBe('Duskwood (Standard-Grade)')
})

it('automatically chooses the deity-favored armament without requiring another weapon selection', () => {
  const c: Character = { ...base, weapons: [main], blessing: 'Blessed Armament' }
  expect(weaponAttack(c, [sword, deity], main).criticalSpecialization).toBe(true)
  const markup = renderToStaticMarkup(<ClassFeatures c={c} entries={[sword, deity]} save={() => {}} />)
  expect(markup).toContain('Blessed armament: Longsword')
  expect(markup).not.toContain('aria-label="Blessed armament"')
  expect(markup).not.toContain('Choose favored weapon')
  expect(markup).not.toContain('aria-label="Blessed armament rune" disabled')
  const second = { ...main, id: 'second' }
  const multiple = { ...c, weapons: [main, second] }
  expect(weaponAttack(multiple, [sword, deity], main).criticalSpecialization).toBe(true)
  expect(weaponAttack(multiple, [sword, deity], second).criticalSpecialization).toBe(false)
  expect(weaponAttack({ ...multiple, blessedArmament: { weaponId: second.id, rune: 'Ghost Touch' } }, [sword, deity], second).criticalSpecialization).toBe(true)
})

it('removes irrelevant active toggles while retaining their spell descriptions and damage rolls', () => {
  const names = ["Ranger's Bramble", 'Ephemeral Tracking', "Hunter's Vision"]
  const entries = names.map((name) => content('spell', name, { duration: 60 }))
  const c: Character = { ...base, className: 'Ranger', spells: names.map((name) => ({ name, rank: 3, cantrip: false })) }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  for (const name of names) {
    expect(markup).not.toContain(`aria-label="${name.replaceAll("'", '&#x27;')} active"`)
    expect(markup).toContain(name.replaceAll("'", '&#x27;'))
  }
  expect(markup).toContain('Critical failure: 4d4 persistent bleed')
})

it('locks eligible Living Weapons to Peachwood without losing dormant Orichalcum configuration', () => {
  const weapon: OwnedWeapon = { ...main, material: 'Orichalcum', livingWeapon: true, runes: ['Flaming', 'Frost', 'Shock', 'Thundering'] }
  const c = { ...base, feats: [feat('Living Weapon')] }
  expect(effectiveWeapon(c, [sword], weapon)).toMatchObject({ material: 'Peachwood (Greater)', runes: ['Flaming', 'Frost', 'Shock', 'Shifting'] })
  expect(effectiveWeapon(c, [sword], { ...weapon, livingWeapon: false })).toMatchObject({ material: 'Orichalcum', runes: weapon.runes })
  expect(effectiveWeapon(c, [{ ...sword, traits: ['Free-Hand'] }], weapon).material).toBe('Orichalcum')
  expect(weapon.runes).toHaveLength(4)
  for (const runes of [['Shifting', 'Flaming', 'Frost', 'Shock'], ['Flaming', 'Frost', 'Shock', 'Shifting']]) {
    const shifting = { ...weapon, runes }
    expect(effectiveWeapon(c, [sword], shifting).runes).toEqual(['Flaming', 'Frost', 'Shock', 'Shifting'])
    const markup = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [shifting] }} entries={[sword]} save={() => {}} />)
    expect(markup).toContain('title="Granted by Living Weapon"')
    expect(markup).not.toContain('aria-label="Remove Shifting rune"')
  }
})

it('grants one Blessed Armament rune beyond full normal capacity only to the selected favored weapon', () => {
  const weapon: OwnedWeapon = { ...main, material: 'Orichalcum', runes: ['Flaming', 'Frost', 'Shock', 'Thundering'] }
  const c: Character = { ...base, blessing: 'Blessed Armament', blessedArmament: { weaponId: weapon.id, rune: 'Ghost Touch' } }
  expect(effectiveWeapon(c, [sword, deity], weapon).runes).toEqual([...weapon.runes, 'Ghost Touch'])
  expect(weaponAttack(c, [sword, deity], weapon).criticalSpecialization).toBe(true)
  expect(renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [weapon] }} entries={[sword, deity]} save={() => {}} />))
    .not.toContain('Critical specialization granted by Blessed Armament.')
  expect(effectiveWeapon({ ...c, deity: undefined }, [sword, deity], weapon).runes).toEqual(weapon.runes)
  expect(effectiveWeapon(c, [sword, deity], { ...weapon, id: 'other' }).runes).toEqual(weapon.runes)
  expect(effectiveWeapon({ ...c, level: 2 }, [sword, deity], weapon).runes).toEqual(weapon.runes)
  const markup = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [weapon] }} entries={[sword, deity]} save={() => {}} />)
  expect(markup).toContain('title="Granted by Blessed Armament"')
  expect(markup).not.toContain('aria-label="Remove Ghost Touch rune"')
  expect(markup).not.toContain('slashing + Flaming, Frost, Ghost Touch')
})

it('expands Blessed Armament choices through the required feats, levels, and sanctification', () => {
  const radiant: Character = { ...base, sanctification: 'Holy', feats: [feat('Radiant Armament', 10)] }
  expect(blessedArmamentRuneOptions(base)).not.toContain('Astral')
  expect(blessedArmamentRuneOptions(radiant, [deity])).toEqual(expect.arrayContaining(['Astral', 'Brilliant', 'Holy']))
  expect(blessedArmamentRuneOptions(radiant)).not.toContain('Unholy')
  expect(blessedArmamentRuneOptions({ ...radiant, level: 9 })).not.toContain('Astral')
  const paragon = { ...radiant, level: 20, feats: [...radiant.feats, feat('Armament Paragon', 20)] }
  expect(blessedArmamentRuneOptions(paragon)).toEqual(expect.arrayContaining(['Fearsome (Greater)', 'Astral (Greater)', 'Brilliant (Greater)']))
  expect(blessedArmamentRuneOptions({ ...paragon, feats: [feat('Armament Paragon', 20)] })).not.toContain('Astral (Greater)')
})

it('locks required deity sanctification, restricts optional choices, and deactivates incompatible saved runes', () => {
  const c: Character = { ...base, sanctification: 'Unholy', blessing: 'Blessed Armament',
    feats: [feat('Radiant Armament', 10)], weapons: [main, { ...main, id: 'bow', name: 'Longbow' }],
    blessedArmament: { weaponId: main.id, rune: 'Holy' } }
  expect(deitySanctification(c, [deity])).toEqual({ options: ['Holy'], required: 'Holy', selected: 'Holy' })
  expect(blessedArmamentRuneOptions(c, [deity])).toContain('Holy')
  expect(blessedArmamentRuneOptions(c, [deity])).not.toContain('Unholy')
  expect(effectiveWeapon(c, [sword, deity], main).runes).toContain('Holy')
  expect(blessedArmamentTargets(c, [sword, deity]).map((weapon) => weapon.id)).toEqual([main.id])
  const markup = renderToStaticMarkup(<ClassFeatures c={c} entries={[sword, deity]} save={() => {}} />)
  expect(markup).toContain('<select aria-label="Sanctification" disabled=""><option selected="">Holy</option></select>')
  expect(markup).not.toContain('>Longbow</option>')
  const optional = { ...deity, data: { ...deity.data, sanctification_required: false } }
  expect(deitySanctification(c, [optional]).selected).toBeUndefined()
  expect(deitySanctification({ ...c, sanctification: 'Holy' }, [optional]).selected).toBe('Holy')
  expect(effectiveWeapon(c, [sword, optional], main).runes).not.toContain('Holy')
  const neutral = { ...deity, data: { favored_weapon: 'longsword' } }
  expect(deitySanctification(c, [neutral]).options).toEqual([])
  const both = { ...deity, data: { ...deity.data, sanctification: 'holy, unholy', sanctification_required: false } }
  expect(deitySanctification(c, [both]).selected).toBe('Unholy')
  expect(effectiveWeapon(c, [sword, both], main).runes).not.toContain('Holy')
})

it('requires Second Blessing for Third Blessing and prevents duplicate blessing choices', () => {
  const c: Character = { ...base, level: 16, blessing: 'Blessed Shield', feats: [
    { ...feat('Second Blessing', 8, 'Blessed Armament'), slot: 'class:8:0' },
    { ...feat('Third Blessing', 16, 'Blessed Swiftness'), slot: 'class:16:0' },
  ] }
  const options = homebrewCharacterOptions([])
  const slot = plannedSlots(c).find((slot) => slot.category === 'class' && slot.level === 16)!
  expect(eligibleFeats(options, { ...c, feats: [] }, slot).map((entry) => entry.name)).not.toContain('Third Blessing')
  expect(eligibleFeats(options, { ...c, feats: c.feats.slice(0, 1) }, slot).map((entry) => entry.name)).toContain('Third Blessing')
  expect(featChoiceOptions('Third Blessing', c, [], 'class:16:0')).toEqual(['Blessed Swiftness'])
  expect(championBlessings(c)).toEqual(['Blessed Shield', 'Blessed Armament', 'Blessed Swiftness'])
  expect(championBlessings({ ...c, feats: c.feats.slice(1) })).toEqual(['Blessed Shield'])
  expect(effectiveWeapon({ ...c, blessedArmament: { weaponId: main.id, rune: 'Ghost Touch' } }, [sword, deity], main).runes).toEqual(['Ghost Touch'])
})

it('offers distinct additional innovations at levels 8 and 16 and requires Second Innovation for Third', () => {
  const innovations = ['Weapon', 'Construct', 'Armor'].map((name) => content('subclass', name, { class: 'Inventor' }))
  const entries = [...homebrewCharacterOptions([]), ...innovations]
  const c: Character = { ...base, className: 'Inventor', subclass: 'Construct', level: 16,
    feats: [{ ...feat('Second Innovation', 8, 'Armor'), slot: 'class:8:0' }] }
  const slot = plannedSlots(c).find((slot) => slot.category === 'class' && slot.level === 16)!
  expect(entries.find((entry) => entry.name === 'Second Innovation')).toMatchObject({ level: 8, traits: ['Inventor'], source: 'homebrew' })
  expect(entries.find((entry) => entry.name === 'Third Innovation')).toMatchObject({ level: 16, data: { prerequisite: 'Second Innovation' } })
  expect(featChoiceOptions('Second Innovation', { ...c, feats: [] }, entries, 'class:8:0')).toEqual(['Armor', 'Weapon'])
  expect(featChoiceOptions('Third Innovation', c, entries, slot.key)).toEqual(['Weapon'])
  expect(eligibleFeats(entries, c, slot).map((entry) => entry.name)).toContain('Third Innovation')
  expect(eligibleFeats(entries, { ...c, feats: [] }, slot).map((entry) => entry.name)).not.toContain('Third Innovation')
  expect(eligibleFeats(entries, { ...c, feats: [{ ...feat('Second Innovation', 18), slot: 'class:18:0' }] }, slot).map((entry) => entry.name)).not.toContain('Third Innovation')
  expect(featChoiceOptions('Third Innovation', { ...c, feats: [...c.feats, { ...feat('Third Innovation', 16, 'Weapon'), slot: slot.key }] }, entries, slot.key)).toEqual(['Weapon'])
})

it('offers Impaling Throw as a level-one Ranger action with its embedded-weapon rules', () => {
  const entries = homebrewCharacterOptions([])
  const c: Character = { ...base, className: 'Ranger', level: 1 }
  const slot = plannedSlots(c).find((slot) => slot.category === 'class' && slot.level === 1)!
  const impaling = eligibleFeats(entries, c, slot).find((entry) => entry.name === 'Impaling Throw')!
  expect(impaling).toMatchObject({ level: 1, source: 'homebrew', traits: ['Flourish', 'Ranger', '3rd Party'],
    data: { class: 'Ranger', actions: 'Single Action' } })
  expect(impaling.description).toContain('Athletics or Medicine skill check against your class DC')
  expect(impaling.description).toContain('clumsy 1')
  expect(impaling.description).toContain('weapons without the thrown trait that deal piercing damage')
  expect(eligibleFeats(entries, base, slot).map((entry) => entry.name)).not.toContain('Impaling Throw')
})

it('offers Impaled Takedown at level four without inventing an Impaling Throw prerequisite', () => {
  const entries = homebrewCharacterOptions([])
  const c: Character = { ...base, className: 'Ranger', level: 4 }
  const slot = plannedSlots(c).find((slot) => slot.category === 'class' && slot.level === 4)!
  const takedown = eligibleFeats(entries, c, slot).find((entry) => entry.name === 'Impaled Takedown')!
  expect(takedown).toMatchObject({ level: 4, source: 'homebrew', traits: ['Flourish', 'Ranger', '3rd Party'],
    data: { class: 'Ranger', actions: 'Single Action' } })
  expect(takedown.description).toContain('Shove or Trip')
  expect(takedown.description).toContain('off-guard to your next strike')
  expect(takedown.description).toContain('clumsy 2 until the weapon is removed')
  expect(takedown.data.prerequisite).toBeUndefined()
  expect(eligibleFeats(entries, c, { ...slot, level: 2 }).map((entry) => entry.name)).not.toContain(takedown.name)
  expect(eligibleFeats(entries, base, slot).map((entry) => entry.name)).not.toContain(takedown.name)
})

it('copies Deadly Simplicity for Champion and offers it only with a trained simple or unarmed favored weapon', () => {
  const official = content('feat', 'Deadly Simplicity', { class: 'Cleric',
    prerequisite: "deity with a simple or unarmed attack favored weapon, trained with your deity's favored weapon" }, 1, ['Cleric'])
  const champion = content('class', 'Champion', { attack_proficiency: 'Trained in simple weapons' })
  const staff = content('weapon', 'Staff', { weapon_category: 'Simple', damage: '1d4 bludgeoning' })
  const staffDeity = { ...deity, data: { favored_weapon: 'staff' } }
  const entries = [official, champion, staff, staffDeity, ...homebrewCharacterOptions([official])]
  const copy = entries.find((entry) => entry.id === 'homebrew:champion-deadly-simplicity')!
  expect(copy).toMatchObject({ name: official.name, level: 1, source: 'homebrew', traits: ['Champion'],
    data: { class: 'Champion', prerequisite: official.data.prerequisite } })
  expect(official.traits).toEqual(['Cleric'])
  const slot = plannedSlots(base).find((slot) => slot.category === 'class' && slot.level === 1)!
  expect(eligibleFeats(entries, base, slot).map((entry) => entry.id)).toContain(copy.id)
  expect(eligibleFeats(entries.filter((entry) => entry !== champion), base, slot).map((entry) => entry.id)).not.toContain(copy.id)
  expect(eligibleFeats(entries, { ...base, deity: undefined }, slot).map((entry) => entry.id)).not.toContain(copy.id)
  expect(eligibleFeats([official, champion, sword, deity, copy], base, slot).map((entry) => entry.id)).not.toContain(copy.id)
  const irori = { ...deity, data: { favored_weapon: 'fist' } }
  expect(eligibleFeats([official, champion, irori, copy], base, slot).map((entry) => entry.id)).toContain(copy.id)
})

it('increases all Deadly Simplicity simple weapon dice by one step, retaining striking and flat damage', () => {
  const champion = content('class', 'Champion', { attack_proficiency: 'Trained in simple weapons, Trained in martial weapons' })
  const staffDeity = { ...deity, data: { favored_weapon: 'staff' } }
  const c: Character = { ...base, feats: [feat('Deadly Simplicity')] }
  const weapon = { ...main, name: 'Staff', striking: 3 }
  for (const [before, after] of [[4, 6], [6, 8], [8, 10], [10, 12], [12, 12]]) {
    const staff = content('weapon', 'Staff', { weapon_category: 'Simple', damage: `1d${before} bludgeoning` })
    const entries = [champion, staffDeity, staff]
    expect(weaponAttack(c, entries, weapon).damage).toBe(`4d${after}+1 bludgeoning`)
    for (const patch of [{ feats: [] }, { deity: undefined }])
      expect(weaponAttack({ ...c, ...patch }, entries, weapon).damage).toBe(`4d${before}+1 bludgeoning`)
    expect(weaponAttack(c, [staffDeity, staff], weapon).damage).toBe(`4d${before}+1 bludgeoning`)
    const unrelated = { ...staffDeity, data: { favored_weapon: 'club' } }
    expect(weaponAttack(c, [champion, unrelated, staff], weapon).damage).toBe(`4d${before}+1 bludgeoning`)
    const martial = { ...staff, data: { ...staff.data, weapon_category: 'Martial' } }
    expect(weaponAttack(c, [champion, staffDeity, martial], weapon).damage).toBe(`4d${before}+1 bludgeoning`)
  }
  const staff = content('weapon', 'Staff', { weapon_category: 'Simple', damage: '1d4 bludgeoning' })
  const markup = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [weapon] }} entries={[champion, staffDeity, staff]} save={() => {}} />)
  expect(markup).toContain('Damage 4d6+1 B')
})

it('caps Deadly Simplicity favored unarmed improvements at d6 without shrinking larger attacks', () => {
  const c: Character = { ...base, feats: [feat('Deadly Simplicity')], handwraps: { potency: 1, striking: 2, runes: [] } }
  for (const [before, after] of [[4, 6], [6, 6], [8, 8]]) {
    const attack = content('weapon', 'Divine Claw', { weapon_category: 'Unarmed', damage: `1d${before} slashing` }, 0, ['Unarmed'])
    const favored = { ...deity, data: { favored_weapon: 'divine claw' } }
    const weapon = { ...main, name: attack.name }
    expect(weaponAttack(c, [attack, favored], weapon).damage).toBe(`3d${after}+1 slashing`)
    expect(weaponAttack({ ...c, feats: [] }, [attack, favored], weapon).damage).toBe(`3d${before}+1 slashing`)
  }
})

it('requires Living Weapon and Wild Hunter Dedication for Pristine Living Weapon at level fourteen', () => {
  const dedication = content('feat', 'Wild Hunter Dedication', { archetype: 'Wild Hunter' }, 2, ['Archetype', 'Dedication'])
  const entries = [...homebrewCharacterOptions([]), dedication]
  const c: Character = { ...base, level: 14, feats: [feat('Wild Hunter Dedication', 2), feat('Living Weapon', 8)] }
  const slot = { key: 'archetype:14:0', level: 14, category: 'archetype' as const }
  expect(eligibleFeats(entries, c, slot).map((entry) => entry.name)).toContain('Pristine Living Weapon')
  const pristine = entries.find((entry) => entry.name === 'Pristine Living Weapon')!
  expect(pristine).toMatchObject({ level: 14, traits: ['Archetype'],
    data: { archetype: 'Wild Hunter', prerequisite: 'Living Weapon, Wild Hunter Dedication' } })
  expect(pristine.description).not.toContain('verdant')
  for (const feats of [[], c.feats.slice(0, 1), c.feats.slice(1), [c.feats[0], feat('Living Weapon', 16)]])
    expect(eligibleFeats(entries, { ...c, feats }, slot).map((entry) => entry.name)).not.toContain(pristine.name)
  expect(eligibleFeats(entries, c, { ...slot, level: 12 }).map((entry) => entry.name)).not.toContain(pristine.name)
})

it('treats Living Weapons and inherited haft strikes as cold iron and silver without adding unconditional bleed', () => {
  const polearm = content('weapon', 'Glaive', { hands: 2, weapon_group: 'Polearm', damage: '1d8 slashing' })
  const weapon = { ...main, name: polearm.name, livingWeapon: true }
  const c: Character = { ...base, level: 14, weapons: [weapon], feats: [
    feat('Wild Hunter Dedication', 2), feat('Living Weapon', 8), feat('Pristine Living Weapon', 14), feat('Haft Striker Stance', 4),
  ] }
  const ordinary = { ...weapon, id: 'ordinary', livingWeapon: false }
  const entries = [polearm]
  const haft = ownedWeapons(c, entries).find((weapon) => weapon.name === HAFT_STRIKER_WEAPON.name)!
  for (const strike of [weapon, haft]) {
    const attack = weaponAttack(c, entries, strike)
    expect(attack.pristineLivingWeapon).toBe(true)
    expect(attack.damage).not.toContain('bleed')
    expect(effectiveWeapon(c, entries, strike).material).toBe('Peachwood (Greater)')
  }
  expect(weaponAttack(c, entries, ordinary).pristineLivingWeapon).toBe(false)
  for (const missing of ['Wild Hunter Dedication', 'Living Weapon', 'Pristine Living Weapon']) {
    expect(weaponAttack({ ...c, feats: c.feats.filter((feat) => feat.name !== missing) }, entries, weapon).pristineLivingWeapon).toBe(false)
  }
  expect(weaponAttack({ ...c, level: 13 }, entries, weapon).pristineLivingWeapon).toBe(false)
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('treated as cold iron and silver')
  expect(markup).toContain('Critical hit against a creature with a weakness to cold iron or silver: 1d6 persistent bleed.')
  expect(markup).toContain('Material*')
  expect(markup).not.toContain('Damage 2d8+1 S + 1d6')
})

it('excludes separately owned blessing grants as well as the primary blessing', () => {
  const c: Character = { ...base, blessing: 'Blessed Shield', feats: [feat('Blessed Armament')] }
  expect(featChoiceOptions('Second Blessing', c, [], 'class:8:0')).toEqual(['Blessed Swiftness'])
  expect(featChoiceOptions('Second Blessing', { ...c, feats: [...c.feats, feat('Blessed Swiftness')] }, [], 'class:8:0')).toEqual([])
})

it('applies Jousting only to qualifying selected verdant, living, or favored one-handed melee weapons', () => {
  const c = { ...base, level: 14, feats: ['Favored Weapon Jousting', 'Verdant Weapon Jousting', 'Living Weapon Joust', 'Living Weapon'].map((name) => feat(name)) }
  expect(weaponAttack(c, [sword, deity], main).traits).toContain('Jousting')
  expect(renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [main] }} entries={[sword, deity]} save={() => {}} />))
    .not.toContain('Jousting while riding')
  const other = { ...main, name: 'Other' }
  const otherEntry = { ...sword, name: 'Other' }
  expect(weaponAttack(c, [otherEntry, deity], other).traits).not.toContain('Jousting')
  expect(weaponAttack(c, [otherEntry, deity], { ...other, verdantWeapon: true }).traits).toContain('Jousting')
  expect(weaponAttack(c, [otherEntry, deity], { ...other, livingWeapon: true }).traits).toContain('Jousting')
  expect(weaponAttack({ ...c, level: 13 }, [otherEntry, deity], { ...other, livingWeapon: true }).traits).not.toContain('Jousting')
  const nonJousting: ContentEntry['data'][] = [{ hands: 2 }, { hands: 1, weapon_type: 'Ranged', range: 20 }]
  for (const data of nonJousting) {
    expect(weaponAttack(c, [{ ...sword, data: { ...sword.data, ...data } }, deity], { ...main, livingWeapon: true, verdantWeapon: true }).traits).not.toContain('Jousting')
  }
})

it.each([[5, 'Low-Grade'], [9, 'Low-Grade'], [10, 'Standard-Grade'], [15, 'Standard-Grade'], [16, 'High-Grade']] as const)('scales locked Cold Iron Tusks material at level %i without granting independent unarmed runes', (level, grade) => {
  const c = { ...base, level, feats: [feat('Cold Iron Tusks', 5)] }
  const tusks = ownedWeapons(c, []).find((weapon) => weapon.name === ORC_TUSKS.name)!
  expect(effectiveWeapon(c, [], tusks)).toMatchObject({ material: `Cold Iron (${grade})`, potency: 0, striking: 0, runes: [] })
  expect(effectiveWeapon({ ...c, handwraps: { potency: 2, striking: 1, runes: ['Flaming'] } }, [], tusks)).toMatchObject({ potency: 2, striking: 1, runes: ['Flaming'] })
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain(`<select aria-label="Weapon material" disabled=""><option selected="">Cold Iron (${grade})</option></select>`)
  expect(markup).not.toContain('Configure unarmed potency')
  expect(markup).not.toContain('locked by Cold Iron Tusks')
  expect(ownedWeapons({ ...c, level: 4 }, []).map((weapon) => weapon.name)).not.toContain('Tusks')
})

it('applies Animal Feature senses, movement, and level gates without changing land Speed', () => {
  const c: Character = { ...base, level: 7, className: 'Ranger', activeSpells: ['Animal Feature'], animalFeature: 'Cat Eyes',
    feats: [feat('Advanced Warden', 4, 'Animal Feature'), feat('Fleet'), feat('Primal Nimbleness')] }
  expect(senses(c, []).map((sense) => sense.value)).toContain('Low-Light Vision')
  expect(senses({ ...c, animalFeature: 'Owl Eyes' }, []).map((sense) => sense.value)).toContain('Darkvision')
  expect(movementSpeeds({ ...c, animalFeature: 'Fish Tail' }, [])).toEqual([{ name: 'Land', feet: 35 }, { name: 'Swim', feet: 35, source: 'Animal Feature' }])
  expect(movementSpeeds({ ...c, animalFeature: 'Wings' }, [])).toEqual([{ name: 'Land', feet: 35 }, { name: 'Fly', feet: 35, source: 'Animal Feature' }])
  expect(activeAnimalFeatures({ ...c, animalFeature: 'Wings', level: 6 }, [])).toEqual([])
  expect(senses({ ...c, activeSpells: [] }, [])).toEqual([])
  expect(movementSpeeds({ ...c, animalFeature: 'Wings', feats: [] }, [])).toEqual([{ name: 'Land', feet: 25 }])
})

it('gates Barbarian senses on Rage and acquisition level without granting Nocturnal Senses low-light vision', () => {
  const nocturnal = content('feat', 'Nocturnal Senses', { grants_vision: 'Low-Light Vision' }, 6, ['Barbarian'])
  const elf = content('ancestry', 'Elf', { vision: 'Low-Light Vision' })
  const c: Character = { ...base, className: 'Barbarian', level: 6, raging: true,
    feats: [feat('Acute Scent', 2), feat('Nocturnal Senses', 6)] }
  expect(senses(c, [nocturnal])).toEqual([{ value: 'Scent (imprecise) 60 feet', source: 'Nocturnal Senses' }])
  expect(senses({ ...c, raging: false }, [nocturnal])).toEqual([])
  expect(senses({ ...c, feats: [feat('Nocturnal Senses', 6)] }, [nocturnal])).toEqual([])
  expect(senses({ ...c, level: 5 }, [nocturnal])).toEqual([{ value: 'Scent (imprecise) 30 feet', source: 'Acute Scent' }])
  expect(senses({ ...c, ancestry: 'Elf' }, [nocturnal, elf])).toContainEqual({ value: 'Darkvision', source: 'Nocturnal Senses' })
  expect(senses({ ...c, ancestry: 'Elf', raging: false }, [nocturnal, elf])).toEqual([{ value: 'Low-Light Vision', source: 'Elf' }])
  const delayed = { ...c, feats: [{ ...feat('Acute Vision'), slot: 'class:8:0' }] }
  expect(senses(delayed, [])).toEqual([])
  expect(senses({ ...delayed, level: 8 }, [])).toEqual([{ value: 'Darkvision', source: 'Acute Vision' }])
  expect(senses({ ...delayed, level: 8, raging: false }, [])).toEqual([])
})

it('keeps only the strongest imprecise scent when Rage feats overlap Keen Smell', () => {
  const c: Character = { ...base, level: 6, raging: true, activeSpells: ['Keen Smell'],
    spells: [{ name: 'Keen Smell', rank: 1, cantrip: false }],
    feats: [feat('Acute Scent', 2), feat('Nocturnal Senses', 6)] }
  expect(senses(c, [])).toEqual([{ value: 'Scent (imprecise) 60 feet', source: 'Keen Smell' }])
  expect(senses({ ...c, activeSpells: [] }, [])).toEqual([{ value: 'Scent (imprecise) 60 feet', source: 'Nocturnal Senses' }])
})

it('grants Natural Swimmer its swim Speed without reducing existing swimming or spending land Speed', () => {
  const c: Character = { ...base, className: 'Druid', level: 4, feats: [feat('Natural Swimmer', 4)] }
  expect(movementSpeeds(c, [])).toEqual([{ name: 'Land', feet: 25 }, { name: 'Swim', feet: 15, source: 'Natural Swimmer' }])
  expect(movementSpeeds({ ...c, level: 3 }, [])).toEqual([{ name: 'Land', feet: 25 }])
  expect(movementSpeeds({ ...c, level: 7, activeSpells: ['Animal Feature'], animalFeature: 'Fish Tail',
    spells: [{ name: 'Animal Feature', rank: 2, cantrip: false }] }, [])).toEqual([
    { name: 'Land', feet: 25 }, { name: 'Swim', feet: 25, source: 'Animal Feature' },
  ])
})

it('gives Raging Athlete full land-Speed climbing and swimming only during Rage and merges overlapping speeds', () => {
  const c: Character = { ...base, className: 'Barbarian', level: 4, raging: true,
    feats: [feat('Raging Athlete', 4), feat('Fleet'), feat('Natural Swimmer', 4)] }
  expect(movementSpeeds(c, [])).toEqual([
    { name: 'Land', feet: 30 }, { name: 'Climb', feet: 30, source: 'Raging Athlete' }, { name: 'Swim', feet: 30, source: 'Raging Athlete' },
  ])
  expect(movementSpeeds({ ...c, raging: false }, [])).toEqual([
    { name: 'Land', feet: 30 }, { name: 'Swim', feet: 15, source: 'Natural Swimmer' },
  ])
  expect(movementSpeeds({ ...c, level: 3 }, [])).toEqual([{ name: 'Land', feet: 30 }])
  const overlap = { ...c, spells: [{ name: 'Canopy Crawler', rank: 2, cantrip: false }], activeSpells: ['Canopy Crawler'] }
  expect(movementSpeeds(overlap, []).filter((movement) => movement.name === 'Climb')).toEqual([
    { name: 'Climb', feet: 30, source: 'Raging Athlete, Canopy Crawler' },
  ])
})

it('does not use future Speed feats to increase current Rage movement or Leap distance', () => {
  const c: Character = { ...base, level: 6, raging: true,
    feats: [feat('Raging Athlete', 4), { ...feat('Fleet'), slot: 'general:7:0' }] }
  expect(movementSpeeds(c, []).map((movement) => movement.feet)).toEqual([25, 25, 25])
  expect(ragingAthleteBenefits(c, [])?.horizontalLeap).toBe(15)
  expect(movementSpeeds({ ...c, level: 7 }, []).map((movement) => movement.feet)).toEqual([30, 30, 30])
  expect(ragingAthleteBenefits({ ...c, level: 7 }, [])?.horizontalLeap).toBe(20)
})

it.each([[14, undefined], [15, 15], [29, 15], [30, 20]])('uses actual Speed %i for Raging Athlete Leap thresholds', (feet, horizontalLeap) => {
  const ancestry = content('ancestry', 'Test ancestry', { speed: feet })
  const c: Character = { ...base, ancestry: ancestry.name, raging: true, feats: [feat('Raging Athlete', 4)] }
  expect(ragingAthleteBenefits(c, [ancestry])).toEqual({ jumpDCAdjustment: -10, longJumpExtra: 10, verticalLeap: 5, horizontalLeap })
  expect(ragingAthleteBenefits({ ...c, raging: false }, [ancestry])).toBeUndefined()
  expect(ragingAthleteBenefits({ ...c, level: 3 }, [ancestry])).toBeUndefined()
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[ancestry]} save={() => {}} part="offense" />)
  expect(markup).toContain('Jump DCs -10')
  if (horizontalLeap) expect(markup).toContain(`${horizontalLeap} ft. horizontal`)
})

it('upgrades Superior Sight from other low-light sources, never from its own metadata, with acquisition gating', () => {
  const sight = content('feat', 'Superior Sight', { grants_vision: 'Low-Light Vision' }, 20, ['Ranger'])
  const elf = content('ancestry', 'Elf', { vision: 'Low-Light Vision' })
  const c: Character = { ...base, className: 'Ranger', level: 20, feats: [feat(sight.name, 20)] }
  expect(senses(c, [sight])).toEqual([{ value: 'Low-Light Vision', source: 'Superior Sight' }])
  expect(senses({ ...c, ancestry: 'Elf' }, [sight, elf])).toContainEqual({ value: 'Darkvision', source: 'Superior Sight' })
  expect(senses({ ...c, level: 19 }, [sight])).toEqual([])
  const future = content('feat', 'Later Vision', { grants_vision: 'Darkvision' })
  expect(senses({ ...c, level: 19, feats: [{ ...feat(future.name), slot: 'ancestry:20:0' }] }, [future])).toEqual([])
})

it('applies Superior Sight to Perception and initiative without stacking circumstance bonuses', () => {
  const c: Character = { ...base, className: 'Ranger', level: 20, feats: [feat('Superior Sight', 20)] }
  const normal = defenseSummary({ ...c, feats: [] }, []).perception
  expect(defenseSummary(c, []).perception).toBe(normal + 2)
  expect(initiativeBonus(c, [])).toBe(normal + 2)
  expect(initiativeBonus({ ...c, feats: [...c.feats, feat('Incredible Initiative')] }, [])).toBe(normal + 2)
  expect(defenseSummary({ ...c, level: 19 }, []).perception).toBe(defenseSummary({ ...c, level: 19, feats: [] }, []).perception)
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="offense" />)
  expect(markup).toContain(`Perception <b>${normal + 2 >= 0 ? '+' : ''}${normal + 2}</b>`)
  expect(markup).toContain('<small>Circumstance</small>+2')
})

it('shows movement sources inline and alphabetizes alternate speeds after land Speed', () => {
  const c: Character = { ...base, level: 9, className: 'Ranger',
    feats: [feat('Persistent Animal Feature', 8), feat('Fleet'), feat('Primal Nimbleness')],
    spells: [{ name: 'Animal Feature', rank: 2, cantrip: false }, { name: 'Canopy Crawler', rank: 2, cantrip: false }],
    activeSpells: ['Animal Feature', 'Canopy Crawler'], animalFeatures: ['Fish Tail', 'Wings'] }
  const text = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="offense" />).replace(/<[^>]*>/g, '')
  expect(text).toContain('Speed: 35 ft. (+5 Fleet, +5 Primal Nimbleness); Climbing 35 ft. (Canopy Crawler); Fly 35 ft. (Animal Feature); Swim 35 ft. (Animal Feature)')
  const inactive = renderToStaticMarkup(<SkillsSection c={{ ...c, activeSpells: [] }} entries={[]} save={() => {}} part="offense" />)
  expect(inactive).not.toContain('Climbing')
  expect(inactive).not.toContain('(Animal Feature)')
})

it.each([[1, 30], [4, 30], [5, 60], [20, 60]])('adds active Keen Smell scent at level %i with correct focus-spell heightening', (level, range) => {
  const c: Character = { ...base, level, className: 'Ranger', activeSpells: ['Keen Smell'],
    feats: [feat('Initiate Warden', 1, 'Keen Smell')] }
  const expected = { value: `Scent (imprecise) ${range} feet`, source: 'Keen Smell' }
  expect(senses(c, [])).toContainEqual(expected)
  expect(senses(JSON.parse(JSON.stringify(c)) as Character, [])).toContainEqual(expected)
  expect(senses({ ...c, activeSpells: [] }, [])).not.toContainEqual(expected)
  expect(senses({ ...c, feats: [] }, [])).not.toContainEqual(expected)
  const markup = renderToStaticMarkup(<SkillsSection c={c} entries={[]} save={() => {}} part="offense" />)
  expect(markup).toContain(`Scent (imprecise) ${range} feet (Keen Smell)`)
})

it('applies Magic Hide only to the selected companion while the known spell is active', () => {
  const cat = content('companion', 'Cat', { strength: 2, dexterity: 3, constitution: 1, hp: 6, size: 'Small', speed: 35 })
  const c: Character = { ...base, companions: [{ id: 'a', type: 'Cat', name: 'A' }, { id: 'b', type: 'Cat', name: 'B' }],
    activeSpells: ['Magic Hide'], magicHideCompanionId: 'b', spells: [{ name: 'Magic Hide', rank: 1, cantrip: false }] }
  const normal = companionStats({ ...c, activeSpells: [] }, [cat], 'Cat')!.ac
  expect(companionStats(c, [cat], 'Cat', undefined, 'a')!.ac).toBe(normal)
  expect(companionStats(c, [cat], 'Cat', undefined, 'b')!.ac).toBe(normal + 1)
  expect(companionStats({ ...c, spells: [] }, [cat], 'Cat', undefined, 'b')!.ac).toBe(normal)
  const stale = { ...c, magicHideCompanionId: 'removed-companion' }
  expect(companionStats(stale, [cat], 'Cat', undefined, 'a')!.ac).toBe(normal + 1)
  expect(companionStats(stale, [cat], 'Cat', undefined, 'b')!.ac).toBe(normal)
})

it('syncs Magic Hide across spells and companion controls and marks only the affected AC', () => {
  const cat = content('companion', 'Cat', { strength: 2, dexterity: 3, constitution: 1, hp: 6, size: 'Small', speed: 35 })
  const c: Character = { ...base, companions: [{ id: 'a', type: 'Cat', name: 'A' }, { id: 'b', type: 'Cat', name: 'B' }],
    activeSpells: ['Keen Smell'], spells: [{ name: 'Magic Hide', rank: 1, cantrip: false }] }
  for (const active of [true, false]) {
    const changed = { ...c, ...magicHideChange(c, active, 'b') }
    const minions = renderToStaticMarkup(<MinionsSection c={changed} entries={[cat]} save={() => {}} />)
    const spells = renderToStaticMarkup(<SpellsSection c={changed} entries={[cat]} save={() => {}} />)
    expect(minions).toContain(`aria-label="Magic Hide on B"${active ? ' checked=""' : ''}`)
    expect(spells).toContain(`aria-label="Magic Hide active"${active ? ' checked=""' : ''}`)
    expect(minions.match(/title="\+1 Status \(Magic Hide\)"/g) ?? []).toHaveLength(active ? 1 : 0)
    expect(changed.activeSpells).toContain('Keen Smell')
    if (active) expect(minions).toMatch(/title="\+1 Status \(Magic Hide\)">\d+\*<\/b>/)
  }
})

it('targets Canopy Crawler at one creature before rank five and both at rank five, matching highest speed', () => {
  const cat = content('companion', 'Cat', { size: 'Small', speed_raw: '35 feet, fly 50 feet, climb 10 feet' })
  const c: Character = { ...base, level: 8, className: 'Ranger',
    companions: [{ id: 'a', type: 'Cat', name: 'A' }, { id: 'b', type: 'Cat', name: 'B' }],
    spells: [{ name: 'Canopy Crawler', rank: 2, cantrip: false }], activeSpells: ['Canopy Crawler'],
    canopyCrawlerCompanionId: 'b', canopyCrawlerTarget: 'Self' }
  const stats = (character: Character, id = 'b') => companionStats(character, [cat], 'Cat', undefined, id)!
  expect(movementSpeeds(c, [])).toContainEqual({ name: 'Climb', feet: 25, source: 'Canopy Crawler' })
  expect(stats(c).speed).toBe('35 feet, fly 50 feet, climb 10 feet')
  const companionOnly: Character = { ...c, canopyCrawlerTarget: 'Companion' }
  expect(movementSpeeds(companionOnly, [])).toContainEqual({ name: 'Climb', feet: 25, source: 'Canopy Crawler' })
  expect(stats(companionOnly).speed).toBe('35 feet, fly 50 feet, climb 10 feet')
  expect(stats(companionOnly, 'a').canopyCrawler).toBe(false)
  expect(stats({ ...companionOnly, level: 9, canopyCrawlerCompanionId: 'removed' }, 'a').canopyCrawler).toBe(true)
  const both: Character = JSON.parse(JSON.stringify({ ...c, level: 9, canopyCrawlerTarget: 'Both' }))
  expect(movementSpeeds(both, [])).toContainEqual({ name: 'Climb', feet: 25, source: 'Canopy Crawler' })
  expect(stats(both).speed).toBe('35 feet, fly 50 feet, climb 50 feet')
  expect(stats({ ...both, canopyCrawlerTarget: 'Self' }).canopyCrawler).toBe(true)
  expect(stats({ ...both, level: 8 }).canopyCrawler).toBe(false)
  for (const patch of [{ activeSpells: [] }, { spells: [] }, { level: 2 }]) {
    expect(movementSpeeds({ ...both, ...patch }, [])).toEqual([{ name: 'Land', feet: 25 }])
    expect(stats({ ...both, ...patch }).speed).toBe(cat.data.speed_raw)
  }
  const minions = renderToStaticMarkup(<MinionsSection c={both} entries={[cat]} save={() => {}} />)
  expect(minions).toContain('aria-label="Canopy Crawler on B" checked=""')
  expect(minions).not.toContain('aria-label="Canopy Crawler on A" checked=""')
  expect(minions).toContain('climb 50 feet*')
  const noClimb = { ...cat, data: { ...cat.data, speed_raw: '35 feet, swim 40 feet' } }
  expect(companionStats(both, [noClimb], 'Cat', undefined, 'b')!.speed).toBe('35 feet, swim 40 feet, climb 40 feet')
})

it('enlarges only smaller companions, gating Huge at level seven and applying damage, reach and clumsy', () => {
  const cat = content('companion', 'Cat', { size: 'Small', strength: 2, dexterity: 3, speed: 35,
    companion_attacks: 'jaws|1d8 piercing|;claw|1d6 slashing|finesse;spines|1d4 piercing|ranged, range 30 feet' })
  const c: Character = { ...base, level: 6, companions: [{ id: 'a', name: 'A', type: 'Cat' }, { id: 'b', name: 'B', type: 'Cat' }],
    spells: [{ name: 'Enlarge Companion', rank: 2, cantrip: false }, { name: 'Magic Hide', rank: 1, cantrip: false }],
    activeSpells: ['Enlarge Companion'], enlargeCompanionId: 'b', enlargeCompanionSize: 'Huge' }
  const stats = (character: Character, entry = cat, id = 'b') => companionStats(character, [entry], 'Cat', undefined, id)!
  const normal = stats({ ...c, activeSpells: [] })
  const large = stats(c)
  expect(large).toMatchObject({ size: 'Large', clumsy: 1, enlarge: { damage: 2, reachIncrease: 5 } })
  expect(large.ac).toBe(normal.ac - 1)
  expect(large.reflex).toBe(normal.reflex - 1)
  expect(large.fortitude).toBe(normal.fortitude)
  expect(large.attacks[0]).toMatchObject({ attack: normal.attacks[0].attack, damage: '1d8+4 piercing' })
  expect(large.attacks[1]).toMatchObject({ attack: normal.attacks[1].attack - 1, damage: '1d6+5 slashing' })
  expect(large.attacks[2].damage).toBe(normal.attacks[2].damage)
  expect(large.skills.find((skill) => skill.name === 'Acrobatics')!.bonus)
    .toBe(normal.skills.find((skill) => skill.name === 'Acrobatics')!.bonus - 1)
  expect(stats(c, cat, 'a').enlarge).toBeUndefined()
  expect(stats({ ...c, enlargeCompanionId: 'removed' }, cat, 'a').enlarge).toBeDefined()
  const huge = { ...c, level: 7 }
  expect(stats(huge)).toMatchObject({ size: 'Huge', enlarge: { damage: 4, reachIncrease: 10 } })
  expect(stats({ ...huge, enlargeCompanionSize: 'Large' })).toMatchObject({ size: 'Large', enlarge: { damage: 2 } })
  expect(stats(huge, { ...cat, data: { ...cat.data, size: 'Tiny' } }).enlarge?.reachIncrease).toBe(15)
  expect(stats(c, { ...cat, data: { ...cat.data, size: 'Tiny' } }).enlarge?.reachIncrease).toBe(10)
  expect(stats({ ...c, activeSpells: ['Enlarge Companion', 'Magic Hide'], magicHideCompanionId: 'b' }).ac).toBe(normal.ac)
  for (const patch of [{ activeSpells: [] }, { spells: [] }, { level: 2 }])
    expect(stats({ ...c, ...patch }).enlarge).toBeUndefined()
  const markup = renderToStaticMarkup(<MinionsSection c={huge} entries={[cat]} save={() => {}} />)
  expect(markup).toContain('Huge*')
  expect(markup).toContain('+4 status melee damage; +10 feet reach; clumsy 1.')
  expect(markup).toContain('-1 Status (clumsy 1; Enlarge Companion)')
})

it('gives a naturally Large Sarkorian Direwolf no lower-rank Enlarge Companion effects', () => {
  const wolf = content('companion', 'Sarkorian Direwolf', { size: 'Large', fixed_size: true, strength: 2, dexterity: 3,
    speed: 35, companion_attacks: 'jaws|1d8 piercing|' })
  const c: Character = { ...base, level: 6, companions: [{ id: 'wolf', name: '', type: wolf.name }],
    spells: [{ name: 'Enlarge Companion', rank: 2, cantrip: false }], activeSpells: ['Enlarge Companion'], enlargeCompanionSize: 'Large' }
  const stats = (character: Character, entry = wolf) => companionStats(character, [entry], wolf.name)!
  expect(stats(c)).toEqual(stats({ ...c, activeSpells: [] }))
  const huge: Character = JSON.parse(JSON.stringify({ ...c, level: 7, enlargeCompanionSize: 'Huge' }))
  expect(stats(huge)).toMatchObject({ size: 'Huge', enlarge: { damage: 4, reachIncrease: 10 }, clumsy: 1 })
  for (const size of ['Huge', 'Gargantuan']) {
    const entry = { ...wolf, data: { ...wolf.data, size } }
    expect(stats(huge, entry)).toEqual(stats({ ...huge, activeSpells: [] }, entry))
  }
})

it('scales and gates official Oversized Throw and prevents enhancement editing', () => {
  const c = { ...base, className: 'Barbarian', raging: true, weapons: [], feats: [feat('Oversized Throw', 4)] }
  for (const [level, dice] of [[4, 1], [6, 1], [7, 2], [14, 2], [15, 3]]) {
    const character = { ...c, level }
    const weapon = ownedWeapons(character, []).find((weapon) => weapon.id === OVERSIZED_THROW.id)!
    expect(weaponAttack(character, [], weapon)).toMatchObject({ ability: 'dex', range: 20, damage: `${dice}d10+1 bludgeoning`, traits: ['Thrown'] })
  }
  for (const patch of [{ level: 3 }, { raging: false }, { raging: undefined }, { feats: [] }, { className: 'Ranger' }]) {
    expect(ownedWeapons({ ...c, ...patch }, []).map((weapon) => weapon.name)).not.toContain(OVERSIZED_THROW.name)
  }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('<strong>Oversized Throw</strong>')
  expect(markup).not.toContain('aria-label="Weapon material"')
  expect(markup).not.toContain('aria-label="Add property rune"')
  expect(markup).not.toContain('aria-label="Remove Oversized Throw"')
})

it('requires a two-handed hammer, spear, or polearm for Haft Striker and inherits compatible runes from its selected source', () => {
  const spear = content('weapon', 'Spear', { hands: 2, weapon_group: 'Spear', damage: '1d8 piercing' })
  const hammer = content('weapon', 'Hammer', { hands: 2, weapon_group: 'Hammer', damage: '1d12 bludgeoning' })
  const first: OwnedWeapon = { ...main, name: 'Spear', runes: ['Flaming', 'Wounding'] }
  const second: OwnedWeapon = { ...main, id: 'second', name: 'Hammer', potency: 2, striking: 2, runes: ['Frost'] }
  const c = { ...base, weapons: [first, second], feats: [feat('Haft Striker Stance', 4)] }
  const haft = ownedWeapons(c, [spear, hammer]).find((weapon) => weapon.name === HAFT_STRIKER_WEAPON.name)!
  expect(effectiveWeapon(c, [spear, hammer], haft)).toMatchObject({ potency: 3, striking: 1, runes: ['Flaming'] })
  expect(effectiveWeapon({ ...c, haftStrikerWeaponId: second.id }, [spear, hammer], haft)).toMatchObject({ potency: 2, striking: 2, runes: ['Frost'] })
  expect(effectiveWeapon({ ...c, weapons: [{ ...first, runes: ['Holy'] }] }, [spear, hammer],
    { ...haft, runes: ['Unholy'] }).runes).toEqual(['Holy'])
  const incompatible: ContentEntry['data'][] = [{ hands: 1 }, { weapon_group: 'Club' }, { weapon_type: 'Ranged' }]
  for (const data of incompatible) {
    expect(ownedWeapons({ ...c, weapons: [first] }, [{ ...spear, data: { ...spear.data, ...data } }]).map((weapon) => weapon.name)).not.toContain(HAFT_STRIKER_WEAPON.name)
  }
  expect(ownedWeapons({ ...c, feats: [] }, [spear, hammer]).map((weapon) => weapon.name)).not.toContain(HAFT_STRIKER_WEAPON.name)
})

it('makes Primal Nimbleness available to both classes and scales heritage and Ranger poison resistance', () => {
  const druidPoison = content('feat', 'Poison Resistance', { class: 'Druid', archetype: 'Assassin' }, 2, ['Alchemist', 'Druid'])
  const options = homebrewCharacterOptions([druidPoison])
  const nimble = options.find((entry) => entry.name === 'Primal Nimbleness')!
  const slot = plannedSlots({ ...base, className: 'Ranger' }).find((slot) => slot.category === 'class')!
  for (const className of ['Druid', 'Ranger']) {
    const c = { ...base, className, feats: [feat(nimble.name)] }
    expect(eligibleFeats(options, { ...c, feats: [] }, slot).map((entry) => entry.name)).toContain(nimble.name)
    expect(speed(c, [])).toBe(30)
  }
  const heritage = options.find((entry) => entry.kind === 'heritage')!
  expect(heritagesFor(options, 'Human')).toContain(heritage)
  expect(heritagesFor(options, 'Elf')).not.toContain(heritage)
  expect(resistances({ ...base, level: 1, heritage: heritage.name }, options)).toContainEqual({ damage: 'Fire', value: 1, source: heritage.name })
  expect(resistances({ ...base, level: 9, heritage: heritage.name }, options)).toContainEqual({ damage: 'Fire', value: 4, source: heritage.name })
  expect(resistances({ ...base, level: 10, feats: [feat('Poison Resistance', 2)] }, options)).toContainEqual({ damage: 'Poison', value: 5, source: 'Poison Resistance' })
  const markup = renderToStaticMarkup(<SkillsSection c={{ ...base, level: 20, feats: [feat('Poison Resistance', 2)] }}
    entries={options} save={() => {}} part="defense" />)
  expect(markup).toContain('title="Poison Resistance: +1 status bonus to saving throws against poisons.">Poison 10*</span>')
  expect(markup).not.toContain('Saving throws against poisons: +1 status bonus.</small>')
  expect(options.find((entry) => entry.id === 'homebrew:ranger-poison-resistance')?.traits).toEqual(['Ranger'])
  expect(druidPoison.traits).toEqual(['Alchemist', 'Druid'])
})

it('summarizes heritage, ancestry, subclass, and final level without duplicating ancestry', () => {
  const c = { ...base, ancestry: 'Human', heritage: 'Wintertouched Human', className: 'Ranger', subclass: 'Outwit', level: 20 }
  expect(characterSummary(c, [])).toBe('Wintertouched Human Outwit Ranger 20')
  expect(characterSummary({ ...c, heritage: 'Wintertouched' }, [])).toBe('Wintertouched Human Outwit Ranger 20')
})
