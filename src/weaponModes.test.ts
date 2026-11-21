import { expect, it } from 'vitest'
import { weaponAttack, weaponEntry } from './builder'
import { parseWeaponModes } from './weaponModes'
import type { Character, ContentEntry, OwnedWeapon } from './types'

const phaseModes = parseWeaponModes('<title level="2">Mode 1</title><traits><trait label="Agile" /><trait label="Finesse" /><trait label="Analog" /><trait label="Sweep" /></traits>\n**Damage** 1d6 S\n'
  + '<title level="2">Mode 2</title><traits><trait label="Agile" /><trait label="Finesse" /><trait label="Powered" /><trait label="Tech" /><trait label="Sweep" /></traits>\n**Damage** 1d6 V')
const ripperModes = parseWeaponModes('<title level="2">Mode 1</title><traits><trait label="Caster" /><trait label="Magical" /><trait label="Tech" /><trait label="Tracking" /><trait label="Unwieldy" /><trait label="Razing" /></traits>\n**Damage** 1d8 A\n'
  + '<title level="2">Mode 2</title><traits><trait label="Caster" /><trait label="Magical" /><trait label="Tech" /><trait label="Tracking" /><trait label="Unwieldy" /><trait label="Deadly 1d10" /></traits>\n**Damage** 1d8 V')
const phase: ContentEntry = {
  id: 'phase', name: 'Phase Cutlass', kind: 'weapon', source: 'official', systems: ['sf2e'], level: 4,
  traits: ['Agile', 'Finesse', 'Modular', 'Sweep', 'Analog', 'Powered', 'Tech', 'Tracking'],
  weaponModes: phaseModes,
  data: { damage: '2d6 Modular', damage_type: 'Slashing, Void', weapon_category: 'Martial',
    weapon_type: 'Melee', hands: 1, weapon_tracking: 1, upgrade_slots: 2, url: 'https://2e.aonsrd.com/equipment/weapons/20-phase-cutlass' },
  description: '', effects: [], updatedAt: 1,
}
const ripper: ContentEntry = { ...phase, id: 'ripper', name: 'Reality Ripper', weaponModes: ripperModes,
  traits: ['Caster', 'Magical', 'Modular', 'Tech', 'Tracking', 'Unwieldy', 'Razing', 'Deadly'],
  data: { ...phase.data, damage: '2d8 Modular', damage_type: 'Acid, Void', weapon_type: 'Ranged', hands: 2, range: 40 } }
const c: Character = {
  id: 'modes', name: 'Test', level: 10, className: 'Fighter', systems: ['sf2e'],
  abilities: { str: 18, dex: 20, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const weapon: OwnedWeapon = { id: 'weapon', name: phase.name, potency: 3, striking: 3, runes: [], upgrades: [] }

it('switches Phase Cutlass damage and powered traits without altering its grade or hand requirements', () => {
  const analog = weaponAttack(c, [phase], weapon)
  const powered = weaponAttack(c, [phase], { ...weapon, weaponMode: 'mode-2' })
  expect(analog.damage).toBe('2d6+4 slashing')
  expect(powered.damage).toBe('2d6+4 void')
  expect(analog.traits).toContain('Analog')
  expect(analog.traits).not.toContain('Powered')
  expect(analog.traits).not.toContain('Tech')
  expect(powered.traits).toEqual(expect.arrayContaining(['Powered', 'Tech', 'Agile', 'Finesse', 'Sweep']))
  expect(powered.traits).not.toContain('Analog')
  expect(powered.attack).toBe(analog.attack)
  expect(powered.item).toBe(1)
  expect(powered.entry?.data.hands).toBe(1)
  expect(powered.entry?.data.upgrade_slots).toBe(2)
  expect(phase.traits).toContain('Analog')
  expect(phase.data.damage).toBe('2d6 Modular')
})

it('gives Reality Ripper Razing only in destructive mode and Deadly d10 only in reaping mode', () => {
  const destructive = weaponAttack(c, [ripper], { ...weapon, name: ripper.name })
  const reaping = weaponAttack(c, [ripper], { ...weapon, name: ripper.name, weaponMode: 'mode-2' })
  expect(destructive.damage).toBe('2d8 acid')
  expect(destructive.traits).toContain('Razing')
  expect(destructive.traits.some(trait => /^deadly/i.test(trait))).toBe(false)
  expect(reaping.damage).toBe('2d8 void')
  expect(reaping.traits).toContain('Deadly d10')
  expect(reaping.traits).not.toContain('Razing')
  expect(reaping.item).toBe(1)
  expect(reaping.range).toBe(40)
})

it('inherits mode rules for source-linked homebrew while preserving its custom damage dice', () => {
  const clone = { ...phase, id: 'clone', name: 'Custom Phase Cutlass', source: 'homebrew' as const,
    weaponModes: undefined, data: { ...phase.data, damage: '3d10 Modular' } }
  expect(weaponEntry([phase, clone], clone.name)?.weaponModes).toEqual(phase.weaponModes)
  expect(weaponAttack(c, [phase, clone], { ...weapon, name: clone.name, weaponMode: 'mode-2' }).damage).toBe('3d10+4 void')
})

it('shows parameterized and lowercase mode traits cleanly without a duplicate bare trait', () => {
  const claw: ContentEntry = { ...phase, id: 'claw', name: 'Crimson Claw', weaponModes: parseWeaponModes(
    '<title level="2">Mode 1</title><traits><trait label="Agile" /><trait label="critical [flame]" /><trait label="tech" /></traits>\n**Damage** 1d4 F\n'
    + '<title level="2">Mode 2</title><traits><trait label="Agile" /><trait label="analog" /></traits>\n**Damage** 1d4 S'),
  traits: ['Agile', 'Modular', 'Critical', 'Tech', 'Analog'], data: { ...phase.data, damage: '1d4 Modular' } }
  const traits = (weaponMode: string) => weaponAttack(c, [claw], { id: 'w', name: claw.name, potency: 0, striking: 0, runes: [], weaponMode }).traits
  expect(traits('mode-2')).toContain('Analog')
  expect(traits('mode-2')).not.toContain('analog')
  expect(traits('mode-1')).toContain('Critical (Flame)')
  expect(traits('mode-1')).not.toContain('Critical')
})
