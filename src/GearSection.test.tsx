import { renderToStaticMarkup } from 'react-dom/server'
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ArmorList, ArmorUpgrades, armorUpgradeSlots, Augmentations, BulkLimits, HandwrapsGear, isSpecificGear, Search, ShieldAttachment, ShieldEquipment, WeaponList, WeaponUpgrades } from './GearSection'
import { AnimalFeatureOptions, ItemSpellUses } from './SpellsSection'
import { itemSpells, itemSpellUses } from './itemSpells'
import { activeAnimalFeatures, animalStrengthRuneSources, armorClass, armorDisplayName, armorUpgradeSlots as resolvedArmorUpgradeSlots,
  automaticArmorUpgradeSlotsUsed, automaticArmorUpgradeUsesSlot, automaticSpecificArmorUpgrades,
  armorUpgradeEntries, effectiveArmor, effectiveWeapon, equippedWeaponHands, featEffectChange, hardpointWeaponEligible, hasParryWeapon,
  installedWeaponUpgrades, inventiveOffensiveChange, movementSpeeds, offensiveDefenseAttack, ownedWeapons, parryValue,
  resistances, senses, spellActiveChange, totalHandCapacity, usesWeaponUpgrades, weaponAttack, weaponEquipped } from './builder'
import { INVENTOR_ARMOR_ID } from './grantedArmor'
import type { Character, ContentEntry, OwnedArmor, OwnedShield, OwnedWeapon } from './types'
import { ARMOR_GAUNTLETS, DISARMING_RUNE, GAUNTLET, GRAPPLING_MODULE, GRAPPLING_RUNE, SHOVING_MODULE, SHOVING_RUNE, HAFT_STRIKER_WEAPON, HANDWRAPS, HARDLIGHT_HANDWRAPS, IRUXI_CLAWS, IRUXI_FANGS, IRUXI_TAIL, OVERSIZED_THROW } from './supplemental'
import { getSettings, updateSettings } from './settings'
import { canEquipShield, equippedHands, equippedShield, hardwoodShield, ownedShields, shieldAcBonus, shieldBraceEligible, shieldBraceInstalled, shieldEquipChange, shieldRaisedChange } from './builder'
import { GearSystemFilter } from './GearSystemFilter'
import { SearchableSelect } from './SearchableSelect'
import { EntryDescription } from './EntryDescription'
import { DamageRoll, MultipleDamageRoll } from './SpellDamage'
import type { GearSystem } from './gearSystem'

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
const haftStance: ContentEntry = { ...HAFT_STRIKER_WEAPON, id: 'haft-feat', kind: 'feat', level: 4, traits: ['Fighter', 'Stance'] }
const character = (feats: Character['feats'], livingWeapon = false): Character => ({
  id: 'c', systems: ['pf2e'], name: 'Alex', level: 10, className: 'Fighter',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats, equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  weapons: [{ id: 'w', name: 'Longsword', potency: 3, striking: 1, runes: ['Wounding', 'Flaming'], livingWeapon }],
})

it('grants and scales requested Starfinder weapon upgrades without duplicating saved upgrades', () => {
  const upgrades = [
    ["Smuggler's Grip (Commercial)", 2], ["Smuggler's Grip (Tactical)", 6],
    ['Flaming Module (Commercial)', 8], ['Flaming Module (Tactical)', 15],
    ['Retrieval Boosters', 3], ['Shock Module (Commercial)', 8], ['Shock Module (Tactical)', 15],
    ['Loudener (Commercial)', 8], ['Loudener (Tactical)', 15],
    ['Suppression Matrix (Commercial)', 4], ['Suppression Matrix (Tactical)', 14],
    ['Glarecaster (Commercial)', 5], ['Glarecaster (Tactical)', 12],
    ["Sniper's Scope (Commercial)", 3], ["Sniper's Scope (Tactical)", 10],
    ['Fear Projector (Commercial)', 5], ['Fear Projector (Tactical)', 12],
  ].map(([name, level]) => ({ ...shifting, id: String(name), name: String(name), level: Number(level),
    systems: ['sf2e' as const], data: { item_subcategory: 'Weapon Upgrades' } }))
  const sfWeapon = (name: string): ContentEntry => ({ ...weapon, id: name, name, systems: ['sf2e'],
    traits: ['Tech'], data: { weapon_category: 'Martial', damage: '1d6 F', hands: 1, upgrade_slots: 4 } })
  const weapons = ['SLARP Rapid Laser Pistol', 'Shuriken Drone', 'Singing Spear', 'Battleglove', 'Doshko', 'Plasma Doshko', 'Plasma Array',
    'Crimson Claw', 'Shock Pad', 'Shock Truncheon', 'Plasma Sword', 'Plasma Caster', 'Tactical Plasma Caster', 'Rotolaser',
    'Pulse Gauntlet', 'Tailblade', 'Laser Rifle', 'Liminal Laser Rifle', 'Laser Focus Rifle', 'Liminal Focus Rifle', 'Other']
    .map(name => {
      const entry = sfWeapon(name)
      return name === 'Plasma Array' ? { ...entry, data: { ...entry.data, upgrade_slots: 3 } } : entry
    })
  weapons.push({ ...sfWeapon('Starday Night Special (Semi-Auto Pistol)'),
    data: { ...sfWeapon('Starday Night Special (Semi-Auto Pistol)').data, special_weapon_source: 'Starday Night Special' } })
  const entries = [...weapons, ...upgrades]
  const owned = (name: string, ids: string[] = []): OwnedWeapon => ({ id: name, name, potency: 0, striking: 0, runes: [], upgrades: ids })
  const at = (name: string, level: number, ids: string[] = [], className = 'Fighter') => installedWeaponUpgrades(
    { ...character([]), systems: ['sf2e'], level, className }, entries, owned(name, ids)).map(item => item.name)
  const previous = getSettings().automaticSfWeaponUpgrades
  try {
    updateSettings({ automaticSfWeaponUpgrades: true })
    expect(at('SLARP Rapid Laser Pistol', 1)).toEqual([])
    expect(at('SLARP Rapid Laser Pistol', 6)).toEqual(["Smuggler's Grip (Tactical)"])
    expect(at('Starday Night Special (Semi-Auto Pistol)', 1)).toEqual([])
    expect(at('Starday Night Special (Semi-Auto Pistol)', 2)).toEqual(["Smuggler's Grip (Commercial)"])
    expect(at('Starday Night Special (Semi-Auto Pistol)', 6)).toEqual(["Smuggler's Grip (Tactical)"])
    expect(at('SLARP Rapid Laser Pistol', 15, ['Flaming Module (Commercial)']))
      .toEqual(['Flaming Module (Tactical)', "Smuggler's Grip (Tactical)"])
    expect(at('Shuriken Drone', 3)).toEqual(['Retrieval Boosters'])
    expect(at('Singing Spear', 15)).toEqual(['Retrieval Boosters', 'Loudener (Tactical)'])
    expect(at('Battleglove', 3)).toEqual([])
    expect(at('Battleglove', 4)).toEqual(['Suppression Matrix (Commercial)'])
    expect(at('Battleglove', 13)).toEqual(['Suppression Matrix (Commercial)'])
    expect(at('Battleglove', 14)).toEqual(['Suppression Matrix (Tactical)'])
    expect(at('Doshko', 3)).toEqual([])
    expect(at('Doshko', 4)).toEqual(['Suppression Matrix (Commercial)'])
    expect(at('Doshko', 14)).toEqual(['Suppression Matrix (Tactical)'])
    expect(at('Plasma Doshko', 8)).toEqual([
      'Flaming Module (Commercial)', 'Shock Module (Commercial)', 'Glarecaster (Commercial)', 'Suppression Matrix (Commercial)',
    ])
    expect(at('Plasma Doshko', 15)).toEqual([
      'Flaming Module (Tactical)', 'Shock Module (Tactical)', 'Glarecaster (Tactical)', 'Suppression Matrix (Tactical)',
    ])
    expect(at('Crimson Claw', 8)).toEqual(['Flaming Module (Commercial)'])
    expect(at('Shock Pad', 8)).toEqual(['Shock Module (Commercial)'])
    expect(at('Shock Pad', 15)).toEqual(['Shock Module (Tactical)'])
    expect(at('Shock Truncheon', 8)).toEqual(['Shock Module (Commercial)'])
    expect(at('Plasma Sword', 8)).toEqual(['Flaming Module (Commercial)', 'Shock Module (Commercial)', 'Glarecaster (Commercial)'])
    expect(at('Rotolaser', 8)).toEqual(['Flaming Module (Commercial)'])
    expect(at('Rotolaser', 15)).toEqual(['Flaming Module (Tactical)'])
    expect(at('Plasma Array', 8)).toEqual(['Flaming Module (Commercial)', 'Shock Module (Commercial)'])
    expect(at('Plasma Array', 15)).toEqual(['Flaming Module (Tactical)', 'Shock Module (Tactical)'])
    expect(at('Plasma Caster', 6)).toEqual(["Smuggler's Grip (Tactical)"])
    expect(at('Tactical Plasma Caster', 8)).toEqual([
      "Smuggler's Grip (Tactical)", 'Flaming Module (Commercial)', 'Shock Module (Commercial)',
    ])
    expect(at('Plasma Caster', 15)).toEqual([
      "Smuggler's Grip (Tactical)", 'Flaming Module (Tactical)', 'Shock Module (Tactical)',
    ])
    expect(at('Pulse Gauntlet', 8)).toEqual(['Loudener (Commercial)'])
    expect(at('Pulse Gauntlet', 15)).toEqual(['Loudener (Tactical)'])
    expect(at('Tailblade', 4)).toEqual([])
    expect(at('Tailblade', 5)).toEqual(['Fear Projector (Commercial)'])
    expect(at('Tailblade', 11)).toEqual(['Fear Projector (Commercial)'])
    expect(at('Tailblade', 12)).toEqual(['Fear Projector (Tactical)'])
    expect(at('Tailblade', 5, [], 'Soldier')).toEqual(['Suppression Matrix (Commercial)'])
    expect(at('Tailblade', 13, [], 'Soldier')).toEqual(['Suppression Matrix (Commercial)'])
    expect(at('Tailblade', 14, [], 'Soldier')).toEqual(['Suppression Matrix (Tactical)'])
    for (const name of ['Laser Rifle', 'Liminal Laser Rifle', 'Laser Focus Rifle', 'Liminal Focus Rifle'])
      expect(at(name, 15)).toEqual(['Flaming Module (Tactical)', 'Glarecaster (Tactical)', "Sniper's Scope (Tactical)"])
    expect(at('Other', 20)).toEqual([])
    const c = { ...character([]), systems: ['sf2e' as const], level: 15,
      weapons: [owned('SLARP Rapid Laser Pistol')] }
    const html = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} />)
    expect(html).toContain('Flaming Module (Tactical)')
    expect(html).toContain("Smuggler&#x27;s Grip (Tactical)")
    expect(html).not.toContain('Remove Flaming Module (Tactical) upgrade')
    const doshko = entries.find(entry => entry.name === 'Doshko')!
    const oneSlotDoshko = { ...doshko, data: { ...doshko.data, upgrade_slots: 1 } }
    const doshkoCharacter = { ...character([]), systems: ['sf2e' as const], level: 8,
      weapons: [owned('Doshko')] }
    const doshkoHtml = renderToStaticMarkup(<WeaponList c={doshkoCharacter}
      entries={[...entries.filter(entry => entry.id !== doshko.id), oneSlotDoshko]} save={() => {}} />)
    expect(doshkoHtml).toContain('Suppression Matrix (Commercial)')
    expect(doshkoHtml).not.toContain('Add weapon upgrade')
    const plasmaArrayHtml = renderToStaticMarkup(<WeaponList
      c={{ ...character([]), systems: ['sf2e'], level: 8, weapons: [owned('Plasma Array')] }}
      entries={entries} save={() => {}} />)
    expect(plasmaArrayHtml).toContain('Flaming Module (Commercial)')
    expect(plasmaArrayHtml).toContain('Shock Module (Commercial)')
    expect(plasmaArrayHtml).toContain('Add weapon upgrade')
    expect(plasmaArrayHtml).not.toContain('Installed upgrades exceed available slots.')
    const caster = entries.find(entry => entry.name === 'Plasma Caster')!
    const casterEntries = [...entries.filter(entry => entry.id !== caster.id), { ...caster, data: { ...caster.data, upgrade_slots: 2 } }]
    const casterCharacter = { ...character([]), systems: ['sf2e' as const], level: 8, weapons: [owned('Plasma Caster')] }
    const casterHtml = renderToStaticMarkup(<WeaponList
      c={casterCharacter} entries={casterEntries}
      save={() => {}} />)
    expect(casterHtml).toContain("Smuggler&#x27;s Grip (Tactical)")
    expect(casterHtml).toContain('Flaming Module (Commercial)')
    expect(casterHtml).not.toContain('Shock Module (Commercial)')
    expect(casterHtml).not.toContain('Installed upgrades exceed available slots.')
    expect(casterHtml).not.toContain('Add weapon upgrade')
    const savedShock = owned('Plasma Caster', ['Shock Module (Commercial)'])
    expect(installedWeaponUpgrades(casterCharacter, casterEntries, savedShock).map(item => item.name))
      .toEqual(['Shock Module (Commercial)', "Smuggler's Grip (Tactical)"])
    updateSettings({ automaticSfWeaponUpgrades: false })
    expect(at('Shock Pad', 15)).toEqual([])
  } finally { updateSettings({ automaticSfWeaponUpgrades: previous }) }
})

it('lets installed Ultralight Wings be deployed and saves deployment state', () => {
  const wings: ContentEntry = { ...shifting, id: 'wings', name: 'Ultralight Wings (Tactical)', systems: ['sf2e'],
    data: { item_category: 'Augmentations' }, description: 'While deployed, you gain a fly Speed of 30 feet.' }
  const c: Character = { ...character([]), systems: ['sf2e'], augmentations: [
    { id: 'wings', entryId: wings.id, name: wings.name, slot: 'standard' },
  ] }
  let saved: Partial<Character> | undefined
  let tree: ReactNode
  function Inspect() {
    tree = Augmentations({ c, entries: [wings], save: patch => { saved = patch } })
    return tree
  }
  renderToStaticMarkup(<Inspect />)
  const toggle = findElement(tree, element => element.props['aria-label'] === `Deploy ${wings.name}`)!
  expect(toggle.props.checked).toBe(false)
  ;(toggle.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: true } })
  expect(saved?.augmentations).toEqual([expect.objectContaining({ id: 'wings', deployed: true })])
})

it("toggles Infused with Belkzen's Might on weapons and unarmed attacks and scales with historian feats", () => {
  const name = "Infused with Belkzen's Might"
  const c: Character = { ...character([
    { name: 'Tattooed Historian Dedication', type: 'Archetype Feat', level: 2 },
    { name, type: 'Archetype Feat', level: 6 },
    { name: 'Another Historian Feat', type: 'Archetype Feat', level: 8 },
    { name: 'Future Historian Feat', type: 'Archetype Feat', level: 12 },
  ]) }
  const historian = (name: string): ContentEntry => ({ ...weapon, id: name, name, kind: 'feat',
    data: { archetype: 'Tattooed Historian' } })
  const entries = [weapon, historian('Another Historian Feat'), historian('Future Historian Feat')]
  const active = { ...c, ...featEffectChange(c, name, true) }
  const bonus = (current: Character, owned: OwnedWeapon) => weaponAttack(current, entries, owned).additionalDamage.find(item => item.source === name)
  expect(bonus(c, c.weapons![0])).toBeUndefined()
  expect(bonus(active, c.weapons![0])).toMatchObject({ value: '2 spirit' })
  expect(bonus(active, { id: IRUXI_CLAWS.id, name: IRUXI_CLAWS.name, potency: 0, striking: 0, runes: [] })).toMatchObject({ value: '2 spirit' })
  expect(bonus({ ...active, level: 12 }, c.weapons![0])).toMatchObject({ value: '3 spirit' })
  expect(bonus({ ...active, feats: active.feats.filter(feat => feat.name !== name) }, c.weapons![0])).toBeUndefined()
  expect(bonus({ ...active, ...featEffectChange(active, name, false) }, c.weapons![0])).toBeUndefined()
})

it('adds active Fulminating Shot damage only to firearms and crossbows', () => {
  const firearm: ContentEntry = { ...weapon, id: 'firearm', name: 'Pistol',
    data: { weapon_category: 'Martial', weapon_type: 'Ranged', weapon_group: 'Firearm', damage: '1d6 piercing', range: 60 } }
  const crossbow: ContentEntry = { ...firearm, id: 'crossbow', name: 'Hand Crossbow', data: { ...firearm.data, weapon_group: 'Crossbow' } }
  const characterWithShot: Character = { ...character([{ name: 'Fulminating Shot', type: 'Archetype Feat', level: 6 }]),
    level: 12, fulminatingShotActive: true, fulminatingShotElement: 'Fire',
    weapons: [
      { id: 'pistol', name: 'Pistol', potency: 0, striking: 0, runes: [] },
      { id: 'crossbow', name: 'Hand Crossbow', potency: 0, striking: 0, runes: [] },
      { id: 'sword', name: 'Longsword', potency: 0, striking: 0, runes: [] },
    ] }
  const html = renderToStaticMarkup(<WeaponList c={characterWithShot} entries={[firearm, crossbow, weapon]} save={() => {}} displayOnly />)
  expect(html.match(/2d6 fire/g)).toHaveLength(2)
  const longswordCard = html.split('<div class="gear-card">').find(card => card.includes('>Longsword<'))
  expect(longswordCard).toContain('Damage 3d8 S')
  expect(longswordCard).not.toContain('fire')
})

it('shows Gravity Weapon only for the first weapon Strike and scales with weapon damage dice', () => {
  const c: Character = { ...character([{ name: 'Initiate Warden', type: 'Class Feat', level: 1, choice: 'Gravity Weapon' }]),
    className: 'Ranger', level: 1 }
  const sword = c.weapons![0]
  const active = { ...c, ...spellActiveChange(c, 'Gravity Weapon', true) }
  const bonus = (character: Character, owned: OwnedWeapon) => weaponAttack(character, [weapon], owned).additionalDamage
    .find(damage => damage.source === 'Gravity Weapon')
  expect(bonus(c, sword)).toBeUndefined()
  expect(bonus(active, { ...sword, striking: 0 })).toMatchObject({ value: '2' })
  expect(bonus(active, sword)).toMatchObject({ value: '4' })
  expect(bonus(active, { ...sword, striking: 3 })).toMatchObject({ value: '8' })
  expect(bonus({ ...active, feats: [] }, sword)).toBeUndefined()
  expect(bonus({ ...active, ...spellActiveChange(active, 'Gravity Weapon', false) }, sword)).toBeUndefined()
  expect(bonus(active, { id: IRUXI_CLAWS.id, name: IRUXI_CLAWS.name, potency: 0, striking: 0, runes: [] })).toBeUndefined()
  const html = renderToStaticMarkup(<WeaponList c={active} entries={[weapon]} save={() => {}} displayOnly />)
  expect(html).not.toContain('(Gravity Weapon)')
  expect(html).toContain('+ 4')
  expect(html).not.toContain('first weapon Strike each round')
})

it('uses Intelligence for eligible Investigator attacks while Devise a Stratagem is active', () => {
  const investigator: Character = { ...character([]), className: 'Investigator',
    abilities: { str: 10, dex: 16, con: 10, int: 18, wis: 10, cha: 10 }, deviseAStratagemActive: true }
  const rapier: ContentEntry = { ...weapon, id: 'rapier', name: 'Rapier', traits: ['Finesse'],
    data: { weapon_category: 'Martial', damage: '1d6 piercing' } }
  const sap: ContentEntry = { ...weapon, id: 'sap', name: 'Sap',
    data: { weapon_category: 'Simple', damage: '1d6 bludgeoning' } }
  const bow: ContentEntry = { ...weapon, id: 'shortbow', name: 'Shortbow',
    data: { weapon_category: 'Simple', weapon_type: 'Ranged', range: 60, damage: '1d6 piercing' } }
  const longsword: ContentEntry = { ...weapon, traits: [],
    data: { weapon_category: 'Martial', damage: '1d8 slashing' } }
  const javelin: ContentEntry = { ...weapon, id: 'javelin', name: 'Javelin', traits: ['Thrown 30 ft.'],
    data: { weapon_category: 'Simple', damage: '1d6 piercing' } }
  const attack = (entry: ContentEntry, thrown = false) => weaponAttack(investigator, [entry],
    { id: entry.id, name: entry.name, potency: 0, striking: 0, runes: [] }, thrown ? { thrown: true } : {})
  expect(attack(rapier)).toMatchObject({ ability: 'int', mod: 4 })
  expect(attack(sap)).toMatchObject({ ability: 'int', mod: 4 })
  expect(attack(bow)).toMatchObject({ ability: 'int', mod: 4 })
  expect(attack(longsword)).toMatchObject({ ability: 'str', mod: 0 })
  expect(attack(javelin, true)).toMatchObject({ ability: 'dex', mod: 3 })
  expect(attack(rapier).breakdown.parts[0]).toMatchObject({ label: 'Intelligence', note: 'Devise a Stratagem' })
  const ownedRapier: OwnedWeapon = { id: rapier.id, name: rapier.name, potency: 0, striking: 0, runes: [] }
  const markup = renderToStaticMarkup(<WeaponList c={{ ...investigator, weapons: [ownedRapier] }} entries={[rapier]}
    save={() => {}} />)
  expect(markup).toContain('<small>Intelligence</small>+4')
  expect(markup).not.toContain('<small>Strength</small>+4')
  expect(weaponAttack({ ...investigator, deviseAStratagemActive: false }, [rapier],
    { id: rapier.id, name: rapier.name, potency: 0, striking: 0, runes: [] })).toMatchObject({ ability: 'dex', mod: 3 })
})

