import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { effectiveWeapon, featChoiceOptions, gearPickerEntries, weaponAttack } from './builder'
import { isSpecificGear, WeaponList } from './GearSection'
import { namedWeaponAbilities } from './namedWeapons'
import { sfSpecificWeapons } from './sfSpecificWeapons'
import { getSettings, updateSettings } from './settings'
import type { Character, ContentEntry, OwnedWeapon } from './types'

const base: Character = {
  id: 'c', name: 'Test', systems: ['sf2e'], level: 11, className: 'Witchwarper',
  abilities: { str: 14, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

function weapon(name: string, grade: string, level: number, price: number, melee = false): ContentEntry {
  return { id: `${grade}-${name}`, name: `${grade} ${name}`.trim(), kind: 'weapon', source: 'official', systems: ['sf2e'], level,
    traits: [melee ? 'Analog' : 'Tech'], description: '', effects: [], updatedAt: 1,
    data: { weapon_type: melee ? 'Melee' : 'Ranged', weapon_category: name === 'Rotating Pistol' ? 'Martial' : 'Simple',
      damage: level >= 4 ? '2d6 P' : '1d6 P', weapon_tracking: level >= 10 ? 2 : 1,
      upgrade_slots: level >= 4 ? 2 : 1, hands: 1, range: melee ? 0 : 40, price, url: name } }
}
const grades = [['Tactical', 2, 380], ['Advanced', 4, 1030], ['Superior', 10, 10030],
  ['Elite', 12, 20030], ['Ultimate', 16, 100030], ['Paragon', 19, 400030]] as const
const originals = ['Semi-Auto Pistol', 'Rotating Pistol', 'Gyrojet Pistol', 'Laser Pistol', 'Laser Rifle', 'Baton', 'Phase Cutlass']
  .flatMap(name => ([['', 0, 30] as const, ...grades]).map(([grade, level, price]) => {
    const entry = weapon(name, grade, level, price, ['Baton', 'Phase Cutlass'].includes(name))
    return name === 'Phase Cutlass' ? { ...entry, data: { ...entry.data, damage: '2d6 Modular' }, weaponModes: [
      { id: 'mode-1', damageType: 'slashing', traits: ['Analog', 'Agile', 'Finesse'] },
      { id: 'mode-2', damageType: 'void', traits: ['Powered', 'Tech', 'Agile', 'Finesse'] },
    ] } : entry
  }))
const generated = sfSpecificWeapons(originals)
const entries = [...originals, ...generated]
const owned = (name: string): OwnedWeapon => ({ id: 'w', name, potency: 0, striking: 0, runes: [] })

it('provides specific variants with underlying weapon stats, prices and activations', () => {
  for (const [name, source, ability] of [
    ['Starday Night Special (Semi-Auto Pistol)', 'official', 'Lucky Bullet'],
    ['Starday Night Special (Rotating Pistol)', 'homebrew', 'Lucky Bullet'],
    ['Starday Night Special (Gyrojet Pistol)', 'homebrew', 'Lucky Bullet'],
    ['SLARP Laser Pistol', 'official', 'Sample Return'],
    ['Liminal Laser Rifle', 'official', 'Liminal Lock'],
    ['Stun Stick', 'official', 'Short, Sharp Shock'],
    ['Raptorial Edge', 'official', 'Mind Slice'],
  ] as const) {
    const entry = generated.find(item => item.name === name)!
    expect(entry.source).toBe(source)
    expect(isSpecificGear(entry)).toBe(true)
    expect(namedWeaponAbilities(entry)).toContainEqual(expect.objectContaining({ name: ability,
      actions: ['Lucky Bullet', 'Sample Return', 'Mind Slice'].includes(ability) ? 'Free Action' : 'Single Action' }))
    expect(gearPickerEntries(entries, 'weapon').map(item => item.name)).toContain(name)
  }
  expect(generated.find(item => item.name === 'Starday Night Special (Rotating Pistol)')?.data.price).toBe(580)
  expect(generated.find(item => item.name === 'SLARP Laser Pistol')?.data.professional_skills).toBe('Geology Lore;Physical Science Lore')
  expect(generated.find(item => item.name === 'Liminal Laser Rifle')?.data.price).toBe(1230)
  const baton = generated.find(item => item.name === 'Superior Stun Stick')!
  expect(baton).toMatchObject({ level: 11, data: { price: 13000 }, description: expect.stringContaining('DC 28') })
  expect(effectiveWeapon(base, entries, owned('Stun Stick')).name).toBe('Superior Stun Stick')
  expect(effectiveWeapon({ ...base, level: 10 }, entries, owned('Stun Stick')).name).toBe('Stun Stick')
  expect(effectiveWeapon({ ...base, level: 4 }, entries, owned('Starday Night Special (Rotating Pistol)')).name)
    .toBe('Advanced Starday Night Special (Rotating Pistol)')
})

it('uses base-weapon proficiency without duplicate Unconventional Weaponry choices', () => {
  const c: Character = { ...base, feats: [{ name: 'Unconventional Weaponry', type: 'Ancestry Feat', level: 1, choice: 'Rotating Pistol' }] }
  const options = featChoiceOptions('Unconventional Weaponry', c, entries, '')!
  expect(options).toContain('Rotating Pistol')
  expect(options).not.toContain('Starday Night Special (Rotating Pistol)')
  expect(weaponAttack(c, entries, owned('Starday Night Special (Rotating Pistol)')).rank).toBeGreaterThan(0)
})

it('displays the gyrojet name without parentheses while preserving saved identity and grade scaling', () => {
  const weapon = owned('Starday Night Special (Gyrojet Pistol)')
  const html = renderToStaticMarkup(<WeaponList c={{ ...base, weapons: [weapon] }} entries={entries} save={() => {}} />)
  expect(html).toContain('Starday Night Special Gyrojet Pistol')
  expect(html).not.toContain('Starday Night Special (Gyrojet Pistol)')
  expect(effectiveWeapon(base, entries, weapon).name).toBe('Superior Starday Night Special (Gyrojet Pistol)')
  expect(weapon.name).toBe('Starday Night Special (Gyrojet Pistol)')
})

it('displays the rotating pistol name without parentheses while preserving saved identity', () => {
  const weapon = owned('Starday Night Special (Rotating Pistol)')
  const html = renderToStaticMarkup(<WeaponList c={{ ...base, weapons: [weapon] }} entries={entries} save={() => {}} />)
  expect(html).toContain('Starday Night Special Rotating Pistol')
  expect(html).not.toContain('Starday Night Special (Rotating Pistol)')
  expect(weapon.name).toBe('Starday Night Special (Rotating Pistol)')
})

it('displays the semi-auto pistol name without parentheses while preserving saved identity and grade scaling', () => {
  const weapon = owned('Starday Night Special (Semi-Auto Pistol)')
  const html = renderToStaticMarkup(<WeaponList c={{ ...base, weapons: [weapon] }} entries={entries} save={() => {}} />)
  expect(html).toContain('Starday Night Special Semi-Auto Pistol')
  expect(html).not.toContain('Starday Night Special (Semi-Auto Pistol)')
  expect(effectiveWeapon(base, entries, weapon).name).toBe('Superior Starday Night Special (Semi-Auto Pistol)')
  expect(weapon.name).toBe('Starday Night Special (Semi-Auto Pistol)')
})

it('preserves Raptorial Edge modes, acid damage and permanently occupied upgrade slot', () => {
  const blade = owned('Raptorial Edge')
  const character = { ...base, weapons: [blade] }
  const attack = weaponAttack(character, entries, { ...blade, weaponMode: 'mode-2' })
  expect(attack.damage).toContain('mental')
  expect(weaponAttack(character, entries, blade).damage).toContain('slashing')
  expect(attack.additionalDamage).toContainEqual(expect.objectContaining({ value: '1d6 acid',
    note: expect.stringContaining('1d10 persistent acid') }))
  const noModes = originals.map(item => item.name.endsWith('Phase Cutlass') ? { ...item, weaponModes: undefined } : item)
  expect(sfSpecificWeapons(noModes).find(item => item.name === 'Raptorial Edge')?.weaponModes?.[1].damageType).toBe('mental')
  const improved = weaponAttack(character, entries, { ...blade, raptorialImproved: true })
  expect(improved.additionalDamage).toContainEqual(expect.objectContaining({ note: expect.stringContaining('2d10 persistent acid') }))
  const upgrade: ContentEntry = { ...weapon('Extra', 'Advanced', 4, 1), id: 'upgrade', kind: 'item',
    data: { item_subcategory: 'Weapon Upgrades' } }
  const html = renderToStaticMarkup(<WeaponList c={{ ...character, weapons: [{ ...blade, upgrades: ['upgrade'] }] }}
    entries={[...entries, upgrade]} save={() => {}} />)
  expect(html).not.toContain('aria-label="Add weapon upgrade"')
  expect(html).toContain('Improved acid upgrade')
})

it('displays Raptorial Edge with its phase cutlass type without changing saved identity', () => {
  const blade = owned('Raptorial Edge')
  const html = renderToStaticMarkup(<WeaponList c={{ ...base, weapons: [blade] }} entries={entries} save={() => {}} />)
  expect(html).toContain('Raptorial Edge Phase Cutlass')
  expect(blade.name).toBe('Raptorial Edge')
})

it('automatically improves Raptorial Edge acid at level 15 and scales its weapon grade', () => {
  const previous = getSettings().automaticSfWeaponUpgrades
  const blade = owned('Raptorial Edge')
  const acidNote = (level: number) => weaponAttack({ ...base, level }, entries, blade).additionalDamage
    .find(damage => damage.source === 'Raptorial Edge')?.note
  try {
    updateSettings({ automaticSfWeaponUpgrades: true })
    expect(acidNote(14)).toContain('1d10 persistent acid')
    expect(acidNote(15)).toContain('2d10 persistent acid')
    expect(acidNote(15)).toContain('ignores acid resistance')
    expect(effectiveWeapon({ ...base, level: 16 }, entries, blade).name).toBe('Ultimate Raptorial Edge')
    const html = renderToStaticMarkup(<WeaponList c={{ ...base, level: 15, weapons: [blade] }} entries={entries} save={() => {}} />)
    expect(html).toMatch(/aria-label="Improved Raptorial Edge upgrade"[^>]*disabled=""[^>]*checked=""/)
    updateSettings({ automaticSfWeaponUpgrades: false })
    expect(acidNote(15)).toContain('1d10 persistent acid')
    expect(weaponAttack({ ...base, level: 15 }, entries, { ...blade, raptorialImproved: true })
      .additionalDamage.find(damage => damage.source === 'Raptorial Edge')?.note).toContain('2d10 persistent acid')
  } finally { updateSettings({ automaticSfWeaponUpgrades: previous }) }
})