it('inherits Vesk tail traits and replaces its attack when the tailblade matches its damage', () => {
  const blade: ContentEntry = { ...weapon, id: 'tailblade', name: 'Tailblade', systems: ['sf2e'],
    traits: ['Agile', 'Finesse', 'Free-hand'], data: { weapon_category: 'Martial', hands: 0, damage: '1d4 slashing' } }
  const owned: OwnedWeapon = { id: 'blade', name: blade.name, potency: 0, striking: 0, runes: [] }
  const c: Character = { ...character([{ name: 'Brutal Anatomy', choice: 'Tail', type: 'Ancestry Feat', level: 1 }]),
    ancestry: 'Vesk', systems: ['sf2e'], level: 1, weapons: [owned] }
  const attack = weaponAttack(c, [blade], owned)
  expect(attack.traits).toEqual(expect.arrayContaining(['Agile', 'Finesse', 'Sweep', 'Trip', 'Versatile B']))
  expect(attack.traits).not.toContain('Unarmed')
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[blade]} save={() => {}} displayOnly />)
  expect(markup).toContain('Tailblade attack')
  expect(markup).not.toContain('Tail attack')
  expect(ownedWeapons(c, [blade]).some(item => item.id === 'sf2e:vesk:tail')).toBe(true)
  expect(weaponAttack({ ...c, feats: [] }, [blade], owned).traits).not.toContain('Versatile B')
  expect(renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [{ ...owned, stowed: true }] }} entries={[blade]}
    save={() => {}} displayOnly />)).not.toContain('Tail attack')
})

it('free-hand weapons inherit grapple and shove from available unarmed attacks', () => {
  const freehand: ContentEntry = { ...weapon, id: 'freehand-blade', name: 'Free-Hand Blade', traits: ['Free-hand'],
    data: { weapon_category: 'Martial', hands: 1, damage: '1d6 slashing' } }
  const claws: ContentEntry = { ...weapon, id: 'claw-attack', name: 'Claws', traits: ['Unarmed', 'Grapple', 'Shove', 'Parry'],
    data: { weapon_category: 'Unarmed', hands: 0, damage: '1d6 slashing' } }
  const blade: OwnedWeapon = { id: freehand.id, name: freehand.name, potency: 0, striking: 0, runes: [], stowed: false }
  const claw: OwnedWeapon = { id: claws.id, name: claws.name, potency: 0, striking: 0, runes: [], stowed: false }
  const c: Character = { ...character([]), weapons: [blade, claw] }
  const attack = weaponAttack(c, [freehand, claws], blade)
  expect(attack.traits).toEqual(expect.arrayContaining(['Grapple', 'Shove', 'Parry']))
  expect(weaponAttack(c, [{ ...freehand, traits: [] }, claws], blade).traits).not.toContain('Grapple')
})

it('inherits tail parry while retaining weaker or non-bludgeoning tails', () => {
  const blade: ContentEntry = { ...weapon, id: 'tailblade', name: 'Tailblade', systems: ['sf2e'],
    traits: ['Free-hand'], data: { weapon_category: 'Martial', hands: 0, damage: '1d6 slashing' } }
  const tail: ContentEntry = { ...weapon, id: 'custom-tail', name: 'Spiked Tail', kind: 'weapon', systems: ['sf2e'],
    traits: ['Parry', 'Trip', 'Unarmed'], data: { weapon_category: 'Unarmed', hands: 0, damage: '1d4 bludgeoning', granted_by_feat: 'Tail Feat' } }
  const owned: OwnedWeapon = { id: 'blade', name: blade.name, potency: 0, striking: 0, runes: [] }
  const c: Character = { ...character([{ name: 'Tail Feat', type: 'Ancestry Feat', level: 1 }]),
    systems: ['sf2e'], level: 1, weapons: [owned] }
  const check = (tailEntry: ContentEntry) => {
    const entries = [blade, tailEntry]
    return { attack: weaponAttack(c, entries, owned), markup: renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} displayOnly />) }
  }
  const weaker = check(tail)
  expect(weaker.attack.traits).toEqual(expect.arrayContaining(['Parry', 'Trip']))
  expect(weaker.attack.traits).not.toContain('Versatile B')
  expect(weaker.markup).toContain('Spiked Tail attack')
  const equal = check({ ...tail, data: { ...tail.data, damage: '1d6 bludgeoning' } })
  expect(equal.attack.traits).toContain('Versatile B')
  expect(equal.markup).not.toContain('Spiked Tail attack')
  const piercing = check({ ...tail, data: { ...tail.data, damage: '1d8 piercing' } })
  expect(piercing.attack.traits).not.toContain('Versatile B')
  expect(piercing.markup).toContain('Spiked Tail attack')
  const manyDice = check({ ...tail, data: { ...tail.data, damage: '2d4 bludgeoning' } })
  expect(manyDice.attack.traits).not.toContain('Versatile B')
  expect(manyDice.markup).toContain('Spiked Tail attack')
  expect(hasParryWeapon(c, [blade, tail])).toBe(true)
  expect(weaponAttack({ ...c, weapons: [{ ...owned, stowed: true }] }, [blade, tail], { ...owned, stowed: true }).traits).toContain('Parry')
})

it('shows target-limited Intensified Element Stance damage on weapon attacks', () => {
  const feat: ContentEntry = { ...weapon, id: 'element-stance', kind: 'feat',
    name: 'Intensified Element Stance', level: 6, traits: ['Stance'] }
  const c: Character = { ...character([{ name: feat.name, type: 'Class Feat', level: 6 }]),
    activeStance: feat.name, intensifiedElement: { element: 'Earth', used: true } }
  const render = (value: Character) => renderToStaticMarkup(<WeaponList c={value} entries={[weapon, feat]} save={() => {}} />)
  expect(render(c)).toContain('1d6 acid (conditional)')
  expect(render(c)).toContain('Only against water creatures.')
  expect(render({ ...c, activeStance: undefined })).not.toContain('1d6 acid (conditional)')
})

it.each([false, true])('applies Inventive Offensive to one held melee weapon (displayOnly=%s)', displayOnly => {
  const sword = { ...weapon, traits: ['Deadly d8', 'Versatile P'], data: { ...weapon.data, hands: '1' } }
  let c: Character = { ...character([{ name: 'Inventive Offensive', type: 'Ancestry Feat', level: 1 }]), level: 15,
    rankOverrides: { Crafting: 4 }, weapons: [
      { id: 'one', name: sword.name, potency: 0, striking: 0, runes: [] },
      { id: 'two', name: sword.name, potency: 0, striking: 0, runes: [] },
    ] }
  const tree = () => WeaponList({ c, entries: [sword], save: patch => { c = { ...c, ...patch } }, displayOnly })
  const control = (label: string) => findElement(tree(), e => e.props['aria-label'] === label)!
  const first = control('Inventive Offensive: Longsword')
  const options = renderToStaticMarkup(tree())
  expect(options).not.toContain('<option>Deadly d6</option>')
  expect(options).not.toContain('<option>Versatile B</option>')
  ;(first.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Trip' } })
  ;(control('Inventive Offensive second trait: Longsword').props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Shove' } })
  expect(weaponAttack(c, [sword], c.weapons![0]).traits).toEqual(expect.arrayContaining(['Trip', 'Shove']))
  expect(weaponAttack(c, [sword], c.weapons![1]).traits).not.toContain('Trip')
  expect(weaponAttack({ ...c, rankOverrides: { Crafting: 3 } }, [sword], c.weapons![0]).traits).not.toContain('Shove')
  expect(inventiveOffensiveChange({ ...c, rankOverrides: { Crafting: 3 } }, [sword]))
    .toEqual({ inventiveOffensive: { weaponId: 'one', traits: ['Trip'] } })
  expect(weaponAttack({ ...c, feats: [] }, [sword], c.weapons![0]).traits).not.toContain('Trip')
  const stowed = { ...c, weapons: c.weapons!.map((w, index) => index ? w : { ...w, stowed: true }) }
  expect(weaponAttack(stowed, [sword], stowed.weapons![0]).traits).not.toContain('Trip')
  expect(inventiveOffensiveChange(stowed, [sword])).toEqual({ inventiveOffensive: undefined })
  expect(inventiveOffensiveChange(c, [sword])).toEqual({})
})

it.each([false, true])('does not add conditional Blade of Law damage to weapon damage (displayOnly=%s)', displayOnly => {
  const c = character([])
  const trained = { ...c, feats: [{ name: 'Blade of Law', type: 'Archetype Feat', level: 10 }] }
  const render = (value: Character) => renderToStaticMarkup(<WeaponList c={value} entries={[weapon]} save={() => {}} displayOnly={displayOnly} />)
  expect(render(trained)).toBe(render(c))
})

it.each([
  { traits: [], grace: false, step: 5 },
  { traits: ['Agile'], grace: false, step: 4 },
  { traits: ['Agile'], grace: true, step: 3 },
  { traits: [], grace: true, step: 5 },
])('shows three attack bonuses for $traits with Agile Grace=$grace', ({ traits, grace, step }) => {
  const c: Character = { ...character(grace ? [{ name: 'Agile Grace', type: 'Class Feat', level: 10 }] : []),
    className: 'Champion', level: 20, abilities: { str: 26, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    weapons: [{ id: 'sword', name: 'Longsword', potency: 4, striking: 3, runes: [] }] }
  const entries: ContentEntry[] = [{ ...weapon, traits }, { ...weapon, id: 'champion', kind: 'class', name: 'Champion',
    data: { attack_proficiency: 'Master in martial weapons' } }]
  const attack = weaponAttack(c, entries, c.weapons![0])
  expect(attack.attack).toBe(38)
  expect(attack.multipleAttackPenalties).toEqual([0, -step, -2 * step])
  for (const displayOnly of [false, true]) {
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} displayOnly={displayOnly} />)
    expect(markup).toContain('aria-label="Longsword attack +38: show breakdown"')
    expect(markup).toContain(`</span>/+${38 - step}/+${38 - 2 * step}</span>`)
    expect(markup).not.toContain('aria-label="Flurry note"')
    if (grace && traits.includes('Agile')) expect(markup).toContain('0/-3/-6 (Agile Grace)')
  }
})

it('adds weapons unequipped without changing an existing equipped weapon', () => {
  let c = character([])
  const existing = c.weapons![0]
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = WeaponList({ c, entries: [weapon], save })
  const picker = findElement(tree, element => element.type === Search && element.props.kind === 'weapon')
  if (typeof picker?.props.onPick !== 'function') throw new Error('Weapon picker unavailable')
  picker.props.onPick(weapon)
  expect(c.weapons?.at(-1)).toMatchObject({ name: weapon.name, stowed: true })
  expect(weaponEquipped(c, [weapon], c.weapons!.at(-1)!)).toBe(false)
  expect(c.weapons![0]).toEqual(existing)
  expect(weaponEquipped(c, [weapon], c.weapons![0])).toBe(true)
})

it.each([false, true])('opens parameterized weapon trait definitions in both views (displayOnly=%s)', displayOnly => {
  const bow: ContentEntry = { ...weapon, id: 'longbow', name: 'Longbow', traits: ['Deadly d10', 'Volley 30 ft.'],
    data: { ...weapon.data, weapon_type: 'Ranged', range: 100, hands: '1+' } }
  const traits: ContentEntry[] = ['Deadly', 'Volley'].map(name => ({
    ...weapon, id: `trait-${name}`, name, kind: 'trait', description: `${name} trait rules.`, data: {},
  }))
  const c: Character = { ...character([]), deity: 'Erastil', divineIntercessions: { Erastil: ['moderate-boon'] },
    weapons: [{ id: 'bow', name: bow.name, potency: 0, striking: 0, runes: [] }] }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[bow, ...traits]} save={() => {}} displayOnly={displayOnly} />)
  for (const name of ['Deadly d10', 'Volley (if beneficial)'])
    expect(markup).toContain(`class="gear-trait" aria-haspopup="dialog">${name}</button>`)
  expect(markup).toContain('Deadly trait rules.')
  expect(markup).toContain('Volley trait rules.')
})

function OpenGearSearch({ tab = 'Standard', ...props }: Parameters<typeof Search>[0] & { tab?: 'Standard' | 'Specific' | 'All' }) {
  const tree = Search(props)
  if (tree.type === 'button' && isValidElement<{ onClick?: () => void }>(tree)) tree.props.onClick?.()
  const control = findElement(tree, element => element.props.role === 'tab' && element.props.children === tab)
  if (control?.props['aria-selected'] === false && typeof control.props.onClick === 'function') control.props.onClick()
  return tree
}

it('displays Orc Necksplitter Axe while keeping the canonical saved weapon name', () => {
  const axe: ContentEntry = { ...weapon, id: 'necksplitter', name: 'Orc Necksplitter', traits: ['Orc'],
    data: { weapon_category: 'Martial', damage: '1d8 slashing', weapon_group: 'Axe' } }
  const c = { ...character([]), weapons: [{ id: 'axe', name: axe.name, potency: 0, striking: 0, runes: [] }] }
  const picker = renderToStaticMarkup(<OpenGearSearch c={c} entries={[axe]} save={() => {}} kind="weapon"
    label="Add Weapon" onPick={() => {}} />)
  expect(picker).toContain('>Orc Necksplitter Axe</button>')
  for (const displayOnly of [false, true]) {
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={[axe]} save={() => {}} displayOnly={displayOnly} />)
    expect(markup).toContain('>Orc Necksplitter Axe</button>')
    expect(markup).toMatch(/Damage \d+d8 S/)
  }
  expect(c.weapons[0].name).toBe('Orc Necksplitter')
})

it.each(['weapon', 'armor', 'shield'] as const)('filters %s by system while respecting enabled systems', kind => {
  const entries: ContentEntry[] = [
    { ...weapon, kind, id: 'pf', name: 'Pathfinder Gear', systems: ['pf2e'] },
    { ...weapon, kind, id: 'sf', name: 'Starfinder Gear', systems: ['sf2e'] },
    { ...weapon, kind, id: 'shared', name: 'Shared Gear', systems: ['pf2e', 'sf2e'] },
  ]
  const render = (system: GearSystem, systems: Character['systems']) => {
    function InspectSearch() {
      const tree = OpenGearSearch({ c: { ...character([]), systems }, entries, save: () => {}, kind,
        label: 'Add Gear', onPick: () => {} })
      const filter = findElement(tree, element => element.type === GearSystemFilter)
      if (filter && filter.props.value !== system) (filter.props.onChange as (value: GearSystem) => void)(system)
      return tree
    }
    return renderToStaticMarkup(<InspectSearch />)
  }
  for (const [system, visible] of [
    ['both', ['Pathfinder Gear', 'Starfinder Gear', 'Shared Gear']],
    ['pf2e', ['Pathfinder Gear', 'Shared Gear']],
    ['sf2e', ['Starfinder Gear', 'Shared Gear']],
  ] as const) {
    const markup = render(system, ['pf2e', 'sf2e'])
    for (const entry of entries) expect(markup.includes(`>${entry.name}</button>`)).toBe(visible.some(name => name === entry.name))
  }
  const single = render('both', ['pf2e'])
  expect(single).toContain('>Pathfinder Gear</button>')
  expect(single).toContain('>Shared Gear</button>')
  expect(single).not.toContain('>Starfinder Gear</button>')
  expect(render('sf2e', ['pf2e'])).toContain(`No ${kind}s match.`)
})

it('filters added weapons by every selected trait', () => {
  const entries = [
    { ...weapon, id: 'laser-tech', name: 'Laser Tech Weapon', traits: ['Laser', 'Tech'] },
    { ...weapon, id: 'tech-agile', name: 'Tech Agile Weapon', traits: ['Tech', 'Agile'] },
    { ...weapon, id: 'laser-agile', name: 'Laser Agile Weapon', traits: ['Laser', 'Agile'] },
  ]
  function InspectSearch() {
    const tree = OpenGearSearch({ c: character([]), entries, save: () => {}, kind: 'weapon',
      label: 'Add Weapon', onPick: () => {} })
    const traits = findElement(tree, element => element.type === 'select' && element.props.multiple === true)
    if (traits && !(traits.props.value as string[]).length) {
      ;(traits.props.onChange as (event: { currentTarget: { selectedOptions: { value: string }[] } }) => void)(
        { currentTarget: { selectedOptions: [{ value: 'Laser' }, { value: 'Tech' }] } })
    }
    return tree
  }
  const markup = renderToStaticMarkup(<InspectSearch />)
  expect(markup).toContain('aria-label="Traits" multiple=""')
  expect(markup).toContain('Laser Tech Weapon')
  expect(markup).not.toContain('Tech Agile Weapon')
  expect(markup).not.toContain('Laser Agile Weapon')
})

it('resets gear pagination when the system changes', () => {
  const entries = Array.from({ length: 125 }, (_, index): ContentEntry => ({
    ...weapon, id: `armor-system-${index}`, kind: 'armor', systems: ['sf2e'],
    name: `System Armor ${String(index).padStart(3, '0')}`, data: { armor_category: 'Light', ac: 1 },
  }))
  function InspectSearch() {
    const tree = OpenGearSearch({ c: { ...character([]), systems: ['pf2e', 'sf2e'] }, entries,
      save: () => {}, kind: 'armor', label: 'Add Armor', onPick: () => {} })
    const filter = findElement(tree, element => element.type === GearSystemFilter)
    const more = findElement(tree, element => element.type === 'button'
      && Array.isArray(element.props.children) && element.props.children[0] === 'Show more (')
    if (filter?.props.value === 'both' && more) (more.props.onClick as () => void)()
    else if (filter?.props.value === 'both' && !more) (filter.props.onChange as (value: GearSystem) => void)('sf2e')
    return tree
  }
  const markup = renderToStaticMarkup(<InspectSearch />)
  expect(markup).toContain('System Armor 099')
  expect(markup).not.toContain('System Armor 100')
  expect(markup).toContain('Show more (25 left)')
})

it('preserves the first saved-by-name gear record when filtering duplicates', () => {
  const entries: ContentEntry[] = [
    { ...weapon, name: 'Duplicate', description: 'Pathfinder version' },
    { ...weapon, id: 'sf-duplicate', name: 'Duplicate', systems: ['sf2e'], description: 'Starfinder version' },
  ]
  function InspectSearch() {
    const tree = OpenGearSearch({ c: { ...character([]), systems: ['pf2e', 'sf2e'] }, entries,
      save: () => {}, kind: 'weapon', label: 'Add Weapon', onPick: () => {} })
    const filter = findElement(tree, element => element.type === GearSystemFilter)
    if (filter?.props.value === 'both') (filter.props.onChange as (value: GearSystem) => void)('sf2e')
    return tree
  }
  const markup = renderToStaticMarkup(<InspectSearch />)
  expect(markup).not.toContain('Starfinder version')
  expect(markup).not.toContain('>Duplicate</button>')
})

it('pages gear results and resets the page when searching', () => {
  const entries = Array.from({ length: 125 }, (_, index): ContentEntry => ({
    ...weapon, id: `armor-${index}`, kind: 'armor', name: `Test Armor ${String(index).padStart(3, '0')}`,
    data: { armor_category: 'Light', ac: 1 },
  }))
  const props = { c: character([]), entries, save: () => {}, kind: 'armor' as const, label: 'Add Armor', onPick: () => {} }
  const render = (expand: boolean, search: boolean) => {
    function InspectSearch() {
      const tree = Search(props)
      if (tree.type === 'button') {
        ;(tree.props.onClick as () => void)()
        return tree
      }
      const input = findElement(tree, element => element.props['aria-label'] === 'Search armors')
      const more = findElement(tree, element => element.type === 'button'
        && Array.isArray(element.props.children) && element.props.children[0] === 'Show more (')
      if (expand && input?.props.value === '' && more) (more.props.onClick as () => void)()
      else if (search && input?.props.value === '' && !more) {
        ;(input.props.onChange as (event: unknown) => void)({ target: { value: 'test armor' } })
      }
      return tree
    }
    return renderToStaticMarkup(<InspectSearch />)
  }
  const initial = render(false, false)
  expect(initial).toContain('Test Armor 099')
  expect(initial).not.toContain('Test Armor 100')
  expect(initial).toContain('Show more (25 left)')
  const expanded = render(true, false)
  expect(expanded).toContain('Test Armor 124')
  expect(expanded).not.toContain('Show more')
  const searched = render(true, true)
  expect(searched).toContain('Test Armor 099')
  expect(searched).not.toContain('Test Armor 100')
  expect(searched).toContain('Show more (25 left)')
})

it.each([
  { tab: 'Standard', visible: ['Longsword', 'Custom Longsword'] },
  { tab: 'Specific', visible: ['Magic Longsword', 'Enchanted Custom Longsword'] },
  { tab: 'All', visible: ['Longsword', 'Custom Longsword', 'Enchanted Custom Longsword', 'Magic Longsword'] },
] as const)('includes homebrew weapons in $tab without a separate Custom tab', ({ tab, visible }) => {
  const custom: ContentEntry = { ...weapon, id: 'custom-sword', name: 'Custom Longsword', source: 'homebrew' }
  const magical: ContentEntry = { ...custom, id: 'custom-magic-sword', name: 'Enchanted Custom Longsword', traits: ['Magical'] }
  const officialMagic: ContentEntry = { ...weapon, id: 'magic-sword', name: 'Magic Longsword', traits: ['Magical'] }
  const entries = [weapon, custom, magical, officialMagic]
  const markup = renderToStaticMarkup(<OpenGearSearch c={character([])} entries={entries} save={() => {}}
    kind="weapon" label="Add Weapon" onPick={() => {}} tab={tab} />)
  expect(markup).not.toContain('>Custom</button>')
  for (const entry of entries) expect(markup.includes(`aria-haspopup="dialog">${entry.name}</button>`))
    .toBe(visible.some(name => name === entry.name))
})

it('keeps granted weapons out of the add-weapon picker', () => {
  const granted: ContentEntry = { ...weapon, id: 'granted-sword', name: 'Granted Sword',
    data: { ...weapon.data, granted_by_feat: true } }
  const markup = renderToStaticMarkup(<OpenGearSearch c={character([])} entries={[granted]} save={() => {}}
    kind="weapon" label="Add Weapon" onPick={() => {}} />)
  expect(markup).not.toContain('Granted Sword')
})

it('shows specific magic item base types in the picker without changing saved names', () => {
  const armor: ContentEntry = { ...weapon, id: 'embrace', kind: 'armor', name: 'Ancestral Embrace', traits: ['Magical'],
    data: { named_armor: true, named_armor_base: 'Leather Armor', armor_category: 'Light' } }
  const markup = renderToStaticMarkup(<OpenGearSearch c={character([])} entries={[armor]} save={() => {}}
    kind="armor" label="Add Armor" onPick={() => {}} tab="Specific" />)
  expect(markup).toContain('>Ancestral Embrace Leather Armor</button>')
  expect(armor.name).toBe('Ancestral Embrace')
})

it.each(['armor', 'shield'] as const)('includes homebrew %s in Standard without a Custom tab', kind => {
  const custom: ContentEntry = { ...weapon, id: 'custom-gear', name: 'Custom Gear', kind, source: 'homebrew',
    data: kind === 'armor' ? { armor_category: 'Light', ac: 1 } : {} }
  const render = (tab: 'Standard' | 'Specific') => renderToStaticMarkup(<OpenGearSearch c={character([])}
    entries={[custom]} save={() => {}} kind={kind} label="Add Gear" onPick={() => {}} tab={tab} />)
  expect(render('Standard')).not.toContain('>Custom</button>')
  expect(render('Standard')).toContain('aria-haspopup="dialog">Custom Gear</button>')
  expect(render('Specific')).not.toContain('aria-haspopup="dialog">Custom Gear</button>')
})

it.each(['unmet', 'automatic', 'approved'])('only shows unmet gear access helper text (%s)', state => {
  const restricted: ContentEntry = { ...weapon, name: 'Restricted Longsword', traits: ['Uncommon'],
    data: { ...weapon.data, access: 'Kellid ethnicity' } }
  const c: Character = { ...character([]), ethnicity: state === 'automatic' ? 'Kellid' : undefined,
    gearAccessOverrides: state === 'approved' ? [restricted.id] : [] }
  const markup = renderToStaticMarkup(<OpenGearSearch c={c} entries={[restricted]} save={() => {}} kind="weapon"
    label="Add Weapon" onPick={() => {}} />)
  expect(markup).toContain(restricted.name)
  expect(markup.includes('Access: Kellid ethnicity (not met)')).toBe(state === 'unmet')
  expect(markup.includes('Meet Access or obtain GM approval before adding.')).toBe(state === 'unmet')
  expect(markup.includes('aria-label="GM approved access to Restricted Longsword"')).toBe(state === 'unmet')
  expect(markup.includes('Approve access</label>')).toBe(state === 'unmet')
  expect(markup).not.toContain('GM approved access</label>')
  expect(markup).not.toContain('(met')
  expect(markup).not.toContain('(GM approved)')
  if (state === 'approved') expect(c.gearAccessOverrides).toEqual([restricted.id])
})

it.each(['Uncommon', 'Rare', 'Unique'])('allows %s gear without a specific Access requirement', rarity => {
  const c = character([])
  for (const kind of ['weapon', 'armor', 'shield'] as const) {
    const entry: ContentEntry = { ...weapon, kind, traits: [rarity], data: { ...weapon.data, rarity } }
    const markup = renderToStaticMarkup(<OpenGearSearch c={c} entries={[entry]} save={() => {}} kind={kind}
      label="Add Gear" onPick={() => {}} />)
    expect(markup).toContain('>Add</button>')
    expect(markup).not.toContain('disabled=""')
    expect(markup).not.toContain('Approve access')
    expect(markup).not.toContain('Meet Access or obtain GM approval')
  }
  expect(c.gearAccessOverrides).toBeUndefined()
})

it.each([false, true])('shows the Oversized Throw damage roll in both views (displayOnly=%s)', displayOnly => {
  const c = { ...character([{ name: 'Oversized Throw', type: 'Class Feat', level: 4 }]), className: 'Barbarian', raging: true }
  const longsword = { ...weapon, name: 'Longsword', data: { ...weapon.data, hands: 1 } }
  const tree = WeaponList({ c, entries: [longsword], save: () => {}, displayOnly })
  const markup = renderToStaticMarkup(tree)
  expect(markup).toContain('aria-label="Roll Oversized Throw: Damage"')
  expect(markup).toContain('title="Two Actions; Damage: 2d10 bludgeoning"')
  expect(weaponAttack(c, [], { id: OVERSIZED_THROW.id, name: OVERSIZED_THROW.name, potency: 0, striking: 0, runes: [] }).damage)
    .toBe('2d10 bludgeoning')
})

it('provides rule dialogs on weapon, armor, shield and handwrap names', () => {
  const sword = { ...weapon, description: 'Longsword rules.' }
  const armor: ContentEntry = { ...weapon, id: 'armor', kind: 'armor', name: 'Leather Armor', description: 'Leather armor rules.',
    data: { armor_category: 'Light', ac: 1 } }
  const shield: ContentEntry = { ...weapon, id: 'shield', kind: 'shield', name: 'Steel Shield', description: 'Steel shield rules.' }
  const c: Character = { ...character([]),
    armors: [{ id: 'a', name: armor.name, potency: 0, resilient: 0, runes: [], worn: true }],
    shield: { id: 's', name: shield.name, hardness: 5, hp: 20, damage: 0, raised: false },
    handwraps: { potency: 0, striking: 0, runes: [] } }
  const entries = [sword, armor, shield]
  const before = JSON.stringify(c)
  const markup = renderToStaticMarkup(<><WeaponList c={c} entries={entries} save={() => {}} />
    <ArmorList c={c} entries={entries} save={() => {}} /><HandwrapsGear c={c} entries={entries} save={() => {}} /></>)
  for (const name of ['Longsword', 'Leather Armor', 'Steel Shield', 'Handwraps of Mighty Blows']) {
    expect(markup).toContain(`aria-haspopup="dialog">${name}</button>`)
  }
  for (const entry of entries) expect(markup).toContain(entry.description)
  expect(JSON.stringify(c)).toBe(before)
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
  expect(renderToStaticMarkup(WeaponList({ c, entries, save, displayOnly }))).not.toContain('Unequip another weapon first.')
  expect(input('Fist')).toBeUndefined()
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
  expect(renderToStaticMarkup(tree())).not.toContain('Hands used:')
  expect(renderToStaticMarkup(tree())).not.toContain('aria-label="Active hands"')
  expect(renderToStaticMarkup(tree())).not.toContain('Hand pair:')
  expect(c.weapons![0].handPair).toBe(1)
})

it('lists non-removable granted augmentations without using implant slots', () => {
  const c: Character = { ...character([]), systems: ['sf2e'], ancestry: 'Ysoki', heritage: 'Test-Subject Ysoki',
    testSubjectAdaptation: 'Cybernetic Augmentation',
    feats: [{ name: 'Rat Retinal HUD', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0' }] }
  const markup = renderToStaticMarkup(<Augmentations c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('<section class="equipment-group" aria-label="Augmentations">')
  expect(markup).toContain('Datajack')
  expect(markup).toContain('Autorecognition Lens')
  expect(markup).toContain('(Rat Retinal HUD)')
  expect(markup).toContain('Augmentations <small aria-label="Augmentation capacity">0/')
  expect(markup).not.toContain('Implant limit:')
  expect(markup).not.toContain('Apex augmentations do not count')
  expect(markup).not.toContain('Augmentation effects are not applied automatically')
  expect(markup).not.toContain('Remove</button>')
  const removed = renderToStaticMarkup(<Augmentations c={{ ...c, testSubjectAdaptation: undefined, feats: [] }} entries={[]} save={() => {}} />)
  expect(removed).not.toContain('Datajack')
  expect(removed).not.toContain('Autorecognition Lens')
})

it('scales the granted Test-Subject Datajack at its grade levels', () => {
  const previous = getSettings().testSubjectDatajackScaling
  try {
    updateSettings({ testSubjectDatajackScaling: true })
    const c: Character = { ...character([]), systems: ['sf2e'], ancestry: 'Ysoki',
      heritage: 'Test-Subject Ysoki', testSubjectAdaptation: 'Cybernetic Augmentation' }
    for (const [level, grade] of [[1, 'Commercial'], [3, 'Commercial'], [4, 'Tactical'], [7, 'Tactical'], [8, 'Advanced'], [14, 'Advanced'], [15, 'Superior'], [20, 'Superior']] as const) {
      const markup = renderToStaticMarkup(<Augmentations c={{ ...c, level }} entries={[]} save={() => {}} />)
      expect(markup).toContain(`Datajack (${grade})`)
      expect(markup).not.toContain('Remove Datajack')
    }
    updateSettings({ testSubjectDatajackScaling: false })
    expect(renderToStaticMarkup(<Augmentations c={{ ...c, level: 20 }} entries={[]} save={() => {}} />))
      .not.toContain('Datajack (Superior)')
  } finally {
    updateSettings({ testSubjectDatajackScaling: previous })
  }
})

it('shows augmentation slot sources only when capacity is modified', () => {
  const c: Character = { ...character([]), systems: ['sf2e'], ancestry: 'Ysoki', heritage: 'Cyborg',
    feats: [{ name: 'Augmented Shell', type: 'Ancestry Feat', level: 1 }] }
  const html = renderToStaticMarkup(<Augmentations c={c} entries={[]} save={() => {}} />)
  expect(html).toContain('aria-label="Augmentation slots note"')
  expect(html).toContain('+4 Cyborg')
  expect(html).toContain('+2 Augmented Shell')
  expect(html).toContain('0/10')
  expect(renderToStaticMarkup(<Augmentations c={{ ...c, heritage: undefined, feats: [] }} entries={[]} save={() => {}} />))
    .not.toContain('aria-label="Augmentation slots note"')
})

it('tracks daily-use augmentation pips and removes spent state with the augmentation', () => {
  const augmentation: ContentEntry = { ...weapon, id: 'artificial-immortalizer', name: 'Artificial Immortalizer',
    kind: 'item', level: 17, systems: ['sf2e'], data: { item_category: 'Augmentations',
      item_activation_action_ids: '179-life-buffer' } }
  const nonDaily: ContentEntry = { ...augmentation, id: 'speed-suspension', name: 'Speed Suspension',
    data: { item_category: 'Augmentations', item_daily_uses: false } }
  let c: Character = { ...character([]), systems: ['sf2e'], augmentations: [
    { id: 'installed-immortalizer', entryId: augmentation.id, name: augmentation.name, slot: 'standard' },
    { id: 'installed-suspension', entryId: nonDaily.id, name: nonDaily.name, slot: 'standard' },
  ] }
  let tree: ReactNode = null
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const markup = () => {
    function Inspect() {
      tree = Augmentations({ c, entries: [augmentation, nonDaily], save })
      return tree
    }
    return renderToStaticMarkup(<Inspect />)
  }
  const initialMarkup = markup()
  expect(initialMarkup).toContain('aria-label="1 of 1 uses remaining"')
  expect(initialMarkup).not.toContain('Spend Speed Suspension use')
  const spend = findElement(tree, element => element.type === 'button'
    && element.props['aria-label'] === 'Spend Artificial Immortalizer use 1')!
  ;(spend.props.onClick as () => void)()
  expect(c.augmentationDailyUses?.['installed-immortalizer']).toBe(true)
  expect(markup()).toContain('aria-label="0 of 1 uses remaining"')
  const restore = findElement(tree, element => element.type === 'button'
    && element.props['aria-label'] === 'Restore Artificial Immortalizer use 1')!
  ;(restore.props.onClick as () => void)()
  expect(c.augmentationDailyUses?.['installed-immortalizer']).toBe(false)
  markup()
  const spendAgain = findElement(tree, element => element.type === 'button'
    && element.props['aria-label'] === 'Spend Artificial Immortalizer use 1')!
  ;(spendAgain.props.onClick as () => void)()
  const remove = findElement(tree, element => element.type === 'button'
    && element.props['aria-label'] === 'Remove Artificial Immortalizer augmentation')!
  ;(remove.props.onClick as () => void)()
  expect(c.augmentations?.map(item => item.id)).toEqual(['installed-suspension'])
  expect(c.augmentationDailyUses).toEqual({})
})

it('shares Presence Intensifier use pips between augmentations and spells', () => {
  const previous = getSettings().presenceIntensifierDaily
  try {
    updateSettings({ presenceIntensifierDaily: true })
    const presence: ContentEntry = { ...shifting, id: 'presence', name: 'Presence Intensifier', systems: ['sf2e'],
      level: 17, traits: ['Apex'], data: { item_category: 'Augmentations' } }
    let c: Character = { ...character([{ name: 'Finely Tuned', type: 'Archetype Feat', level: 6,
      choice: presence.name }]), systems: ['sf2e'], level: 17, weapons: [],
      augmentations: [{ id: 'installed', entryId: presence.id, name: presence.name, slot: 'apex' }] }
    let tree: ReactNode = null
    const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
    const markup = () => {
      function Inspect() {
        tree = Augmentations({ c, entries: [presence], save })
        return tree
      }
      return renderToStaticMarkup(<Inspect />)
    }
    expect(markup()).toContain('aria-label="2 of 2 uses remaining"')
    const spell = itemSpells(c, [presence])[0]
    ;(findElement(tree, element => element.type === 'button'
      && element.props['aria-label'] === 'Spend Presence Intensifier use 1')!.props.onClick as () => void)()
    expect(itemSpellUses(c, spell)).toMatchObject({ remaining: 1, spent: [0] })
    const spellTracker = ItemSpellUses({ c, save, spell })
    ;(findElement(spellTracker, element => element.type === 'button'
      && element.props['aria-label'] === 'Spend Suggestion (Presence Intensifier) use 2')!.props.onClick as () => void)()
    expect(markup()).toContain('aria-label="0 of 2 uses remaining"')
    ;(findElement(tree, element => element.type === 'button'
      && element.props['aria-label'] === 'Remove Presence Intensifier augmentation')!.props.onClick as () => void)()
    expect(c.itemSpellUses).toEqual({})
  } finally {
    updateSettings({ presenceIntensifierDaily: previous })
  }
})

it('omits biotech upgrade helper text from granted and installed augmentations', () => {
  const c: Character = { ...character([
    { name: 'Biotech OS Upgrade', type: 'Class Feat', level: 1 },
    { name: 'Rat Retinal HUD', type: 'Ancestry Feat', level: 1 },
  ]), systems: ['sf2e'], ancestry: 'Ysoki', heritage: 'Test-Subject Ysoki',
  testSubjectAdaptation: 'Cybernetic Augmentation',
  augmentations: [{ id: 'cybernetic', entryId: 'cybernetic', name: 'Dermal Plating', slot: 'standard' }] }
  const cybernetic: ContentEntry = { ...shifting, id: 'cybernetic', name: 'Dermal Plating', systems: ['sf2e'],
    data: { item_category: 'Augmentations', item_subcategory: 'Cybernetics' } }
  const markup = renderToStaticMarkup(<Augmentations c={c} entries={[cybernetic]} save={() => {}} />)
  expect(markup).not.toContain('This cybernetic augmentation has the biotech trait instead of the tech trait.')
  expect(markup).not.toContain('(Biotech OS Upgrade)')
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

it('shows augmentation descriptions in the picker without installing until selected', () => {
  const augmentation: ContentEntry = { ...weapon, id: 'cognition', name: 'Cognition Accelerator', kind: 'item',
    systems: ['sf2e'], level: 5, description: 'Improves trained skills.', data: { item_category: 'Augmentations' } }
  let c: Character = { ...character([]), systems: ['sf2e'], augmentations: [] }
  let picker: ReactElement<Record<string, unknown>> | undefined
  function Inspect() {
    const tree = Augmentations({ c, entries: [augmentation], save: patch => { c = { ...c, ...patch } } })
    picker = findElement(tree, element => element.type === SearchableSelect)
    return tree
  }
  renderToStaticMarkup(<Inspect />)
  expect(picker?.props.primaryDetails).toBe(true)
  const details = (picker!.props.renderDetails as (value: string) => ReactNode)(augmentation.id)
  const html = renderToStaticMarkup(<>{details}</>)
  expect(html).toContain('Cognition Accelerator')
  expect(html).not.toContain('Improves trained skills.')
  expect(html).toContain('aria-haspopup="dialog"')
  const description = findElement(details, element => element.type === EntryDescription)!
  expect(description.props.deferDetails).toBe(true)
  expect(renderToStaticMarkup(cloneElement(description, { deferDetails: false }))).toContain('Improves trained skills.')
  expect(c.augmentations).toEqual([])
  ;(picker!.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: augmentation.id } })
  expect(c.augmentations).toEqual([expect.objectContaining({ entryId: augmentation.id, name: augmentation.name })])
})

it('does not grant the Test-Subject Datajack to Cyborg', () => {
  const previous = getSettings().cyborgTestSubject
  const c: Character = { ...character([]), systems: ['sf2e'], ancestry: 'Ysoki', heritage: 'Cyborg' }
  try {
    updateSettings({ cyborgTestSubject: true })
    expect(renderToStaticMarkup(<Augmentations c={c} entries={[]} save={() => {}} />)).not.toContain('Datajack')
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
      .not.toContain('Hands used:')
  } finally { updateSettings({ singleAdditionalArms: previous }) }
})

it.each([false, true])('hides dependent shield attack Equip controls and retains shared shield state (displayOnly=%s)', displayOnly => {
  const sword = { ...weapon, data: { ...weapon.data, hands: 1 } }
  let c: Character = { ...character([]), weapons: [{ id: 'sword', name: sword.name, potency: 0, striking: 0, runes: [] }],
    shield: { id: 'steel', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: true, equipped: false,
      attachedWeapon: { id: 'boss', name: 'Shield Boss', potency: 0, striking: 0, runes: [], attachedTo: 'steel' } } }
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const control = () => findElement(WeaponList({ c, entries: [sword], save, displayOnly }),
    element => element.props['aria-label'] === 'Equipped Shield Boss (Attached to Steel Shield)')
  const toggle = (checked: boolean) => save(shieldEquipChange(c, c.shield!, checked))
  const attack = () => ownedWeapons(c, [sword]).find(weapon => weapon.id === 'boss')!
  expect(control()).toBeUndefined()
  expect(weaponEquipped(c, [sword], attack())).toBe(false)
  toggle(true)
  expect(control()).toBeUndefined()
  expect(weaponEquipped(c, [sword], attack())).toBe(true)
  expect(equippedShield(c)?.id).toBe('steel')
  expect(equippedHands(c, [sword])).toBe(2)
  for (const Component of [ShieldEquipment, ArmorList]) {
    expect(renderToStaticMarkup(<Component c={c} entries={[sword]} save={save} />))
      .toContain('aria-label="Equipped Steel Shield" checked=""')
  }
  toggle(false)
  expect(weaponEquipped(c, [sword], attack())).toBe(false)
  expect(equippedShield(c)).toBeUndefined()
  expect(c.shield?.raised).toBe(false)
  expect(equippedHands(c, [sword])).toBe(1)
  c = { ...c, shield: { ...c.shield!, attachedWeapon: undefined } }
  expect(findElement(WeaponList({ c, entries: [sword], save, displayOnly }),
    element => element.props['aria-label'] === 'Equipped Shield Bash (Attached to Steel Shield)')).toBeUndefined()
  toggle(true)
  const bash = ownedWeapons(c, [sword]).find(weapon => weapon.id === 'shield-bash:steel')!
  expect(weaponEquipped(c, [sword], bash)).toBe(true)
  expect(equippedShield(c)?.id).toBe('steel')
})

it.each([false, true])('hides automatic unarmed, Free-Hand and source-dependent Equip checkboxes (displayOnly=%s)', displayOnly => {
  const spear = { ...weapon, name: 'Spear', data: { ...weapon.data, hands: 2, weapon_group: 'Spear' } }
  const freeHand = { ...weapon, id: 'free', name: 'Free-Hand Blade', traits: ['Free-Hand'], data: { ...weapon.data, hands: 1 } }
  const c: Character = { ...character([
    { name: 'Haft Striker Stance', type: 'Class Feat', level: 4 },
    { name: 'Oversized Throw', type: 'Class Feat', level: 4 },
  ]), raging: true, className: 'Barbarian', activeStance: haftStance.name, weapons: [
    { id: 'spear', name: spear.name, potency: 0, striking: 0, runes: [] },
    { id: 'free', name: freeHand.name, potency: 0, striking: 0, runes: [], stowed: true },
  ] }
  const entries = [spear, freeHand, haftStance]
  const before = JSON.stringify(c)
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} displayOnly={displayOnly} />)
  expect(markup).toContain('aria-label="Equipped Spear"')
  for (const name of ['Fist', freeHand.name, HAFT_STRIKER_WEAPON.name]) {
    expect(markup).not.toContain(`aria-label="Equipped ${name}"`)
    expect(weaponEquipped(c, entries, ownedWeapons(c, entries).find(weapon => weapon.name === name)!)).toBe(true)
  }
  expect(ownedWeapons(c, entries).map(item => item.name)).not.toContain(OVERSIZED_THROW.name)
  expect(equippedWeaponHands(c, entries)).toBe(2)
  const stowed = { ...c, weapons: c.weapons!.map(weapon => weapon.id === 'spear' ? { ...weapon, stowed: true } : weapon) }
  expect(ownedWeapons(stowed, entries).some(weapon => weapon.name === HAFT_STRIKER_WEAPON.name)).toBe(false)
  expect(renderToStaticMarkup(<WeaponList c={stowed} entries={entries} save={() => {}} displayOnly={displayOnly} />))
    .not.toContain('aria-haspopup="dialog">Haft Striker Stance</button>')
  expect(JSON.stringify(c)).toBe(before)
})

it.each([false, true])('hides attached weapon Equip checkboxes while following the parent weapon (displayOnly=%s)', displayOnly => {
  const gun = { ...weapon, id: 'gun', name: 'Rifle', data: { ...weapon.data, hands: 2, weapon_group: 'Firearm', weapon_type: 'Ranged' } }
  const bayonet = { ...weapon, id: 'bayonet', name: 'Bayonet', data: { ...weapon.data, hands: 1 } }
  const c: Character = { ...character([]), weapons: [
    { id: 'gun', name: gun.name, potency: 0, striking: 0, runes: [], attachedWeapon: 'Bayonet' },
  ] }
  const entries = [gun, bayonet]
  for (const stowed of [false, true]) {
    const current = { ...c, weapons: c.weapons!.map(weapon => ({ ...weapon, stowed })) }
    const attached = ownedWeapons(current, entries).find(weapon => weapon.attachedTo === 'gun')!
    const markup = renderToStaticMarkup(<WeaponList c={current} entries={entries} save={() => {}} displayOnly={displayOnly} />)
    expect(markup).toContain('aria-label="Equipped Rifle"')
    expect(markup).not.toContain('aria-label="Equipped Bayonet')
    expect(markup.includes('Bayonet (Attached to Rifle)')).toBe(!stowed)
    expect(weaponEquipped(current, entries, attached)).toBe(!stowed)
    expect(equippedWeaponHands(current, entries)).toBe(stowed ? 0 : 2)
  }
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

it('hides the Shield Brace selector and Implacable helper text on Myrmidon Siegebreaker Plate', () => {
  const armor: ContentEntry = { ...weapon, id: 'myrmidon-armor', kind: 'armor', name: 'Myrmidon Siegebreaker Plate',
    systems: ['sf2e'], traits: ['Shield Brace', 'Implacable'], data: { armor_category: 'Heavy', armor_group: 'Plate',
      ac: 6, dex_cap: 0, strength: 2, check_penalty: -2 } }
  const compact: ContentEntry = { ...weapon, id: 'compact-shield', kind: 'shield', name: 'Compact Shield',
    systems: ['sf2e'], traits: ['Compact'], data: { ac: 1, hardness: 3, hp: 12 } }
  const retractable: ContentEntry = { ...compact, id: 'retractable-shield', name: 'Retractable Shield', traits: ['Retractable'] }
  const regular: ContentEntry = { ...compact, id: 'steel-shield', name: 'Steel Shield', traits: [] }
  const shield: OwnedShield = { id: compact.id, name: compact.name, hardness: 3, hp: 12, damage: 0, raised: false, equipped: true }
  const entries = [armor, compact, retractable, regular]
  const equippedArmor: OwnedArmor = { id: armor.id, name: armor.name, potency: 0, resilient: 0, runes: [],
    worn: true }
  let c: Character = { ...character([]), systems: ['sf2e'], armors: [equippedArmor],
    shield: { ...shield, equipped: false }, weapons: [] }

  expect(shieldBraceEligible(entries, armor, shield)).toBe(true)
  expect(shieldBraceEligible(entries, armor, { ...shield, name: 'Retractable Shield' })).toBe(true)
  expect(shieldBraceEligible(entries, armor, { ...shield, name: 'Steel Shield' })).toBe(false)
  expect(shieldBraceInstalled(c, entries, shield)).toBe(false)
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const selector = findElement(ArmorList({ c, entries, save, part: 'armor' }), element =>
    element.type === 'select' && element.props['aria-label'] === 'Shield Brace: Myrmidon Siegebreaker Plate')
  expect(selector).toBeUndefined()
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={entries} save={() => {}} part="armor" />)
  expect(markup).not.toContain('aria-label="Shield Brace: Myrmidon Siegebreaker Plate"')
  expect(markup).toContain('Implacable')
  expect(markup).not.toContain('action would be lost to stunned or paralyzed')
})

it('auto-installs Myrmidon Siegebreaker Plate upgrades and reserves slots for both', () => {
  const armor: ContentEntry = { ...weapon, id: 'myrmidon-siegebreaker', name: 'Myrmidon Siegebreaker Plate',
    kind: 'armor', systems: ['sf2e'], level: 9,
    data: { url: 'myrmidon-siegebreaker-plate', armor_category: 'Heavy', ac: 6, strength: 10,
      speed_penalty: -10, upgrade_slots: 2 } }
  const module = (name: string, level: number): ContentEntry => ({ ...shifting, id: name, name, level,
    systems: ['sf2e'], data: { item_subcategory: 'Armor Upgrades' } })
  const upgrades = [module('Jetpack (Tactical)', 9), module('Force Field (Paragon)', 19), module('Mobility Enhancer', 0)]
  const c: Character = { ...character([]), systems: ['sf2e'], level: 20, armors: [
    { id: armor.id, name: armor.name, potency: 0, resilient: 0, runes: [], worn: true },
  ] }
  const tree = ArmorList({ c, entries: [armor, ...upgrades], save: () => {} })
  const markup = renderToStaticMarkup(tree)
  expect(automaticArmorUpgradeSlotsUsed(armor)).toBe(3)
  expect(markup).toContain('Jetpack (Tactical)')
  expect(markup).toContain('Force Field (Paragon)')
  expect(markup).toContain('Mobility Enhancer')
  expect(markup).not.toContain('Jetpack (Tactical) *')
  expect(markup).not.toContain('Force Field (Paragon) *')
  expect(markup).not.toContain('Mobility Enhancer *')
  expect(automaticArmorUpgradeUsesSlot(armor.name, upgrades[2])).toBe(true)
  expect(automaticSpecificArmorUpgrades(c, [armor, ...upgrades], armor).map(item => item.name))
    .toContain('Mobility Enhancer')
  expect(markup).not.toContain('Add armor upgrade')
  const component = findElement(tree, element => typeof element.type === 'function' && element.type.name === 'ArmorUpgrades')!
  const content = (component.type as (props: typeof component.props) => ReactNode)(component.props)
  const upgradeMarkup = renderToStaticMarkup(content)
  expect(upgradeMarkup.indexOf('Force Field (Paragon)')).toBeLessThan(upgradeMarkup.indexOf('Jetpack (Tactical)'))
})

it('grants Chitinous Shield without occupying a hand and automatically improves its grade', () => {
  const sword = { ...weapon, data: { ...weapon.data, hands: 2 } }
  let c: Character = { ...character([]), systems: ['sf2e'], level: 8, ancestry: 'Shirren',
    weapons: [{ id: 'sword', name: sword.name, potency: 0, striking: 0, runes: [] }],
    feats: [{ name: 'Chitinous Shield', type: 'Ancestry Feat', level: 1 }] }
  const shield = ownedShields(c).find(item => item.name === 'Chitinous Shield')!
  expect(shield).toMatchObject({ hardness: 7, hp: 68 })
  expect(canEquipShield(c, [sword], shield)).toBe(true)
  expect(equippedHands(c, [sword])).toBe(2)
  c = { ...c, ...shieldRaisedChange(c, true) }
  expect(equippedShield(c)).toMatchObject({ id: shield.id, raised: true })
  expect(shieldAcBonus(c, [sword])).toBe(2)
  expect(ownedWeapons(c, [sword]).some(item => item.attachedTo === shield.id)).toBe(false)
  c = { ...c, chitinousShield: { ...c.chitinousShield, grade: 'Advanced', damage: 4 } }
  expect(ownedShields(c).find(item => item.id === shield.id)).toMatchObject({ hardness: 7, hp: 68, damage: 4, raised: true })
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[sword]} save={() => {}} part="shield" />)
  expect(markup).toContain('Raise Chitinous Shield')
  expect(markup).toContain('Hardness 7; Hit Points 68; Broken Threshold 34')
  expect(markup).not.toContain('Grade Advanced')
  expect(markup).not.toContain('aria-label="Chitinous Shield grade"')
  expect(renderToStaticMarkup(<ArmorList c={{ ...c, level: 20 }} entries={[sword]} save={() => {}} part="shield" />))
    .not.toContain('Grade Paragon')
  expect(markup).not.toContain('Attached weapon: Chitinous Shield')
  expect(markup).not.toContain('aria-label="Equipped Chitinous Shield"')
  expect(shieldEquipChange(c, shield, false)).toEqual({})
  expect(equippedShield({ ...c, chitinousShield: { ...c.chitinousShield, equipped: false } })?.id).toBe(shield.id)
  const steel = { id: 'steel', name: 'Steel Shield', hardness: 5, hp: 20, damage: 0, raised: false }
  const withSteel = { ...c, ...shieldEquipChange(c, steel, true) }
  expect(equippedShield(withSteel)?.id).toBe(steel.id)
  expect(ownedShields(withSteel).find(item => item.id === shield.id)?.equipped).toBe(true)
  expect(equippedShield({ ...withSteel, ...shieldEquipChange(withSteel, steel, false) })?.id).toBe(shield.id)
  expect(ownedShields({ ...c, level: 7 }).find(item => item.id === shield.id)).toMatchObject({ hardness: 7, hp: 58 })
  expect(ownedShields({ ...c, feats: [] }).some(item => item.id === shield.id)).toBe(false)
  expect(c.chitinousShield?.grade).toBe('Advanced')
})

it.each([
  [1, 4, 12], [4, 4, 12], [5, 7, 58], [7, 7, 58], [8, 7, 68], [10, 7, 68],
  [11, 7, 80], [13, 7, 80], [14, 9, 92], [17, 9, 92], [18, 10, 112], [19, 10, 112], [20, 11, 132],
])('scales Chitinous Shield at level %i', (level, hardness, hp) => {
  const c: Character = { ...character([]), systems: ['sf2e'], level, ancestry: 'Shirren',
    feats: [{ name: 'Chitinous Shield', type: 'Ancestry Feat', level: 1 }],
    chitinousShield: { grade: 'Commercial', damage: 4 } }
  expect(ownedShields(c).find(shield => shield.id === 'granted-shield:chitinous')).toMatchObject({ hardness, hp, damage: 4 })
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
  expect(markup).not.toContain('Hands used:')
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
  expect(renderToStaticMarkup(tree())).not.toContain('Hands used:')
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
  expect(renderToStaticMarkup(tree())).not.toContain('Hands used:')
})

it("uses one hand for two-handed weapons with Damoritosh's Grip without a grip selector", () => {
  const rifle = { ...weapon, name: 'Rifle', data: { hands: 2 } }
  const sword = { ...weapon, name: 'Sword', data: { hands: 1 } }
  let c: Character = { ...character([{ name: "Damoritosh's Grip", type: 'Class Feat', level: 18 }]),
    level: 18, systems: ['sf2e'], weapons: [
      { id: 'rifle', name: rifle.name, potency: 0, striking: 0, runes: [] },
      { id: 'sword', name: sword.name, potency: 0, striking: 0, runes: [], stowed: true },
    ] }
  const entries = [rifle, sword]
  const tree = (displayOnly = true) => WeaponList({ c, entries, save: patch => { c = { ...c, ...patch } }, displayOnly })
  expect(findElement(tree(), e => e.props['aria-label'] === 'Hands: Rifle')).toBeUndefined()
  ;(findElement(tree(), e => e.props['aria-label'] === 'Equipped Sword')!.props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: true } })
  expect(equippedWeaponHands(c, entries)).toBe(2)
  expect(findElement(tree(false), e => e.props['aria-label'] === 'Hands: Rifle')).toBeUndefined()
})

it('does not duplicate or persist generated Offensive Defense when editing another weapon', () => {
  const extra: OwnedWeapon = { id: 'sf2e:soldier:offensive-defense', name: 'Offensive Defense', potency: 0, striking: 0, runes: [] }
  const sword = { ...weapon, data: { ...weapon.data, hands: 1 } }
  let c: Character = { ...character([]), systems: ['sf2e'], className: 'Soldier', weapons: [
    { id: 'sword', name: sword.name, potency: 0, striking: 0, runes: [] }, extra,
  ] }
  const defenseEntry = { ...sword, id: extra.id, name: extra.name, data: { ...sword.data, hands: 0 } }
  const tree = (additionalWeapons: OwnedWeapon[]) => WeaponList({
    c, entries: [sword, defenseEntry], additionalWeapons, displayOnly: true, save: patch => { c = { ...c, ...patch } },
  })
  expect(ownedWeapons(c, [sword, defenseEntry]).some(item => item.id === extra.id)).toBe(false)
  expect(renderToStaticMarkup(tree([extra])).match(/aria-label="Offensive Defense attack/g)).toHaveLength(1)
  ;(findElement(tree([extra]), e => e.props['aria-label'] === 'Equipped Longsword')!.props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: false } })
  expect(c.weapons?.some(item => item.id === extra.id)).toBe(false)
  expect(renderToStaticMarkup(tree([]))).not.toContain('Offensive Defense')
})

it('confirms Offense weapon removal and syncs it to Equipment without removing granted attacks', () => {
  const c0 = character([])
  const extra: OwnedWeapon = { id: 'sf2e:soldier:offensive-defense', name: 'Offensive Defense', potency: 0, striking: 0, runes: [] }
  const extraEntry = { ...weapon, id: extra.id, name: extra.name, data: { ...weapon.data, hands: 0 } }
  let c: Character = c0
  const entries = [weapon, extraEntry]
  const save = vi.fn((patch: Partial<Character>) => { c = { ...c, ...patch } })
  const tree = (displayOnly: boolean) => WeaponList({ c, entries, save, displayOnly, additionalWeapons: displayOnly ? [extra] : [] })
  expect(findElement(tree(true), e => e.props['aria-label'] === 'Remove Offensive Defense')).toBeUndefined()
  expect(findElement(tree(true), e => e.props['aria-label'] === 'Remove Fist')).toBeUndefined()
  const remove = () => findElement(tree(true), e => e.props['aria-label'] === 'Remove Longsword')!
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  ;(remove().props.onClick as () => void)()
  expect(save).not.toHaveBeenCalled()
  expect(findElement(tree(false), e => e.props['aria-label'] === 'Remove Longsword')).toBeDefined()
  ;(remove().props.onClick as () => void)()
  expect(window.confirm).toHaveBeenLastCalledWith('Remove weapon "Longsword"?')
  expect(c.weapons?.some(item => item.id === 'w')).toBe(false)
  expect(findElement(tree(true), e => e.props['aria-label'] === 'Remove Longsword')).toBeUndefined()
  expect(findElement(tree(false), e => e.props['aria-label'] === 'Remove Longsword')).toBeUndefined()
})

it('hides removal for Iruxi Armaments claws, fangs, and tail', () => {
  const attacks = [
    { choice: 'Claws', entry: IRUXI_CLAWS },
    { choice: 'Fangs', entry: IRUXI_FANGS },
    { choice: 'Tail', entry: IRUXI_TAIL },
  ]
  for (const { choice, entry } of attacks) {
    const c = character([{ name: 'Iruxi Armaments', type: 'Ancestry Feat', level: 1, slot: 'ancestry:1:0', choice }])
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={[entry]} save={() => {}} />)
    expect(markup).not.toContain(`aria-label="Remove ${entry.name}"`)
  }
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
  expect(renderToStaticMarkup(<Augmentations c={c} entries={entries} save={() => {}} />)).not.toContain('Hardpoint weapon')
  expect(renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} displayOnly />)).toContain('Integrated weapon: cannot be disarmed')
  expect(renderToStaticMarkup(<WeaponList c={{ ...c, weapons: weapons.map(w => ({ ...w, stowed: true })) }} entries={entries} save={() => {}} displayOnly />)).not.toContain('Integrated weapon: cannot be disarmed')
})

it('omits Secondary Power Source checkboxes beside augmentations', () => {
  const c: Character = { ...character([{ name: 'Secondary Power Source', type: 'Ancestry Feat', level: 13 }]),
    systems: ['sf2e'], level: 17,
    augmentations: ['First', 'Second', 'Third'].map(name => ({ id: name, name, entryId: name, slot: 'standard' })),
    secondaryPowerSourceIds: ['First', 'Second', 'stale'], secondaryPowerUses: { First: 1 } }
  const markup = renderToStaticMarkup(<Augmentations c={c} entries={[]} save={() => {}} />)
  expect(markup).not.toContain('Use extra daily activation for')
  expect(markup).not.toContain('aria-label="First uses"')
  expect(markup).not.toContain('Secondary Power Source')
  expect(markup).not.toContain('Daily preparations')
  expect(markup).not.toContain('Once-per-day activation: extra use')
  expect(markup).not.toContain('(apex)')
  expect(markup).not.toContain('(item exemption)')
  expect(markup).not.toContain('(implant limit)')
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
  const linked = findElement(offense(), e => e.props['aria-label'] === 'Equipped Bayonet (Attached to Arbalest)')
  expect(linked).toBeUndefined()
  const base = findElement(offense(), e => e.props['aria-label'] === 'Equipped Arbalest')!
  ;(base.props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: false } })
  expect(weaponEquipped(c, entries, attached)).toBe(false)
  select('Reinforced Stock')
  expect(ownedWeapons(c, entries).find(w => w.attachedTo === 'gun')?.name).toBe('Reinforced Stock')
  expect(renderToStaticMarkup(offense())).not.toContain('Reinforced Stock (Attached to Arbalest)')
  expect(renderToStaticMarkup(tree())).not.toContain('Reinforced Stock (Attached to Arbalest)')
  ;(findElement(offense(), e => e.props['aria-label'] === 'Equipped Arbalest')!.props.onChange as
    (e: { target: { checked: boolean } }) => void)({ target: { checked: true } })
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

it.each(['Longbow', 'Composite Longbow'])('persists %s holding and shooting grips without changing damage', name => {
  const composite = name.startsWith('Composite')
  const bow: ContentEntry = { ...weapon, name, traits: composite ? ['Propulsive'] : [],
    data: { hands: '1+', weapon_type: 'Ranged', weapon_category: 'Martial', weapon_group: 'Bow', range: 100, damage: '1d8 piercing' } }
  const entries = [bow]
  let c: Character = { ...character([]), abilities: { ...character([]).abilities, str: 18 },
    weapons: [{ id: 'bow', name, potency: 1, striking: 2, runes: [] }] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const grip = (displayOnly: boolean) => findElement(WeaponList({ c, entries, save, displayOnly }),
    element => element.props['aria-label'] === `Hands: ${name}`)!
  for (const displayOnly of [false, true]) {
    for (const hands of [2, 1]) {
      ;(grip(displayOnly).props.onChange as (event: { target: { value: string } }) => void)({ target: { value: String(hands) } })
      c = JSON.parse(JSON.stringify(c))
      expect(c.weapons![0].handsHeld).toBe(hands)
      expect(equippedWeaponHands(c, entries)).toBe(hands)
      expect(weaponAttack(c, entries, c.weapons![0]).damage).toBe(`3d8${composite ? '+2' : ''} piercing`)
      for (const view of [false, true]) {
        expect(grip(view).props.value).toBe(hands)
        const html = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={save} displayOnly={view} />)
        expect(html).toContain('1 (hold)</option>')
        expect(html).toContain('2 (shoot)</option>')
      }
    }
  }
  c = { ...c, shield: { id: 'shield', name: 'Steel Shield', hardness: 5, hp: 20, raised: false, damage: 0 } }
  for (const view of [false, true]) {
    const option = findElement(grip(view).props.children as ReactNode, element => element.type === 'option' && element.props.value === 2)!
    expect(option.props.disabled).toBe(true)
    ;(grip(view).props.onChange as (event: { target: { value: string } }) => void)({ target: { value: '2' } })
    expect(c.weapons![0].handsHeld).toBe(1)
    expect(equippedHands(c, entries)).toBe(2)
  }
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

it('uses a Fire/Slashing toggle for Crimson Claw without generic powered-mode help', () => {
  const entry: ContentEntry = { ...weapon, name: 'Crimson Claw', systems: ['sf2e'],
    traits: ['Agile', 'Powered'], data: { hands: 1, damage: '2d6 fire', weapon_type: 'Melee',
      weapon_category: 'Advanced', weapon_tracking: 1, upgrade_slots: 1 },
    weaponModes: [
      { id: 'mode-1', damageType: 'fire', traits: ['Powered'] },
      { id: 'mode-2', damageType: 'slashing', traits: ['Analog'] },
    ] }
  let c: Character = { ...character([]), systems: ['sf2e'],
    weapons: [{ id: 'crimson-claw', name: 'Crimson Claw', potency: 0, striking: 0, runes: [] }] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const markup = () => renderToStaticMarkup(<WeaponList c={c} entries={[entry]} save={save} />)
  const change = findElement(WeaponList({ c, entries: [entry], save }),
    element => element.props['aria-label'] === 'Crimson Claw mode: Crimson Claw')!
  expect(markup()).toContain('> Fire <span class="action-cost"')
  expect(markup()).not.toContain('Powered attacks still require ammunition or charges')
  expect(markup()).not.toContain('>Fist<')
  ;(change.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: false } })
  expect(c.weapons![0].weaponMode).toBe('mode-2')
  expect(weaponAttack(c, [entry], c.weapons![0]).damage).toBe('2d6 slashing')
  expect(markup()).toContain('> Slashing <span class="action-cost"')
})

it('hides Crimson Claw mode when natural claws grant versatile slashing', () => {
  const entry: ContentEntry = { ...weapon, name: 'Crimson Claw', systems: ['sf2e'],
    traits: ['Agile', 'Powered'], data: { hands: 1, damage: '1d4 fire', weapon_type: 'Melee',
      weapon_category: 'Advanced', weapon_tracking: 1, upgrade_slots: 1 },
    weaponModes: [{ id: 'fire', damageType: 'fire', traits: ['Powered'] },
      { id: 'slash', damageType: 'slashing', traits: ['Analog'] }] }
  const c: Character = { ...character([{ name: 'Predatory', choice: 'Claw', type: 'Ancestry Feat', level: 1 }]),
    systems: ['sf2e'], ancestry: 'Pahtra',
    weapons: [{ id: 'claw-weapon', name: 'Crimson Claw', potency: 0, striking: 0, runes: [], weaponMode: 'slash' }] }
  const attack = weaponAttack(c, [entry], c.weapons![0])
  expect(attack.damage).toMatch(/fire/)
  expect(attack.traits).toContain('Versatile S')
  expect(renderToStaticMarkup(<WeaponList c={c} entries={[entry]} save={() => {}} />))
    .not.toContain('Crimson Claw mode:')
  expect(weaponAttack({ ...c, feats: [] }, [entry], c.weapons![0]).damage).toMatch(/slashing/)
})

it('shows orbital crystals without rune controls or core crystal ratings on solar manifestations', () => {
  const crystal: ContentEntry = { ...weapon, id: 'photon', name: 'Photon (Commercial)', kind: 'item', systems: ['sf2e'],
    level: 7, data: { item_subcategory: 'Orbital Crystal' } }
  const c: Character = { ...character([{ name: 'Twin Weapons', type: 'Class Feat', level: 1 }]),
    systems: ['sf2e'], className: 'Solarian', level: 10, solarianAttunement: 'Photon', weapons: [] }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[crystal,
    { ...crystal, id: 'other', name: 'Other' }]} save={() => {}} />)
  expect(markup).toContain('Add orbital crystal')
  expect(markup).not.toContain('Add property rune')
  expect(markup).not.toContain('Weapon Potency (')
  expect(markup).not.toContain('Striking (')
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

it('limits Scale of Igroon construction and places compact recovery beside damage', () => {
  const entries = ['Shield Spikes', 'Shield Pistol', 'Shield Boss'].map(name => ({ ...weapon, id: name, name }))
  let c: Character = { ...character([]), weapons: [],
    shield: { id: 'scale', name: 'Scale of Igroon', hardness: 20, hp: 160, damage: 6, raised: false,
      material: { name: 'Orichalcum' }, reinforcingRune: 'Supreme' } }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const markup = () => renderToStaticMarkup(<ArmorList c={c} entries={entries} save={save} part="shield" />)
  expect(markup()).toContain('>Scale of Igroon Shield</button>')
  expect(markup()).not.toContain('Shield material')
  expect(markup()).not.toContain('Reinforcing Rune')
  expect(markup()).not.toContain('Orichalcum')
  expect(markup()).toContain('>Shield Boss</option>')
  expect(markup()).toContain('>Shield Spikes</option>')
  expect(markup()).not.toContain('Shield Pistol')
  expect(markup()).toContain('>+4 HP</button>')
  const row = () => findElement(ArmorList({ c, entries, save, part: 'shield' }), e =>
    e.props.className === 'row' && !!findElement(e.props.children as ReactNode, child => child.type === 'input' && child.props.type === 'number'))!
  const recover = () => findElement(row(), e => e.type === 'button')!
  const heal = () => (recover().props.onClick as () => void)()
  heal()
  expect(c.shield?.damage).toBe(2)
  heal()
  expect(c.shield?.damage).toBe(0)
  expect(recover().props.disabled).toBe(true)
  c = { ...c, shield: { ...c.shield!, damage: 8, equipped: false } }
  expect(recover().props.disabled).toBe(true)
  c = { ...c, shield: { ...c.shield!, equipped: true } }
  const attachment = findElement(ShieldAttachment({ c, entries, save, shield: c.shield! }), e => e.type === 'select')!
  const select = (name: string) => (attachment.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: name } })
  select('Shield Pistol')
  expect(c.shield?.attachedWeapon).toBeUndefined()
  select('Shield Spikes')
  const attached = ownedWeapons(c, entries).find(w => w.attachedTo === 'scale')!
  expect(attached.name).toBe('Shield Spikes')
  expect(effectiveWeapon(c, entries, attached).material).toBe('Orichalcum')
  expect(renderToStaticMarkup(<WeaponList c={c} entries={entries} save={save} />)).not.toContain('Orichalcum')
  c = { ...c, shield: { ...c.shield!, attachedWeapon: { ...c.shield!.attachedWeapon!, name: 'Shield Pistol' } } }
  expect(ownedWeapons(c, entries).find(w => w.attachedTo === 'scale')?.name).toBe('Shield Bash')
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
  expect(gear).not.toContain('<label>Potency')
  expect(gear).not.toContain('<label>Striking')
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

it.each(['Scale of Igroon', 'Scale of Igroon (Fortress Shield)'])('grants scaling runes to %s attachments without changing saved runes', shieldName => {
  const boss: ContentEntry = { ...weapon, id: 'boss', name: 'Shield Boss', traits: ['Attached'],
    data: { hands: 1, damage: '1d6 bludgeoning', weapon_group: 'Shield' } }
  const entries = [boss, SHOVING_RUNE]
  let c: Character = { ...character([]), level: 9, weapons: [],
    shield: { id: 'scale', name: shieldName, hardness: 20, hp: 160, damage: 0, raised: false,
      attachedWeapon: { id: 'boss', name: 'Shield Boss', potency: 0, striking: 0, runes: ['Shoving', 'Flaming'] } } }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const attached = () => ownedWeapons(c, entries).find(w => w.id === 'boss')!
  const effective = () => effectiveWeapon(c, entries, attached())
  expect(effective().runes).toEqual(['Flaming', 'Shoving', 'Grievous'])
  expect(weaponAttack(c, entries, attached()).traits).toContain('Shove')
  const render = (displayOnly = false) => renderToStaticMarkup(<WeaponList c={c} entries={entries} save={save} displayOnly={displayOnly} />)
  expect(render()).toContain('Granted by Scale of Igroon')
  expect(render()).not.toContain('aria-label="Remove Shoving rune"')
  expect(render()).not.toContain('aria-label="Remove Grievous rune"')
  expect(c.shield?.attachedWeapon?.runes).toEqual(['Shoving', 'Flaming'])
  c = { ...c, level: 10 }
  expect(effective().runes).toContain('Impactful')
  expect(render(true)).toContain('1d6 force')
  c = { ...c, level: 17 }
  expect(effective().runes).toContain('Impactful (Greater)')
  expect(effective().runes).not.toContain('Impactful')
  c = { ...c, level: 10, shield: { ...c.shield!, attachedWeapon: { ...c.shield!.attachedWeapon!,
    runes: ['Greater Impactful', 'Shoving', 'Flaming'] } } }
  expect(effective().runes).toContain('Impactful (Greater)')
  expect(effective().runes.filter(rune => /Impactful/i.test(rune))).toHaveLength(1)
  const card = findElement(WeaponList({ c, entries, save }), e => e.props['aria-label'] === `Shield Boss (Attached to ${shieldName} Shield)`)
    ?? findElement(WeaponList({ c, entries, save }), e => typeof e.props['aria-label'] === 'string'
      && e.props['aria-label'].startsWith('Shield Boss (Attached to'))
  const controls = findElement(card, e => Array.isArray(e.props.runes) && typeof e.props.onChange === 'function')!
  ;(controls.props.onChange as (runes: string[]) => void)([])
  expect(c.shield!.attachedWeapon!.runes).toEqual(['Greater Impactful', 'Shoving'])
  c = { ...c, shield: { ...c.shield!, name: 'Steel Shield' } }
  expect(effective().runes).toEqual(['Greater Impactful', 'Shoving'])
  c = { ...c, shield: { ...c.shield!, name: shieldName, attachedWeapon: undefined } }
  const bash = ownedWeapons(c, entries).find(w => w.attachedTo === 'scale')!
  expect(effectiveWeapon(c, entries, bash).runes).toEqual([])
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

it.each([[4, ''], [5, "Bolka's Blessing"], [10, "Bolka's Blessing"], [11, "Greater Bolka's Blessing"], [20, "Greater Bolka's Blessing"]])(
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
      if (level >= 11) expect(markup).not.toContain('>Bolka&#x27;s Blessing</button>')
    }
  },
)

it('follows selected haft source including a staff wielded in two hands', () => {
  const staff = { ...weapon, name: 'Staff', traits: ['Two-Hand d8'], data: { hands: 1, weapon_group: 'Club' } }
  let c: Character = { ...character([{ name: 'Haft Striker Stance', type: 'Class Feat', level: 4 }]),
    activeStance: haftStance.name,
    weapons: [{ id: 'staff', name: 'Staff', potency: 0, striking: 0, runes: [], handsHeld: 2 }] }
  const entries = [staff, haftStance]
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const get = () => ownedWeapons(c, entries).find(w => w.name === HAFT_STRIKER_WEAPON.name)!
  expect(weaponEquipped(c, entries, get())).toBe(true)
  expect(equippedWeaponHands(c, entries)).toBe(2)
  const input = findElement(WeaponList({ c, entries, save, displayOnly: true }), e => e.props['aria-label'] === 'Equipped Haft Striker Stance')
  expect(input).toBeUndefined()
  const grip = findElement(WeaponList({ c, entries, save, displayOnly: true }), e => e.props['aria-label'] === 'Hands: Staff')!
  ;(grip.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: '1' } })
  expect(get()).toBeUndefined()
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
  expect(markup).toContain('aria-haspopup="dialog">Hide Armor</button>')
  expect(markup).not.toContain('>PF2e</small>')
  expect(markup).not.toContain('>PF2E</small>')
})

it('hides automatically scaling fundamentals and their editable controls', () => {
  const c: Character = { ...character([{ name: 'Living Weapon', type: 'Class Feat', level: 1 }], true), level: 20 }
  const render = (character: Character) => {
    const card = findElement(WeaponList({ c: character, entries: [weapon], save: () => {} }),
      element => element.type === 'details' && element.props['aria-label'] === weapon.name)!
    return renderToStaticMarkup(card)
  }
  const locked = render(c)
  expect(locked).not.toContain('aria-label="Fundamental runes"')
  expect(locked).not.toContain('<label>Potency')
  expect(locked).not.toContain('<label>Striking')
  for (const level of [1, 10]) {
    const automatic = render({ ...c, level })
    expect(automatic).not.toContain('aria-label="Fundamental runes"')
    expect(automatic).not.toContain('<label>Potency')
    expect(automatic).not.toContain('<label>Striking')
  }
  const ordinary = render({ ...c, feats: [] })
  expect(ordinary).not.toContain('aria-label="Fundamental runes"')
  expect(ordinary).not.toContain('<label>Potency <select')
  expect(ordinary).not.toContain('<label>Striking <select')
})

it('hides fundamental runes and shows weapon property runes in equipment and offense', () => {
  const potency: ContentEntry = { ...shifting, id: 'potency', name: 'Weapon Potency (+3)',
    description: 'Gain a +3 item bonus to attack rolls.', data: { item_subcategory: 'Weapon Fundamental Runes' } }
  const striking: ContentEntry = { ...potency, id: 'striking', name: 'Striking (Greater)',
    description: 'This weapon deals three weapon damage dice.' }
  const c: Character = { ...character([]), weapons: [{ id: 'w', name: weapon.name, potency: 3, striking: 2, runes: ['Shifting'] }] }
  const render = (displayOnly: boolean) => renderToStaticMarkup(<WeaponList c={c}
    entries={[{ ...weapon, traits: ['Versatile P'] }, potency, striking, shifting]} save={() => {}} displayOnly={displayOnly} />)
    .split('>Longsword</button>')[1]
  const gear = render(false)
  expect(gear).not.toContain('aria-label="Fundamental runes"')
  expect(gear).toContain('>Shifting</button>')
  const offense = render(true)
  expect(offense).toContain('>Versatile P</button>')
  expect(offense).not.toContain('aria-label="Fundamental runes"')
  expect(offense).not.toContain('>+3 Potency</button>')
  expect(offense).not.toContain('>Striking (Greater)</button>')
  expect(offense).toContain('>Shifting</button>')
  expect(offense).not.toContain('aria-label="Remove Shifting rune"')
  expect(offense).not.toContain('aria-label="Add property rune"')
  expect(offense).toContain('3d8')
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
  expect(markup).toContain('aria-label="Bulk limits note"')
  const visible = markup.replace(/<span[^>]*class="source-note"[^>]*>[\s\S]*?<\/span>/g, '').replace(/<[^>]*>/g, '')
  expect(visible).not.toContain('Strength')
  expect(visible).not.toContain('not tracked')
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
  const offense = renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={save} displayOnly />)
  expect(offense).not.toContain('>Material</span>')
  expect(offense).not.toContain('>Orichalcum</button>')
  expect(markup).toContain('aria-haspopup="dialog">Orichalcum')
  expect(markup).not.toContain('<label>Potency')
  const armorMaterial = findElement(ArmorList({ c, entries: [], save }), (element) => element.props['aria-label'] === 'Armor material')
  if (!armorMaterial) throw new Error('Missing armor material')
  ;(armorMaterial.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Orichalcum' } })
  expect(c.armors?.[0]).toMatchObject({ material: 'Orichalcum', potency: 3, resilient: 2 })
  const armorMarkup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={save} />)
  expect(armorMarkup).toContain('aria-haspopup="dialog">Orichalcum Chain Mail</button>')
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

it('hides the material row on Highhelm Stronghold armor', () => {
  const c: Character = { ...character([]), armors: [
    { id: 'highhelm', name: 'Highhelm Stronghold Bastion Plate', worn: true, potency: 0, resilient: 0, runes: [] },
  ] }
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[]} save={() => {}} />)
  expect(markup).not.toContain('aria-label="Armor material"')
  expect(markup).not.toContain('aria-haspopup="dialog">Keep Stone')
  expect(markup).not.toContain('>Material:</span>')
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

it('preserves legacy deity weapons when editing other gear and leaves both copies removable', () => {
  const dormant: OwnedWeapon = { id: 'deity-weapon:longsword', name: 'Longsword', potency: 3, striking: 3, runes: ['Flaming'] }
  let c: Character = { ...character([]), deity: 'Iomedae', weapons: [...character([]).weapons!, dormant] }
  const entries: ContentEntry[] = [weapon, { ...weapon, id: 'deity', kind: 'deity', name: 'Iomedae', data: { favored_weapon: 'longsword' } }]
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const control = findElement(WeaponList({ c, entries, save }), element => element.props['aria-label'] === 'Weapon material')
  if (!control) throw new Error('Missing purchased weapon material')
  ;(control.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Cold Iron' } })
  expect(c.weapons?.find(w => w.id === dormant.id)).toEqual(dormant)
  c = { ...c, className: 'Cleric' }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={save} />)
  expect(markup.match(/aria-label="Remove Longsword"/g)).toHaveLength(2)
  expect(effectiveWeapon(c, entries, dormant)).toMatchObject({ potency: 3, striking: 3, runes: ['Flaming'] })
})

it('confirms removal of a favored longsword and does not recreate it after reload', () => {
  let c: Character = { ...character([]), className: 'Cleric', deity: 'Iomedae',
    weapons: [{ ...character([]).weapons![0], id: 'deity-weapon:longsword' }] }
  const entries: ContentEntry[] = [weapon, { ...weapon, id: 'deity', kind: 'deity', name: 'Iomedae', data: { favored_weapon: 'longsword' } }]
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const remove = () => {
    const button = findElement(WeaponList({ c, entries, save }), e => e.props['aria-label'] === 'Remove Longsword')!
    ;(button.props.onClick as () => void)()
  }
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  remove()
  expect(c.weapons?.some(w => w.name === 'Longsword')).toBe(true)
  remove()
  c = JSON.parse(JSON.stringify(c))
  expect(ownedWeapons(c, entries).some(w => w.name === 'Longsword')).toBe(false)
  expect(renderToStaticMarkup(<WeaponList c={c} entries={entries} save={save} />)).not.toContain('Favored weapon unavailable')
})

it('alphabetizes Animal Feature effects, greys out rank-four choices until level seven, and switches a single persisted effect', ({ onTestFinished }) => {
  const previous = getSettings().championFormNoFlight
  onTestFinished(() => updateSettings({ championFormNoFlight: previous }))
  updateSettings({ championFormNoFlight: false })
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

it('persists independent Animal Features with the homebrew feat, including attacks, senses and movement', ({ onTestFinished }) => {
  const previous = getSettings().championFormNoFlight
  onTestFinished(() => updateSettings({ championFormNoFlight: previous }))
  updateSettings({ championFormNoFlight: false })
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
  const entries = [spear, second, haftStance]
  let c: Character = { ...character([
    { name: 'Living Weapon', type: 'Class Feat', level: 1 },
    { name: 'Haft Striker Stance', type: 'Class Feat', level: 4 },
  ]), activeStance: haftStance.name, weapons: [
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
  const offense = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={save} displayOnly />)
  expect(offense).toContain('title="Granted by Living Weapon"')
  expect(offense).toContain('title="Inherited from Dancer&#x27;s Spear"')
  expect(offense).not.toContain('aria-label="Remove Shifting rune"')
  expect(offense).not.toContain('aria-label="Add property rune"')
  propertyEditor()(['Flaming', 'Frost'])
  assertShared(2, 1, ['Flaming', 'Frost'])
  propertyEditor()(['Frost'])
  assertShared(2, 1, ['Frost'])
  expect(findElement(card(second.name), element => element.props.label === 'Potency' || element.props.label === 'Striking')).toBeUndefined()
  c = { ...c, level: 12 }
  assertShared(2, 2, ['Frost'])
  c = { ...c, level: 20 }
  assertShared(3, 3, ['Frost'])
  const tag = findElement(card(second.name), (element) => element.props['aria-label'] === 'Living Weapon: grant Shifting rune')
  if (!tag) throw new Error('Missing Living Weapon toggle')
  ;(tag.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: false } })
  expect(effectiveWeapon(c, entries, c.weapons![1])).toMatchObject({ potency: 3, striking: 3, runes: [] })
  assertShared(3, 3, ['Frost'])
})

it('lets users select the Haft Striker source and keeps all inherited enhancements read-only', () => {
  let c = character([{ name: 'Haft Striker Stance', type: 'Class Feat', level: 4 },
    { name: 'Living Weapon', type: 'Class Feat', level: 1 }])
  c.activeStance = haftStance.name
  c.weapons = [{ ...c.weapons![0], id: 'first', name: 'Spear', livingWeapon: true }, { ...c.weapons![0], id: 'second', name: 'Hammer', runes: ['Frost'] }]
  const entries = [
    haftStance,
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
  const card = findElement(WeaponList({ c, entries, save }), (element) => element.props['aria-label'] === 'Haft Striker Stance (from Hammer)')
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
  expect(enabled).not.toContain('<label>Potency')
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
    expect(markup).toMatch(/Damage 2d8 S \+ 1d6 spirit<button[^>]*>\*<\/button><span[^>]*>.*?<\/span> \+ 1d4 spirit<button/)
    expect(markup).not.toContain('*</button> (Astral (Greater))')
    expect(markup).not.toContain('*</button> (Holy)')
    expect(markup).toContain('Greater Astral: spirit damage ignores spirit resistance.')
    expect(markup).toContain('Holy: 2d4 spirit instead against unholy targets.')
  }
})

it.each([['Hooked', 'Trip'], ['Grappling', 'Grapple'], ['Disarming', 'Disarm'], ['Shoving', 'Shove']])('adds %s %s trait without extra damage or duplicating a natural trait', (rune, trait) => {
  const c = character([])
  c.weapons![0].runes = [rune]
  for (const traits of [[], [trait]]) {
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={[{ ...weapon, traits }]} save={() => {}} />)
    expect(markup).not.toContain('class="gear-damage"')
    expect(markup).toContain('Damage 2d8 S')
    expect(markup).not.toContain(`slashing + ${rune}`)
    expect(markup.match(new RegExp(`class="gear-trait" aria-haspopup="dialog">${trait}</button>`, 'g'))).toHaveLength(rune === 'Grappling' ? 2 : 1)
    expect(markup).toContain(`aria-label="Remove ${rune} rune"`)
  }
})

it.each([
  { rune: GRAPPLING_RUNE, trait: 'Grapple', note: 'you can attempt to Grapple the target as a reaction' },
  { rune: DISARMING_RUNE, trait: 'Disarm', note: 'The weapon gains the disarm trait.' },
  { rune: SHOVING_RUNE, trait: 'Shove', note: 'The weapon gains the shove trait.' },
])('offers $rune.name only for melee weapons and shows its homebrew rules', ({ rune, trait, note }) => {
  const c = character([])
  c.weapons![0].runes = []
  const entries = [weapon, rune]
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain(`>${rune.name} (Level 5)</option>`)
  c.weapons![0].runes = [rune.name]
  expect(renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} />))
    .toContain(note)
  const ranged = { ...weapon, data: { ...weapon.data, weapon_type: 'Ranged', range: 60 } }
  c.weapons![0].runes = []
  expect(renderToStaticMarkup(<WeaponList c={c} entries={[ranged, rune]} save={() => {}} />))
    .not.toContain(`>${rune.name} (Level 5)</option>`)
  c.weapons![0].runes = [rune.name]
  expect(weaponAttack(c, [ranged, rune], c.weapons![0]).traits).not.toContain(trait)
})

it.each([['Fighter', 'pf2e', HANDWRAPS.name], ['Mechanic', 'sf2e', HARDLIGHT_HANDWRAPS.name]] as const)(
  'grants %s handwraps without Add or Remove controls', (className, system, name) => {
    const c: Character = { ...character([]), systems: ['pf2e', 'sf2e'], className }
    const klass: ContentEntry = { ...weapon, id: className, name: className, kind: 'class', systems: [system] }
    const save = vi.fn()
    const markup = renderToStaticMarkup(<HandwrapsGear c={c} entries={[klass]} save={save} />)
    expect(markup).toContain(`aria-label="${name}"`)
    expect(markup).not.toContain(`Add ${name}`)
    expect(markup).not.toContain(`aria-label="Remove ${name}"`)
    if (system === 'sf2e') expect(markup).not.toContain('Hardlight handwraps grade')
    expect(save).not.toHaveBeenCalled()
    expect(c.handwraps).toBeUndefined()
  })

it('keeps Grievous visible as a rune but excludes it from both damage displays', () => {
  const c = character([])
  c.weapons![0].runes = ['Grievous', 'Impactful (Greater)']
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={() => {}} />)
  expect(markup).toContain('Damage 2d8 S + 1d6 force')
  expect(markup).toContain('aria-label="Remove Grievous rune"')
})

it('keeps weapon descriptions in the item dialog without a separate equipment summary', () => {
  const c = character([])
  const entry = { ...weapon, description: 'A distinctive weapon description.' }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[entry]} save={() => {}} />)
  expect(markup).toContain('A distinctive weapon description.')
  expect(markup).not.toContain('<summary>Summary</summary>')
})

it.each(['Bloodthirsty', 'Cunning', 'Greater Bloodthirsty', 'Cunning (Greater)'])(
  'keeps %s visible as a rune without adding its name to damage', (rune) => {
    const c = character([])
    c.weapons![0].runes = [rune, 'Impactful']
    for (const displayOnly of [false, true]) {
      const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={() => {}} displayOnly={displayOnly} />)
      expect(markup).toContain('Damage 2d8 S + 1d6 force')
      expect(markup).not.toContain(` + ${rune}`)
      expect(markup).toContain(`>${rune}</button>`)
    }
  },
)

it.each(['Crushing', 'Crushing (Greater)', 'Greater Crushing'])('shows %s critical conditions and Shockwave splash separately from normal damage', (rune) => {
  for (const striking of [1, 3]) {
    const c = character([])
    c.weapons![0] = { ...c.weapons![0], name: 'Maul', striking, runes: [rune, 'Shockwave', 'Impactful'] }
    const maul: ContentEntry = { ...weapon, name: 'Maul', data: { weapon_category: 'Martial', damage: '1d12 bludgeoning' } }
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={[maul]} save={() => {}} />)
    const dice = striking + 1
    const severity = rune === 'Crushing' ? 1 : 2
    expect(markup).toContain(`Damage ${dice}d12 B + 1d6 force + ${dice} B splash`)
    expect(markup).toContain(`Critical hit: clumsy ${severity} and enfeebled ${severity} until the end of your next turn.`)
    expect(markup).toContain('Shockwave splash does not harm you.')
    expect(markup).toContain(`aria-label="Remove ${rune} rune"`)
    expect(markup).toContain('aria-label="Remove Shockwave rune"')
    expect(/<summary>(.*?)<\/summary>/.exec(markup)?.[1]).not.toMatch(/Crushing|Shockwave/)
  }
})

it('shows Haft Striker only in its learned active stance with a qualifying wielded weapon', () => {
  const c = character([{ name: 'Haft Striker Stance', type: 'Class Feat', level: 2 }])
  c.activeStance = haftStance.name
  c.weapons![0].name = 'Maul'
  const maul = { ...weapon, name: 'Maul', data: { hands: 2, weapon_group: 'Hammer', damage: '1d12 bludgeoning' } }
  const entries = [maul, HAFT_STRIKER_WEAPON, haftStance]
  const render = (character: Character, displayOnly: boolean) => renderToStaticMarkup(
    <WeaponList c={character} entries={entries} save={() => {}} displayOnly={displayOnly} />)
  const markup = render(c, false)
  expect(markup).toContain('aria-haspopup="dialog">Haft Striker Stance (from Maul)</button>')
  expect(markup).not.toContain('aria-label="Remove Haft Striker Stance"')
  for (const displayOnly of [false, true]) {
    for (const current of [
      { ...c, activeStance: undefined }, { ...c, activeStance: 'Other Stance' }, { ...c, feats: [] },
      { ...c, weapons: c.weapons!.map(weapon => ({ ...weapon, stowed: true })) },
    ]) expect(render(current, displayOnly)).not.toContain('aria-haspopup="dialog">Haft Striker Stance</button>')
    expect(renderToStaticMarkup(<WeaponList c={c} entries={[maul, { ...haftStance, deleted: true }]}
      save={() => {}} displayOnly={displayOnly} />)).not.toContain('aria-haspopup="dialog">Haft Striker Stance</button>')
  }
  const manual = { ...c, feats: [], weapons: [{ id: 'manual', name: HAFT_STRIKER_WEAPON.name, potency: 0, striking: 0, runes: [] }] }
  expect(renderToStaticMarkup(<WeaponList c={manual} entries={[HAFT_STRIKER_WEAPON]} save={() => {}} />))
    .not.toContain('aria-haspopup="dialog">Haft Striker Stance</button>')
})

it('locks full plate gauntlets and keeps their saved configuration when other weapons change while armor is unworn', () => {
  let c: Character = {
    ...character([]),
    armors: [{ id: 'plate', name: 'Full Plate', potency: 0, resilient: 0, runes: [], worn: true }],
  }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={save} />)
  expect(markup).toContain('aria-haspopup="dialog">Gauntlet</button>')
  expect(markup).not.toContain('aria-label="Remove Gauntlet"')
  const gauntlet = { id: GAUNTLET.id, name: 'Gauntlet', potency: 2, striking: 1, runes: ['Flaming'] }
  c = { ...c, weapons: [...c.weapons!, gauntlet], armors: c.armors!.map((armor) => ({ ...armor, worn: false })) }
  expect(renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={save} />)).not.toContain('aria-haspopup="dialog">Gauntlet</button>')
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
  expect(renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)).not.toContain('aria-haspopup="dialog">Orichalcum</button>')
  expect(effectiveWeapon(c, [], saved)).toMatchObject({ material: 'Orichalcum', potency: 0, striking: 0, runes: [] })
  const card = findElement(WeaponList({ c, entries: [], save: () => {} }),
    element => element.type === 'details' && element.props['aria-label'] === name)!
  const markup = renderToStaticMarkup(card)
  expect(markup).not.toContain('aria-label="Fundamental runes"')
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
    expect(markup).toContain(`aria-haspopup="dialog">${name}</button>`)
    expect(markup).not.toContain(`aria-label="Remove ${name}"`)
    expect(markup.indexOf('>Bladed Gauntlet</option>')).toBeLessThan(markup.indexOf('>Clawed Gauntlet</option>'))
    expect(markup.indexOf('>Gauntlet</option>')).toBeLessThan(markup.indexOf('>Spiked Gauntlet</option>'))
  }
  c = { ...c, weapons: [...c.weapons!, { id: 'purchased', name: 'Gauntlet', potency: 0, striking: 0, runes: [] }] }
  expect(renderToStaticMarkup(<WeaponList c={c} entries={[]} save={save} />)).toContain('aria-label="Remove Gauntlet"')
  c = { ...c, armors: c.armors!.map((armor) => ({ ...armor, worn: false })) }
  const unworn = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={save} />)
  expect(unworn).not.toContain('aria-label="Armor gauntlet"')
  expect(unworn).not.toContain('aria-haspopup="dialog">Clawed Gauntlet</button>')
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
  expect(c.handwraps).toBeUndefined()
  expect(renderToStaticMarkup(tree())).not.toContain(`Add ${HANDWRAPS.name}`)
  expect(renderToStaticMarkup(tree())).not.toContain(`aria-label="Remove ${HANDWRAPS.name}"`)
  const card = findElement(tree(), (element) => element.type === 'details' && element.props['aria-label'] === HANDWRAPS.name)
  if (!card) throw new Error('Missing handwrap card')
  expect(findElement(card, element => element.props.label === 'Potency' || element.props.label === 'Striking')).toBeUndefined()
  const properties = findElement(card, element => Array.isArray(element.props.runes) && typeof element.props.onChange === 'function')
  if (!properties) throw new Error('Missing shared property rune control')
  ;(properties.props.onChange as (runes: string[]) => void)(['Frost'])
  expect(c.handwraps).toEqual({ potency: 2, striking: 1, runes: ['Frost'] })
  const sword = findElement(weapons(), (element) => element.type === 'details' && element.props['aria-label'] === 'Longsword')
  const swordRunes = findElement(sword, (element) => Array.isArray(element.props.runes) && typeof element.props.onChange === 'function')
  if (!swordRunes) throw new Error('Missing sword rune control')
  ;(swordRunes.props.onChange as (runes: string[]) => void)(['Flaming'])
  expect(c.weapons?.find((attack) => attack.name === 'Fist')).toMatchObject({ potency: 0, striking: 0, runes: [] })
  expect(c.handwraps).toEqual({ potency: 2, striking: 1, runes: ['Frost'] })
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
  expect(markup).toContain('Damage 2d6 S')
  expect(markup).toContain('persistent bleed')
  expect(markup).not.toContain('aria-haspopup="dialog">Jaws</button>')
  const jawsMarkup = renderToStaticMarkup(<WeaponList c={{ ...c, animalFeature: 'Jaws' }} entries={[]} save={() => {}} />)
  expect(jawsMarkup).toContain('Jaws attack +14: show breakdown')
  expect(jawsMarkup).toContain('Damage 2d8 P')
  expect(markup).not.toContain('Claws (Animal Feature)')
  expect(markup).not.toContain('Jaws (Animal Feature)')
  expect(markup).not.toContain('aria-label="Remove Claws"')
  expect(markup).not.toContain('aria-label="Remove Jaws"')
  expect(markup).not.toContain('aria-label="Remove Grievous rune"')
  expect(renderToStaticMarkup(<HandwrapsGear c={c} entries={[]} save={() => {}} />).match(/aria-label="Remove Grievous rune"/g)).toHaveLength(1)
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
  expect(effectiveWeapon(withoutFeat, [weapon], claws)).toMatchObject({
    potency: 3, striking: 3, runes: ['Grievous', 'Grappling', 'Shoving', 'Flaming'],
  })
  expect(renderToStaticMarkup(<WeaponList c={withoutFeat} entries={[weapon]} save={() => {}} />))
    .not.toContain('Critical hit: 1d6 persistent bleed')
  c = { ...c, weapons: [] }
  expect(effectiveWeapon(c, [weapon], claws)).toMatchObject({
    potency: 3, striking: 3, runes: ['Grievous', 'Grappling', 'Shoving', 'Flaming'],
  })
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
    'Composite Longbow', HANDWRAPS.name, 'Higher Potency', 'Higher Striking', 'Other Properties',
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
  [undefined, HANDWRAPS.name],
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

it('uses automatic handwraps instead of directly configured unarmed runes, potency, or striking', () => {
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
  expect(markup).toContain('Damage 2d4 B')
})

it.each([false, true])('shows active unarmed property runes but hides fundamentals (displayOnly=%s)', displayOnly => {
  const c: Character = { ...character([{ name: 'Iruxi Spirit Strike', level: 9, type: 'Ancestry Feat' }]),
    ancestry: 'Lizardfolk', handwraps: { potency: 2, striking: 1, runes: ['Decaying'] },
    weapons: [IRUXI_CLAWS, IRUXI_FANGS].map(entry => ({ id: entry.id, name: entry.name, potency: 0, striking: 0, runes: [] })) }
  const entries = [IRUXI_CLAWS, IRUXI_FANGS,
    { ...shifting, id: 'astral', name: 'Astral' },
    { ...shifting, id: 'decaying', name: 'Decaying' }]
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} displayOnly={displayOnly} />)
  expect(markup).toContain('>Astral</button>')
  expect(markup).toContain('>Grievous</button>')
  expect(markup).toContain('>Decaying</button>')
  expect(markup).not.toContain('aria-label="Fundamental runes"')
  expect(markup).not.toContain('aria-label="Remove Grievous rune"')
  expect(markup).not.toContain('aria-label="Remove Astral rune"')
  expect(markup).not.toContain('aria-label="Add property rune"')
})

it("scales Hunter's Dawn Activation 1 damage and lets Activation 3 hide its roll", () => {
  const dawn: ContentEntry = {
    ...weapon, id: 'dawn', name: "Hunter's Dawn (Gaff)", level: 5,
    description: [
      'Base weapon: Gaff.',
      'On a successful hit, you deal 3d6 piercing damage.',
      'Activate (one action) Frequency once per day; Effect First.',
      'Activate (one action) Frequency once per day; Effect Second.',
      'Activate (one action) Frequency once per day; Effect Third.',
    ].join('\n\n'),
    data: { ...weapon.data, damage: '1d6 piercing', weapon_type: 'Melee', weapon_category: 'Simple',
      named_weapon: true, named_weapon_source: "Hunter's Dawn", named_weapon_base: 'Gaff',
      named_weapon_potency: 3, named_weapon_striking: 2, named_weapon_runes: 'Astral;Returning',
      named_weapon_material: 'Peachwood', artifact_activation_actions: 'Single Action;Single Action;Single Action' },
  }
  const owned: OwnedWeapon = { id: dawn.id, name: dawn.name, potency: 0, striking: 0, runes: [] }
  const c = { ...character([]), level: 19, weapons: [owned] }
  const tree = WeaponList({ c, entries: [dawn], save: () => {} })
  const activationOne = findElement(tree, element =>
    element.type === MultipleDamageRoll && element.props.name === "Hunter's Dawn javelin")
  const activationThree = findElement(tree, element =>
    element.type === DamageRoll && element.props.name === "Hunter's Dawn fire")
  expect(activationOne?.props.damages).toMatchObject([{ dice: 4 }, { dice: 2 }])
  expect(activationThree?.props.toggleResult).toBe(true)
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
  expect(renderToStaticMarkup(<HandwrapsGear c={c} entries={[]} save={save} />)).not.toContain('Hardlight handwraps grade')
  c = { ...c, handwraps: { ...c.handwraps!, runes: ['Flaming', 'Impactful'] } }
  const attack = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={save} />)
  expect(attack).not.toContain('inherited from Hardlight Handwraps')
  expect(attack).toContain('Damage 2d4 B')
  expect(attack).not.toContain('aria-label="Remove Flaming rune"')
  expect(attack).not.toContain('aria-label="Add property rune"')
  expect(renderToStaticMarkup(<HandwrapsGear c={c} entries={[]} save={save} />)).toContain('Saved runes are inactive')
  expect(renderToStaticMarkup(<HandwrapsGear c={c} entries={[]} save={save} />)).not.toContain('Upgrade slots:')
  expect(c.handwraps).toMatchObject({ grade: 'Superior', runes: ['Flaming', 'Impactful'] })
  const remove = findElement(tree(), (element) => element.props['aria-label'] === 'Remove Hardlight Handwraps')
  if (!remove) throw new Error('Missing Hardlight removal')
  ;(remove.props.onClick as () => void)()
  expect(c.handwraps).toBeUndefined()
})

it('automatically installs hardlight grapple and shove modules at level 8 without duplicating saved upgrades', () => {
  const previous = getSettings().automaticSfWeaponUpgrades
  const protectionGrid = (name: string, level: number): ContentEntry => ({ ...SHOVING_MODULE,
    id: `protection-grid-${level}`, name, level, data: { item_subcategory: 'Weapon Upgrades' } })
  const entries = [GRAPPLING_MODULE, SHOVING_MODULE, protectionGrid('Protection Grid (Commercial)', 8),
    protectionGrid('Protection Grid (Tactical)', 17)]
  const c: Character = { ...character([]), systems: ['sf2e'], level: 8, className: 'Fighter', weapons: [],
    handwraps: { kind: 'hardlight', grade: 'Advanced', potency: 0, striking: 0, runes: [], upgrades: [GRAPPLING_MODULE.id] } }
  const fist = ownedWeapons(c, entries).find(item => item.name === 'Fist')!
  try {
    updateSettings({ automaticSfWeaponUpgrades: true })
    expect(installedWeaponUpgrades(c, entries, fist).map(item => item.name)).toEqual(['Grappling Module', 'Shoving Module'])
    expect(installedWeaponUpgrades(c, entries, fist).some(item => item.name.startsWith('Protection Grid'))).toBe(false)
    expect(weaponAttack(c, entries, fist).traits).toEqual(expect.arrayContaining(['Grapple', 'Shove']))
    const markup = renderToStaticMarkup(<HandwrapsGear c={c} entries={entries} save={() => {}} />)
    expect(markup).toContain('Grappling Module')
    expect(markup).toContain('Shoving Module')
    expect(markup).not.toContain('aria-label="Remove Shoving Module upgrade"')
    expect(markup).not.toContain('aria-label="Add weapon upgrade"')
    const before = { ...c, level: 7, handwraps: { ...c.handwraps!, upgrades: [] } }
    expect(installedWeaponUpgrades(before, entries, fist)).toEqual([])
    expect(weaponAttack(before, entries, fist).traits).not.toContain('Grapple')
    expect(installedWeaponUpgrades({ ...c, handwraps: undefined, className: undefined }, entries, fist)).toEqual([])
    const level16 = { ...c, level: 16, handwraps: { ...c.handwraps!, grade: 'Ultimate' as const } }
    const fist16 = ownedWeapons(level16, entries).find(item => item.name === 'Fist')!
    expect(installedWeaponUpgrades(level16, entries, fist16).map(item => item.name)).toEqual([
      'Grappling Module', 'Shoving Module', 'Protection Grid (Commercial)',
    ])
    const level17 = { ...level16, level: 17 }
    const fist17 = ownedWeapons(level17, entries).find(item => item.name === 'Fist')!
    expect(installedWeaponUpgrades(level17, entries, fist17).map(item => item.name)).toContain('Protection Grid (Tactical)')
    expect(hasParryWeapon(level17, entries)).toBe(true)
    expect(parryValue(level17, entries)).toBe(2)
    updateSettings({ automaticSfWeaponUpgrades: false })
    expect(installedWeaponUpgrades(c, entries, fist).map(item => item.name)).toEqual(['Grappling Module'])
    expect(weaponAttack(c, entries, fist).traits).not.toContain('Shove')
  } finally { updateSettings({ automaticSfWeaponUpgrades: previous }) }
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
  expect(renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} />)).not.toContain('Weapon material')
  const tree = () => WeaponList({ c, entries, save: patch => { c = { ...c, ...patch } } })
  const component = findElement(tree(), element => typeof element.type === 'function' && element.type.name === 'WeaponUpgrades')!
  const content = (component.type as (props: typeof component.props) => ReactNode)(component.props)
  const select = findElement(content, element => element.props['aria-label'] === 'Add weapon upgrade')!
  expect(renderToStaticMarkup(select)).toContain('Sight')
  expect(renderToStaticMarkup(select)).not.toContain('Bipod')
  ;(select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'Sight' } })
  expect(c.weapons?.[0]).toMatchObject({ upgrades: ['Sight'], runes: ['Flaming'] })
  const full = renderToStaticMarkup(<WeaponList c={c} entries={entries} save={() => {}} />)
  expect(full).not.toContain('Upgrade slots:')
  expect(full).not.toContain('aria-label="Add weapon upgrade"')
})

it('alphabetizes saved and automatic weapon upgrades together without changing removal targets', () => {
  const upgrade = (name: string): ContentEntry => ({ ...shifting, id: name, name, systems: ['sf2e'],
    data: { item_subcategory: 'Weapon Upgrades' } })
  const grip = upgrade("Smuggler's Grip")
  const flaming = upgrade('Flaming Module')
  const loudener = upgrade('Loudener')
  const onChange = vi.fn()
  const content = WeaponUpgrades({ entries: [grip, flaming, loudener], weapon, upgrades: [grip.id, loudener.id],
    effectiveUpgrades: [grip, flaming, loudener], limit: 3, onChange })
  const html = renderToStaticMarkup(content)
  expect(html.indexOf('Flaming Module')).toBeLessThan(html.indexOf('Loudener'))
  expect(html.indexOf('Loudener')).toBeLessThan(html.indexOf('Smuggler&#x27;s Grip'))
  expect(html).not.toContain('Remove Flaming Module upgrade')
  const available = renderToStaticMarkup(WeaponUpgrades({ entries: [grip, flaming, loudener], weapon, upgrades: [],
    limit: 3, onChange }))
  expect(available.indexOf('Flaming Module (Level')).toBeLessThan(available.indexOf('Loudener (Level'))
  expect(available.indexOf('Loudener (Level')).toBeLessThan(available.indexOf('Smuggler&#x27;s Grip (Level'))
  const tag = findElement(content, element => element.props.name === 'Loudener')!
  ;(tag.props.onRemove as () => void)()
  expect(onChange).toHaveBeenCalledWith([grip.id])

  const sfWeapon: ContentEntry = { ...weapon, id: 'sf-weapon', name: 'Starfinder Test Weapon', systems: ['sf2e'],
    traits: ['Tech'], data: { weapon_type: 'Melee', damage: '1d6 S', upgrade_slots: 3 } }
  const characterWithWeapon: Character = { ...character([]), systems: ['sf2e'], weapons: [
    { id: sfWeapon.id, name: sfWeapon.name, potency: 0, striking: 0, runes: [],
      upgrades: [grip.id, loudener.id, flaming.id] },
  ] }
  const weaponMarkup = renderToStaticMarkup(<WeaponList c={characterWithWeapon}
    entries={[sfWeapon, grip, flaming, loudener]} save={() => {}} displayOnly />)
  const installedList = weaponMarkup.split('<div class="gear-runes">').find(group =>
    group.includes('Flaming Module') && group.includes('Loudener') && group.includes('Smuggler&#x27;s Grip'))
  expect(installedList).toBeDefined()
  expect(installedList!.indexOf('Flaming Module')).toBeLessThan(installedList!.indexOf('Loudener'))
  expect(installedList!.indexOf('Loudener')).toBeLessThan(installedList!.indexOf('Smuggler&#x27;s Grip'))
})

it('offers grapple and shove modules for melee weapons and hardlight handwraps, but not ranged weapons', () => {
  const melee: ContentEntry = { ...weapon, systems: ['sf2e'], traits: ['Tech'],
    data: { weapon_type: 'Melee', range: 20, upgrade_slots: 2 } }
  const ranged = { ...melee, data: { ...melee.data, weapon_type: 'Ranged' } }
  const entries = [GRAPPLING_MODULE, SHOVING_MODULE]
  let upgrades: string[] = []
  const render = (target: ContentEntry) => WeaponUpgrades({ entries, weapon: target, upgrades, limit: 1, onChange: ids => { upgrades = ids } })
  expect(renderToStaticMarkup(render(melee))).toContain('Grappling Module')
  expect(renderToStaticMarkup(render(melee))).toContain('Shoving Module')
  expect(renderToStaticMarkup(render(ranged))).not.toContain('Grappling Module')
  const handwraps = { ...HARDLIGHT_HANDWRAPS, data: { ...HARDLIGHT_HANDWRAPS.data, weapon_type: 'Melee' } }
  expect(renderToStaticMarkup(render(handwraps))).toContain('Shoving Module')
  const select = findElement(render(melee), element => element.props['aria-label'] === 'Add weapon upgrade')!
  ;(select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: GRAPPLING_MODULE.id } })
  expect(upgrades).toEqual([GRAPPLING_MODULE.id])
  expect(renderToStaticMarkup(render(melee))).not.toContain('Add weapon upgrade')
  const tag = findElement(render(melee), element => typeof element.type === 'function' && element.type.name === 'GearTag')!
  ;(tag.props.onRemove as () => void)()
  expect(upgrades).toEqual([])
})

it('treats Starfinder weapons without a tech trait but with upgrade slots as upgrade weapons and lists installed upgrades once', () => {
  const rifle: ContentEntry = { ...weapon, id: 'sho', name: 'Shobhad Longrifle', systems: ['sf2e'], traits: ['Kickback'],
    data: { hands: 2, weapon_type: 'Ranged', damage: '1d8 P', upgrade_slots: 0 } }
  const flaming: ContentEntry = { ...shifting, id: 'flame', name: 'Flaming Module', systems: ['sf2e'],
    data: { item_subcategory: 'Weapon Upgrades', usage: 'installed in a ranged weapon', url: 'flame' } }
  expect(usesWeaponUpgrades(rifle)).toBe(true)
  expect(usesWeaponUpgrades({ ...rifle, name: 'Other', data: {} })).toBe(false)
  const c: Character = { ...character([]), systems: ['sf2e'], weapons: [
    { id: 'w', name: rifle.name, potency: 0, striking: 0, runes: [], upgrades: ['flame'] },
  ] }
  const html = renderToStaticMarkup(<WeaponList c={c} entries={[rifle, flaming]} save={() => {}} />)
  expect(html.match(/Remove Flaming Module upgrade/g)).toHaveLength(1)
})

it('reads armor upgrade slots from the description when the data field is missing', () => {
  const suit = { id: 'a', name: 'Suit', systems: ['sf2e'], data: {}, description: 'Upgrades 2\nBody text' } as unknown as ContentEntry
  expect(armorUpgradeSlots(suit)).toBe(2)
  expect(armorUpgradeSlots({ ...suit, data: { upgrade_slots: 1 } })).toBe(1)
  expect(armorUpgradeSlots({ ...suit, description: '' })).toBe(0)
})

it('uses armor upgrades instead of runes for SF2E-tagged armor', () => {
  const suit: ContentEntry = { ...weapon, id: 'starfinder-armor', name: 'Starfinder Armor', kind: 'armor', systems: ['sf2e'],
    data: { ac: 4, dex_cap: 2, armor_category: 'Light', upgrade_slots: 1 } }
  const upgrade: ContentEntry = { ...shifting, id: 'armor-upgrade', name: 'Thermal Capacitor', systems: ['sf2e'],
    data: { item_subcategory: 'Armor Upgrades' } }
  let c: Character = { ...character([]), systems: ['sf2e'], armors: [
    { id: 'starfinder-armor', name: suit.name, potency: 2, resilient: 2, runes: ['Shadow'], worn: true },
  ] }
  const second = { ...upgrade, id: 'armor-upgrade-2', name: 'Another Upgrade' }
  const entries = [suit, upgrade, second]
  const tree = () => ArmorList({ c, entries, save: patch => { c = { ...c, ...patch } } })
  const markup = renderToStaticMarkup(tree())
  expect(markup).toContain('Add armor upgrade')
  expect(markup).not.toContain('Armor material')
  expect(markup).not.toContain('Add property rune')
  expect(markup).not.toContain('Shadow')
  expect(markup).not.toContain('<label>Potency')
  expect(markup).not.toContain('<label>Resilient')
  expect(effectiveArmor(c, entries, c.armors![0])).toMatchObject({ potency: 0, resilient: 0, runes: [] })
  const component = findElement(tree(), element => typeof element.type === 'function' && element.type.name === 'ArmorUpgrades')!
  const content = (component.type as (props: typeof component.props) => ReactNode)(component.props)
  const select = findElement(content, element => element.props['aria-label'] === 'Add armor upgrade')!
  expect(renderToStaticMarkup(select)).toContain('Thermal Capacitor')
  ;(select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'armor-upgrade' } })
  expect(c.armors?.[0]).toMatchObject({ upgrades: ['armor-upgrade'], runes: ['Shadow'] })
  expect(renderToStaticMarkup(tree())).not.toContain('Add armor upgrade')
  const extraSlot = renderToStaticMarkup(ArmorList({ c: { ...c, heritage: 'Mod Fanatic Android' }, entries, save: () => {} }))
  expect(extraSlot).toContain('Add armor upgrade')
  expect(extraSlot).not.toContain('Armor upgrade slots:')
})

it('displays installed Starfinder armor upgrades alphabetically without changing saved order', () => {
  const suit: ContentEntry = { ...weapon, id: 'starfinder-sort', name: 'Sorted Suit', kind: 'armor', systems: ['sf2e'],
    data: { ac: 2, dex_cap: 2, armor_category: 'Light', upgrade_slots: 2 } }
  const jetpack: ContentEntry = { ...shifting, id: 'jetpack', name: 'Jetpack (Tactical)', systems: ['sf2e'],
    data: { item_subcategory: 'Armor Upgrades' } }
  const forceField: ContentEntry = { ...shifting, id: 'force-field', name: 'Force Field (Paragon)', systems: ['sf2e'],
    data: { item_subcategory: 'Armor Upgrades' } }
  const c: Character = { ...character([]), systems: ['sf2e'], armors: [
    { id: suit.id, name: suit.name, potency: 0, resilient: 0, runes: [],
      upgrades: [jetpack.id, forceField.id], worn: true },
  ] }
  const tree = ArmorList({ c, entries: [suit, jetpack, forceField], save: () => {} })
  const component = findElement(tree, element => typeof element.type === 'function' && element.type.name === 'ArmorUpgrades')!
  const content = (component.type as (props: typeof component.props) => ReactNode)(component.props)
  const markup = renderToStaticMarkup(content)
  expect(markup.indexOf('Force Field (Paragon)')).toBeLessThan(markup.indexOf('Jetpack (Tactical)'))
  expect(c.armors?.[0].upgrades).toEqual([jetpack.id, forceField.id])
})

it.each([
  ['Jetpack (Commercial)', 20],
  ['Jetpack (Tactical)', 40],
] as const)('toggles %s flight only while installed on worn armor', (name, flySpeed) => {
  const suit: ContentEntry = { ...weapon, id: 'suit', name: 'Suit', kind: 'armor', systems: ['sf2e'],
    data: { armor_category: 'Light', ac: 2, upgrade_slots: 1 } }
  const jetpack: ContentEntry = { ...shifting, id: 'jetpack', name, systems: ['sf2e'],
    data: { item_subcategory: 'Armor Upgrades' } }
  let c: Character = { ...character([]), systems: ['sf2e'], armors: [
    { id: 'suit', name: suit.name, potency: 0, resilient: 0, runes: [], upgrades: [jetpack.id], worn: true },
  ] }
  const entries = [suit, jetpack]
  const tree = () => ArmorList({ c, entries, save: patch => { c = { ...c, ...patch } } })
  const upgradeContent = () => {
    const component = findElement(tree(), element => typeof element.type === 'function' && element.type.name === 'ArmorUpgrades')!
    return (component.type as (props: typeof component.props) => ReactNode)(component.props)
  }
  expect(movementSpeeds(c, entries).find(speed => speed.name === 'Fly')).toBeUndefined()
  const activate = findElement(upgradeContent(), element => element.props['aria-label'] === `Activate ${name}`)!
  expect(renderToStaticMarkup(activate)).toContain('aria-label="Single Action"')
  ;(activate.props.onClick as () => void)()
  expect(movementSpeeds(c, entries).find(speed => speed.name === 'Fly')).toMatchObject({ feet: flySpeed, source: name })
  expect(movementSpeeds({ ...c, armors: [{ ...c.armors![0], worn: false }] }, entries)
    .find(speed => speed.name === 'Fly')).toBeUndefined()
  expect(movementSpeeds({ ...c, armors: [{ ...c.armors![0], upgrades: [] }] }, entries)
    .find(speed => speed.name === 'Fly')).toBeUndefined()
  expect(movementSpeeds(c, [{ ...suit, data: { ...suit.data, upgrade_slots: 0 } }, jetpack])
    .find(speed => speed.name === 'Fly')).toBeUndefined()
  const dismiss = findElement(upgradeContent(), element => element.props['aria-label'] === `Dismiss ${name}`)!
  ;(dismiss.props.onClick as () => void)()
  expect(movementSpeeds(c, entries).find(speed => speed.name === 'Fly')).toBeUndefined()
  ;(findElement(upgradeContent(), element => element.props['aria-label'] === `Activate ${name}`)!.props.onClick as () => void)()
  const wear = findElement(tree(), element => element.props['aria-label'] === 'Worn Suit')!
  ;(wear.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: false } })
  expect(c.armors?.[0].activeJetpack).toBeUndefined()
  ;(findElement(tree(), element => element.props['aria-label'] === 'Worn Suit')!.props.onChange as
    (event: { target: { checked: boolean } }) => void)({ target: { checked: true } })
  ;(findElement(upgradeContent(), element => element.props['aria-label'] === `Activate ${name}`)!.props.onClick as () => void)()
  const upgrade = findElement(tree(), element => typeof element.type === 'function' && element.type.name === 'ArmorUpgrades')!
  ;(upgrade.props.onChange as (ids: string[]) => void)([])
  expect(c.armors?.[0].activeJetpack).toBeUndefined()
})

it('reserves Clandestine Suit slots for its built-in Jetpack and Force Field', () => {
  const suit: ContentEntry = { ...weapon, id: 'clandestine', name: 'Clandestine Suit', kind: 'armor', systems: ['sf2e'],
    level: 9, data: { url: 'clandestine', armor_category: 'Light', ac: 3, armor_grade: 'Advanced', upgrade_slots: 2 } }
  const module = (name: string, level: number): ContentEntry => ({ ...shifting, id: name, name, level,
    systems: ['sf2e'], data: { item_subcategory: 'Armor Upgrades' } })
  const upgrades = [
    module('Jetpack (Commercial)', 5), module('Force Field (Advanced)', 7),
    module('Active Camouflage (Tactical)', 9), module('Cloaking Device (Commercial)', 8),
    module('Drift Drive Relay (Commercial)', 9),
  ]
  let c: Character = { ...character([{ name: 'Offensive Defense', type: 'Class Feat', level: 6 }]),
    systems: ['sf2e'], className: 'Soldier', level: 9, armors: [
      { id: 'clandestine', name: suit.name, potency: 0, resilient: 0, runes: [], worn: true },
    ] }
  const entries = [suit, ...upgrades]
  const tree = () => ArmorList({ c, entries, save: patch => { c = { ...c, ...patch } } })
  const upgradeContent = () => {
    const component = findElement(tree(), element => typeof element.type === 'function' && element.type.name === 'ArmorUpgrades')!
    return (component.type as (props: typeof component.props) => ReactNode)(component.props)
  }
  const markup = renderToStaticMarkup(tree())
  expect(automaticArmorUpgradeSlotsUsed(suit)).toBe(3)
  expect(markup).toContain('Jetpack (Commercial)')
  expect(markup).toContain('Force Field (Advanced)')
  expect(markup).toContain('Drift Drive Relay (Commercial)')
  expect(markup).not.toContain('Jetpack (Commercial) *')
  expect(markup).not.toContain('Force Field (Advanced) *')
  expect(markup).not.toContain('Drift Drive Relay (Commercial) *')
  expect(automaticArmorUpgradeUsesSlot(suit.name, upgrades[4])).toBe(true)
  expect(markup).toContain('Active Camouflage (Tactical) *')
  expect(markup).toContain('Cloaking Device (Commercial) *')
  expect(Math.max(0, resolvedArmorUpgradeSlots(suit) - automaticArmorUpgradeSlotsUsed(suit))).toBe(0)
  expect(markup).not.toContain('Add armor upgrade')
  expect(markup).not.toContain('Free (no upgrade slot)')
  expect(markup).not.toContain('Installed upgrades exceed available slots')
  expect(offensiveDefenseAttack(c, entries)).toBeDefined()
  const activate = findElement(upgradeContent(), element => element.props['aria-label'] === 'Activate Jetpack (Commercial)')!
  ;(activate.props.onClick as () => void)()
  expect(movementSpeeds(c, entries).find(speed => speed.name === 'Fly')).toMatchObject({
    feet: 20, source: 'Jetpack (Commercial)',
  })
})

it('leaves one Paragon Clandestine Suit upgrade slot, or two for Mod Fanatic Androids', () => {
  const suit: ContentEntry = { ...weapon, id: 'paragon-clandestine', name: 'Paragon Clandestine Suit',
    kind: 'armor', systems: ['sf2e'], level: 20,
    data: { armor_grade: 'Paragon', upgrade_slots: 2 } }
  const upgrades = [1, 2, 3].map(number => ({ ...shifting, id: `extra-${number}`, name: `Extra Upgrade ${number}`,
    systems: ['sf2e' as const], data: { item_subcategory: 'Armor Upgrades' } }))
  const entries = [suit, ...upgrades]
  const characterWith = (heritage?: string): Character => ({ ...character([]), systems: ['sf2e'], level: 20, heritage,
    armors: [{ id: suit.id, name: suit.name, potency: 0, resilient: 0, runes: [], worn: true,
      upgrades: upgrades.map(upgrade => upgrade.id) }] })
  expect(resolvedArmorUpgradeSlots(suit)).toBe(4)
  expect(automaticArmorUpgradeSlotsUsed(suit)).toBe(3)
  expect(armorUpgradeEntries(characterWith(), entries, characterWith().armors![0]).map(entry => entry.id))
    .toEqual(['extra-1'])
  const android = characterWith('Mod Fanatic Android')
  expect(armorUpgradeEntries(android, entries, android.armors![0]).map(entry => entry.id))
    .toEqual(['extra-1', 'extra-2'])
})

it('prevents installing more than one grade of Drift Drive Relay', () => {
  const commercial: ContentEntry = { ...shifting, id: 'relay-commercial', name: 'Drift Drive Relay (Commercial)',
    systems: ['sf2e'], data: { item_subcategory: 'Armor Upgrades' } }
  const advanced: ContentEntry = { ...commercial, id: 'relay-advanced', name: 'Drift Drive Relay (Advanced)' }
  const tree = ArmorUpgrades({ entries: [commercial, advanced], upgrades: [commercial.id], limit: 2, worn: true,
    onToggleJetpack: () => {}, onEnergyShieldingTypeChange: () => {}, onChange: () => {} })
  const markup = renderToStaticMarkup(tree)
  expect(markup).toContain('Drift Drive Relay (Commercial)')
  expect(markup).not.toContain('Drift Drive Relay (Advanced)')
  expect(markup).not.toContain('Add armor upgrade')
})

it('rolls Energized Spikes using their grade and clears their stored charge', () => {
  for (const [grade, level, dice] of [['Commercial', 4, 2], ['Tactical', 12, 5], ['Advanced', 19, 8]] as const) {
    const item: ContentEntry = { ...shifting, id: `spikes-${grade}`, name: `Energized Spikes (${grade})`, level,
      systems: ['sf2e'], data: { item_subcategory: 'Armor Upgrades' } }
    let charged: string | undefined = 'electricity'
    const tree = ArmorUpgrades({ entries: [item], upgrades: [], limit: 2, worn: true,
      onToggleJetpack: () => {}, onEnergyShieldingTypeChange: () => {}, onChange: () => {},
      onEnergizedSpikesEnergyChange: energy => { charged = energy }, energizedSpikesEnergy: 'electricity',
      automaticUpgrades: [item] })
    const roll = findElement(tree, element => element.type === DamageRoll)
    if (!roll) throw new Error('Missing Energized Spikes damage roll')
    expect(roll.props.damage).toMatchObject({ dice, sides: 4, type: 'electricity' })
    ;(roll.props.onRoll as () => void)()
    expect(charged).toBeUndefined()
    expect(renderToStaticMarkup(tree)).toContain('aria-label="Energized Spikes charged energy"')
  }
})

it('auto-installs Drifter Jacket upgrades, reserving slots for Jetpack, Force Field, and Active Camouflage', () => {
  const jacket: ContentEntry = { ...weapon, id: 'drifters-jacket', name: "Drifter's Jacket", kind: 'armor', systems: ['sf2e'],
    level: 10, description: 'A practical jacket.', data: { url: 'drifters-jacket', armor_category: 'Light', ac: 3, armor_grade: 'Advanced', upgrade_slots: 1 } }
  const module = (name: string, level: number): ContentEntry => ({ ...shifting, id: name, name, level,
    systems: ['sf2e'], data: { item_subcategory: 'Armor Upgrades' } })
  const upgrades = [
    module('Jetpack (Commercial)', 5), module('Force Field (Superior)', 10), module('Active Camouflage (Tactical)', 10),
    module('Drift Drive Relay (Commercial)', 9), module('Maneuvering Unit (Tactical)', 7),
  ]
  const c: Character = { ...character([]), systems: ['sf2e'], level: 10, armors: [
    { id: jacket.id, name: jacket.name, potency: 0, resilient: 0, runes: [], worn: true },
  ] }
  const entries = [jacket, ...upgrades]
  const markup = renderToStaticMarkup(ArmorList({ c, entries, save: () => {} }))
  expect(resolvedArmorUpgradeSlots(jacket)).toBe(2)
  expect(automaticArmorUpgradeSlotsUsed(jacket)).toBe(3)
  expect(markup).toContain('Drift Drive Relay (Commercial) *')
  expect(markup).toContain('Maneuvering Unit (Tactical) *')
  expect(markup).toContain('Force Field (Superior)')
  expect(markup).toContain('Jetpack (Commercial)')
  expect(markup).toContain('Active Camouflage (Tactical)')
  expect(markup).not.toContain('Jetpack (Commercial) *')
  expect(markup).not.toContain('Force Field (Superior) *')
  expect(markup).not.toContain('Active Camouflage (Tactical) *')
  expect(markup).toContain('Includes a Drift Drive Relay and Maneuvering Unit at no extra cost; neither uses an upgrade slot.')
  expect(markup).not.toContain('Free (no upgrade slot)')
  expect(markup).not.toContain('Add armor upgrade')
})

it('auto-installs Rocketeer Armor upgrades, reserving slots for Force Field and Maneuvering Unit only', () => {
  const armor: ContentEntry = { ...weapon, id: 'rocketeer-armor', name: 'Rocketeer Armor', kind: 'armor', systems: ['sf2e'],
    level: 9, data: { url: 'rocketeer-armor', armor_category: 'Light', ac: 3, armor_grade: 'Advanced', upgrade_slots: 2 } }
  const module = (name: string, level: number): ContentEntry => ({ ...shifting, id: name, name, level,
    systems: ['sf2e'], data: { item_subcategory: 'Armor Upgrades' } })
  const upgrades = [module('Jetpack (Tactical)', 9), module('Force Field (Advanced)', 7),
    module('Maneuvering Unit (Tactical)', 9)]
  const c: Character = { ...character([]), systems: ['sf2e'], level: 9, armors: [
    { id: armor.id, name: armor.name, potency: 0, resilient: 0, runes: [], worn: true },
  ] }
  const markup = renderToStaticMarkup(ArmorList({ c, entries: [armor, ...upgrades], save: () => {} }))
  expect(automaticArmorUpgradeSlotsUsed(armor)).toBe(2)
  expect(markup).toContain('Jetpack (Tactical) *')
  expect(markup).toContain('Force Field (Advanced)')
  expect(markup).toContain('Maneuvering Unit (Tactical)')
  expect(markup).not.toContain('Force Field (Advanced) *')
  expect(markup).not.toContain('Maneuvering Unit (Tactical) *')
  expect(markup).not.toContain('Add armor upgrade')
})

it('offers Acid, Cold, Electricity and Fire variants for Energy Shielding', () => {
  const suit: ContentEntry = { ...weapon, id: 'energy-suit', name: 'Energy Suit', kind: 'armor', systems: ['sf2e'],
    data: { armor_category: 'Light', ac: 2, upgrade_slots: 1 } }
  const shielding: ContentEntry = { ...shifting, id: 'energy-shielding', name: 'Energy Shielding (Advanced)',
    systems: ['sf2e'], level: 18, data: { item_subcategory: 'Armor Upgrades' } }
  let c: Character = { ...character([]), systems: ['sf2e'], level: 20, armors: [
    { id: suit.id, name: suit.name, potency: 0, resilient: 0, runes: [], upgrades: [shielding.id], worn: true },
  ] }
  const entries = [suit, shielding]
  const tree = () => ArmorList({ c, entries, save: patch => { c = { ...c, ...patch } } })
  const component = findElement(tree(), element => typeof element.type === 'function' && element.type.name === 'ArmorUpgrades')!
  const content = (component.type as (props: typeof component.props) => ReactNode)(component.props)
  const selector = findElement(content, element => element.props['aria-label'] === 'Energy Shielding type Energy Shielding (Advanced)')!
  const markup = renderToStaticMarkup(selector)
  for (const [type, label] of [['acid', 'Acid'], ['cold', 'Cold'], ['electricity', 'Electricity'], ['fire', 'Fire']])
    expect(markup).toContain(`<option value="${type}">${label}</option>`)
  ;(selector.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'fire' } })
  expect(c.armors?.[0].energyShieldingTypes).toEqual({ [shielding.id]: 'fire' })
  expect(resistances(c, entries)).toContainEqual({
    damage: 'Fire', value: 15, source: 'Energy Shielding (Advanced) (Fire)',
  })
})

it('auto-installs Retrieval Harness Easypatcher and scaling Adrenal Autoinjectors with correct slot usage', () => {
  const harness: ContentEntry = { ...weapon, id: 'retrieval-harness', name: 'Retrieval Harness', kind: 'armor', systems: ['sf2e'],
    level: 10, data: { url: 'retrieval-harness', armor_category: 'Light', ac: 3, armor_grade: 'Advanced', upgrade_slots: 3 } }
  const module = (name: string, level: number): ContentEntry => ({ ...shifting, id: name, name, level,
    systems: ['sf2e'], data: { item_subcategory: 'Armor Upgrades' } })
  const upgrades = [
    module('Jetpack (Commercial)', 5), module('Force Field (Superior)', 10),
    module('Easypatcher (Advanced)', 15), module('Adrenal Autoinjectors (Commercial)', 8),
    module('Adrenal Autoinjectors (Tactical)', 12), module('Adrenal Autoinjectors (Advanced)', 18),
    module('Mobility Enhancer', 4),
  ]
  const c: Character = { ...character([]), systems: ['sf2e'], level: 20, armors: [
    { id: harness.id, name: harness.name, potency: 0, resilient: 0, runes: [], worn: true },
  ] }
  const markup = renderToStaticMarkup(ArmorList({ c, entries: [harness, ...upgrades], save: () => {} }))
  expect(automaticArmorUpgradeSlotsUsed(harness)).toBe(3)
  const adrenalNameAt = (level: number) => automaticSpecificArmorUpgrades({ ...c, level }, [harness, ...upgrades], harness)
    .find(item => item.name.startsWith('Adrenal Autoinjectors'))?.name
  expect(adrenalNameAt(7)).toBeUndefined()
  expect(adrenalNameAt(8)).toBe('Adrenal Autoinjectors (Commercial)')
  expect(adrenalNameAt(12)).toBe('Adrenal Autoinjectors (Tactical)')
  expect(adrenalNameAt(18)).toBe('Adrenal Autoinjectors (Advanced)')
  expect(automaticArmorUpgradeUsesSlot(harness.name, upgrades[3])).toBe(true)
  expect(automaticArmorUpgradeUsesSlot(harness.name, upgrades[2])).toBe(false)
  expect(markup).toContain('Easypatcher (Advanced) *')
  expect(markup).toContain('Adrenal Autoinjectors (Advanced)')
  expect(markup).not.toContain('Adrenal Autoinjectors (Advanced) *')
  expect(markup).toContain('Jetpack (Commercial)')
  expect(markup).toContain('Force Field (Superior)')
  expect(markup).not.toContain('Jetpack (Commercial) *')
  expect(markup).not.toContain('Force Field (Superior) *')
  expect(markup).toContain('Add armor upgrade')
})

it('auto-installs Stormbreaker upgrades and reserves slots for Jetpack, Force Field, and Mobility Enhancer', () => {
  const armor: ContentEntry = { ...weapon, id: 'stormbreaker', name: 'Stormbreaker Armor', kind: 'armor', systems: ['sf2e'],
    level: 10, data: { url: 'stormbreaker', armor_category: 'Medium', ac: 4, armor_grade: 'Advanced', upgrade_slots: 2 } }
  const module = (name: string, level: number): ContentEntry => ({ ...shifting, id: name, name, level,
    systems: ['sf2e'], data: { item_subcategory: 'Armor Upgrades' } })
  const upgrades = [
    module('Jetpack (Tactical)', 19), module('Force Field (Paragon)', 19),
    module('Energized Spikes (Advanced)', 19), module('Energy Shielding (Advanced)', 18),
    module('Mobility Enhancer', 4),
  ]
  const c: Character = { ...character([]), systems: ['sf2e'], level: 20, armors: [
    { id: armor.id, name: armor.name, potency: 0, resilient: 0, runes: [], worn: true },
  ] }
  const markup = renderToStaticMarkup(ArmorList({ c, entries: [armor, ...upgrades], save: () => {} }))
  expect(automaticArmorUpgradeSlotsUsed(armor)).toBe(3)
  expect(markup).not.toContain('Add armor upgrade')
  expect(markup).toContain('Jetpack (Tactical)')
  expect(markup).toContain('Force Field (Paragon)')
  expect(markup).toContain('Energized Spikes (Advanced)')
  expect(markup).toContain('Energy Shielding (Advanced) (Electricity) *')
  expect(markup).toContain('Mobility Enhancer')
  expect(markup).not.toContain('Jetpack (Tactical) *')
  expect(markup).not.toContain('Force Field (Paragon) *')
  expect(markup).not.toContain('Mobility Enhancer *')
  expect(automaticArmorUpgradeUsesSlot(armor.name, upgrades[4])).toBe(true)
  expect(automaticSpecificArmorUpgrades(c, [armor, ...upgrades], armor).map(item => item.name))
    .toContain('Mobility Enhancer')
})

it('leaves one upgrade slot on Paragon Stormbreaker Armor after built-in upgrades', () => {
  const armor: ContentEntry = { ...weapon, id: 'paragon-stormbreaker', name: 'Paragon Stormbreaker Armor',
    kind: 'armor', systems: ['sf2e'], level: 20,
    data: { armor_grade: 'Paragon', upgrade_slots: 2 } }
  expect(resolvedArmorUpgradeSlots(armor)).toBe(4)
  expect(resolvedArmorUpgradeSlots(armor) - automaticArmorUpgradeSlotsUsed(armor)).toBe(1)
})

it('auto-installs Aeon Guard Battle Dress Jetpack and Force Field using two upgrade slots', () => {
  const armor: ContentEntry = { ...weapon, id: 'aeon-guard', name: 'Aeon Guard Battle Dress', kind: 'armor', systems: ['sf2e'],
    level: 9, data: { url: 'aeon-guard-battle-dress', armor_category: 'Light', ac: 3, armor_grade: 'Commercial', upgrade_slots: 2 } }
  const module = (name: string, level: number): ContentEntry => ({ ...shifting, id: name, name, level,
    systems: ['sf2e'], data: { item_subcategory: 'Armor Upgrades' } })
  const upgrades = [module('Jetpack (Tactical)', 9), module('Force Field (Advanced)', 7)]
  const c: Character = { ...character([]), systems: ['sf2e'], level: 9, armors: [
    { id: armor.id, name: armor.name, potency: 0, resilient: 0, runes: [], worn: true },
  ] }
  const markup = renderToStaticMarkup(ArmorList({ c, entries: [armor, ...upgrades], save: () => {} }))
  expect(automaticArmorUpgradeSlotsUsed(armor)).toBe(2)
  expect(markup).toContain('Jetpack (Tactical)')
  expect(markup).toContain('Force Field (Advanced)')
  expect(markup).not.toContain('Jetpack (Tactical) *')
  expect(markup).not.toContain('Force Field (Advanced) *')
  expect(markup).not.toContain('Add armor upgrade')
})

it('auto-installs Aquavarius Armor Aqua Jets and cold Energy Shielding without Jetpack', () => {
  const armor: ContentEntry = { ...weapon, id: 'aquavarius-armor', name: 'Aquavarius Armor', kind: 'armor', systems: ['sf2e'],
    level: 9, data: { url: 'aquavarius-armor', armor_category: 'Light', ac: 3, armor_grade: 'Commercial', upgrade_slots: 2 } }
  const module = (name: string, level: number): ContentEntry => ({ ...shifting, id: name, name, level,
    systems: ['sf2e'], data: { item_subcategory: 'Armor Upgrades' } })
  const upgrades = [module('Jetpack (Tactical)', 9), module('Force Field (Advanced)', 7),
    module('Aqua Jets (Tactical)', 17), module('Energy Shielding (Advanced)', 18)]
  const c: Character = { ...character([]), systems: ['sf2e'], level: 20, armors: [
    { id: armor.id, name: armor.name, potency: 0, resilient: 0, runes: [], worn: true },
  ] }
  const markup = renderToStaticMarkup(ArmorList({ c, entries: [armor, ...upgrades], save: () => {} }))
  expect(automaticArmorUpgradeSlotsUsed(armor)).toBe(2)
  expect(markup).toContain('Aqua Jets (Tactical) *')
  expect(markup).toContain('Energy Shielding (Advanced) (Cold)')
  expect(markup).not.toContain('Jetpack (Tactical)')
  expect(markup).not.toContain('Force Field (Advanced) *')
  expect(markup).not.toContain('Energy Shielding (Advanced) (Cold) *')
  expect(resistances(c, [armor, ...upgrades])).toContainEqual({
    damage: 'Cold', value: 15, source: 'Energy Shielding (Advanced) (Cold)',
  })
  expect(markup).not.toContain('Add armor upgrade')
})

it('marks all automatic Carvesong upgrades as slot-taking', () => {
  const armor: ContentEntry = { ...weapon, id: 'carvesong', name: 'Carvesong', kind: 'armor', systems: ['sf2e'],
    level: 9, data: { url: 'carvesong', armor_category: 'Light', ac: 3, armor_grade: 'Advanced', upgrade_slots: 4 } }
  const module = (name: string, level: number): ContentEntry => ({ ...shifting, id: name, name, level,
    systems: ['sf2e'], data: { item_subcategory: 'Armor Upgrades' } })
  const upgrades = [module('Jetpack (Tactical)', 9), module('Force Field (Paragon)', 19),
    module('Spell Gauntlet', 10), module('Spell Refactoring Matrix', 5)]
  const c: Character = { ...character([]), systems: ['sf2e'], level: 20, armors: [
    { id: armor.id, name: armor.name, potency: 0, resilient: 0, runes: [], worn: true },
  ] }
  const markup = renderToStaticMarkup(ArmorList({ c, entries: [armor, ...upgrades], save: () => {} }))
  expect(automaticArmorUpgradeSlotsUsed(armor)).toBe(4)
  expect(markup).toContain('Jetpack (Tactical)')
  expect(markup).toContain('Force Field (Paragon)')
  expect(markup).toContain('Spell Gauntlet')
  expect(markup).toContain('Spell Refactoring Matrix')
  expect(markup).not.toContain('Jetpack (Tactical) *')
  expect(markup).not.toContain('Force Field (Paragon) *')
  expect(markup).not.toContain('Spell Gauntlet *')
  expect(markup).not.toContain('Spell Refactoring Matrix *')
  expect(markup).not.toContain('Add armor upgrade')
})

it('marks all automatic Mageplate Spellmail upgrades as slot-taking', () => {
  const armor: ContentEntry = { ...weapon, id: 'mageplate', name: 'Mageplate', kind: 'armor', systems: ['sf2e'],
    level: 9, data: { url: 'mageplate', armor_category: 'Light', ac: 3, armor_grade: 'Advanced', upgrade_slots: 4 } }
  const module = (name: string, level: number): ContentEntry => ({ ...shifting, id: name, name, level,
    systems: ['sf2e'], data: { item_subcategory: 'Armor Upgrades' } })
  const upgrades = [module('Jetpack (Tactical)', 19), module('Force Field (Paragon)', 19),
    module('Spell Gauntlet', 10), module('Spell Refactoring Matrix', 5)]
  const c: Character = { ...character([]), systems: ['sf2e'], level: 20, armors: [
    { id: armor.id, name: armor.name, potency: 0, resilient: 0, runes: [], worn: true },
  ] }
  const markup = renderToStaticMarkup(ArmorList({ c, entries: [armor, ...upgrades], save: () => {} }))
  expect(automaticArmorUpgradeSlotsUsed(armor)).toBe(4)
  for (const name of ['Jetpack (Tactical)', 'Force Field (Paragon)', 'Spell Gauntlet', 'Spell Refactoring Matrix']) {
    expect(markup).toContain(name)
    expect(markup).not.toContain(`${name} *`)
  }
})

it('places leveled SF2e and homebrew specific armor separately from standard armor', () => {
  const armor: ContentEntry = { ...weapon, kind: 'armor', systems: ['sf2e'], name: 'Carvesong', level: 9,
    data: { item_subcategory: 'Base Armor' } }
  expect(isSpecificGear(armor)).toBe(true)
  expect(isSpecificGear({ ...armor, name: 'Armored Coat', level: 0 })).toBe(false)
  expect(isSpecificGear({ ...armor, name: 'Flight Suit', level: 1 })).toBe(false)
  expect(isSpecificGear({ ...armor, source: 'homebrew', level: 0, traits: ['Magical'] })).toBe(true)
  expect(isSpecificGear({ ...armor, source: 'homebrew', level: 0, traits: [] })).toBe(false)
})

it('automatically upgrades SF2e armor without discarding installed upgrades', () => {
  const armor: ContentEntry = { ...weapon, kind: 'armor', systems: ['sf2e'], name: 'Armored Coat', level: 0,
    data: { url: 'coat', armor_category: 'Light', ac: 2, upgrade_slots: 1, armor_grade: 'Commercial' } }
  const tactical = { ...armor, id: 'tactical', name: 'Tactical Armored Coat', level: 5,
    data: { ...armor.data, ac: 3, upgrade_slots: 2, armor_grade: 'Tactical' } }
  const commercial = { ...armor, id: 'commercial', name: 'Commercial Armored Coat' }
  let c: Character = { ...character([]), level: 5, systems: ['sf2e'], armors: [
    { id: 'coat', name: armor.name, potency: 0, resilient: 0, runes: [], upgrades: ['upgrade'], worn: true },
  ] }
  const entries = [armor, commercial, tactical]
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={entries} save={() => {}} />)
  expect(markup).not.toContain('Armor upgrade slots:')
  expect(markup).toContain('class="equipment-name" aria-haspopup="dialog">Armored Coat</button>')
  expect(markup).not.toContain('aria-label="Armor grade: Armored Coat"')
  expect(markup).not.toContain('Grade: Tactical')
  expect(markup).toContain('<small>Armor Class</small><b>3</b>')
  expect(markup).not.toContain('aria-label="Worn Tactical Armored Coat"')
  expect(c.armors?.[0]).toMatchObject({ name: armor.name, upgrades: ['upgrade'], worn: true })
  const tree = ArmorList({ c, entries, save: patch => { c = { ...c, ...patch } } })
  ;(findElement(tree, e => e.props['aria-label'] === 'Worn Armored Coat')!.props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: false } })
  expect(c.armors?.[0]).toMatchObject({ name: armor.name, upgrades: ['upgrade'], worn: false })
  expect(effectiveArmor({ ...c, level: 1 }, entries, c.armors![0]).name).toBe(armor.name)
})

it('shows only one grade-scaled Resilient bonus on Starfinder armor', () => {
  const armor: ContentEntry = { ...weapon, id: 'elite-carvesong', name: 'Elite Carvesong', kind: 'armor', systems: ['sf2e'],
    traits: ['Resilient', 'Resilient', 'Safeguard'],
    description: 'Elite Carvesong Resilient +1 Safeguard Improvements Grade Elite Resilient +2 Armor Specialization Effects',
    data: { armor_category: 'Light', ac: 4, armor_grade: 'Elite', grade_save_bonus: 2, upgrade_slots: 2 } }
  const c: Character = { ...character([]), systems: ['sf2e'], armors: [
    { id: 'elite-carvesong', name: armor.name, potency: 0, resilient: 0, runes: [], worn: true },
  ] }
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[armor]} save={() => {}} />)
  expect(markup.match(/\bResilient\b/g)).toHaveLength(1)
  expect(markup).toContain('<small>Resilient</small>+2')
  expect(markup).not.toContain('Improvements')
  expect(markup).not.toContain('Resilient +1')
})

it('keeps the base name for paragon armor while retaining its grade and AC', () => {
  const armor: ContentEntry = { ...weapon, id: 'tempweave', name: 'Tempweave', kind: 'armor', systems: ['sf2e'],
    data: { url: 'tempweave', armor_category: 'Light', ac: 2, armor_grade: 'Commercial', upgrade_slots: 1 } }
  const paragon: ContentEntry = { ...armor, id: 'paragon', name: 'Paragon Tempweave', level: 20,
    data: { ...armor.data, ac: 5, armor_grade: 'Paragon', upgrade_slots: 4, grade_save_bonus: 3 } }
  const c: Character = { ...character([]), systems: ['sf2e'], armors: [
    { id: 'armor', name: paragon.name, potency: 0, resilient: 0, runes: [], upgrades: [], worn: true },
  ] }
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={[armor, paragon]} save={() => {}} />)
  expect(markup).toContain('class="equipment-name" aria-haspopup="dialog">Tempweave</button>')
  expect(markup).not.toContain('aria-label="Armor grade: Tempweave"')
  expect(markup).not.toContain('Grade: Paragon')
  expect(markup).toContain('<small>Armor Class</small><b>5</b>')
  expect(markup).not.toContain('Armor upgrade slots:')
  expect(c.armors?.[0].name).toBe('Paragon Tempweave')
  expect(armorDisplayName({ name: 'Paragon Tempweave' }, { ...paragon, systems: ['pf2e'] })).toBe('Paragon Tempweave')
})

it('shows Vesk granted unarmed attacks without repeating Vesk in their names', () => {
  const c: Character = { ...character([]), systems: ['sf2e'], ancestry: 'Vesk', weapons: [],
    feats: [{ name: 'Brutal Anatomy', type: 'Ancestry Feat', level: 1, choice: 'Claw' }] }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('aria-label="Claws"')
  expect(markup).not.toContain('Vesk Claw')
  expect(markup).not.toContain('Vesk Jaws')
})

it('keeps the base name when displaying upgraded SF2E weapon grades', () => {
  const grade = (id: string, name: string, level: number): ContentEntry => ({
    ...weapon, id, name, level, systems: ['sf2e'], traits: ['Tech'],
    data: { weapon_category: 'Martial', weapon_type: 'Melee', hands: '2', damage: '1d8 slashing',
      upgrade_slots: 1, url: 'doshko' },
  })
  const base = grade('doshko', 'Doshko', 0)
  const tactical = grade('tactical-doshko', 'Tactical Doshko', 2)
  const paragon = grade('paragon-doshko', 'Paragon Doshko', 20)
  const c: Character = { ...character([]), systems: ['sf2e'], weapons: [
    { id: 'doshko', name: paragon.name, potency: 0, striking: 0, runes: [] },
  ] }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[base, tactical, paragon]} save={() => {}} />)
  expect(markup).toContain('aria-label="Doshko"')
  expect(markup).not.toContain('Weapon grade')
})

it.each([false, true])('orders weapons alphabetically by displayed name regardless of equipped state (displayOnly=%s)', displayOnly => {
  const axe = { ...weapon, id: 'axe', name: 'Axe' }
  const spear = { ...weapon, id: 'spear', name: 'Spear' }
  const c: Character = { ...character([]), weapons: [
    { id: 's', name: 'Spear', potency: 0, striking: 0, runes: [] },
    { id: 'l', name: 'Longsword', potency: 0, striking: 0, runes: [], stowed: true },
    { id: 'a', name: 'Axe', potency: 0, striking: 0, runes: [], stowed: true },
  ] }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[axe, weapon, spear]} save={() => {}} displayOnly={displayOnly} />)
  const at = (name: string) => markup.indexOf(name)
  expect(at('Axe')).toBeGreaterThan(-1)
  expect(at('Axe')).toBeLessThan(at('Longsword'))
  expect(at('Longsword')).toBeLessThan(at('Spear'))
})
