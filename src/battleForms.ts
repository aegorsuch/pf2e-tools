import type { ContentEntry } from './types'

export const BATTLE_FORM_SPELLS = new Set(['Animal Form', 'Dinosaur Form', 'Untamed Form'])
type DinosaurAttack = { name: string; damage: string; traits?: string[]; reach?: number; bleed?: string; criticalBleed?: string }
export const DINOSAUR_FORMS: { name: string; speed: number; attacks: DinosaurAttack[] }[] = [
  { name: 'Ankylosaurus', speed: 25, attacks: [
    { name: 'Tail', damage: '2d6 bludgeoning', traits: ['Backswing'], reach: 10 },
    { name: 'Foot', damage: '2d6 bludgeoning' },
  ] },
  { name: 'Brontosaurus', speed: 25, attacks: [
    { name: 'Tail', damage: '2d6 bludgeoning', reach: 15 },
    { name: 'Foot', damage: '2d8 bludgeoning' },
  ] },
  { name: 'Deinonychus', speed: 40, attacks: [
    { name: 'Talon', damage: '2d4 piercing', traits: ['Agile'], bleed: '1' },
    { name: 'Jaws', damage: '1d10 piercing' },
  ] },
  { name: 'Stegosaurus', speed: 30, attacks: [
    { name: 'Tail', damage: '2d8 piercing', reach: 10 },
  ] },
  { name: 'Triceratops', speed: 30, attacks: [
    { name: 'Horn', damage: '2d8 piercing', criticalBleed: '1d6' },
    { name: 'Foot', damage: '2d6 bludgeoning' },
  ] },
  { name: 'Tyrannosaurus', speed: 30, attacks: [
    { name: 'Jaws', damage: '1d12 piercing', traits: ['Deadly d12'], reach: 10 },
    { name: 'Tail', damage: '1d10 bludgeoning', reach: 10 },
  ] },
]

export const DINOSAUR_WEAPONS: ContentEntry[] = DINOSAUR_FORMS.flatMap(form => form.attacks.map(attack => ({
  id: `spell:dinosaur-form:${form.name.toLowerCase()}:${attack.name.toLowerCase()}`,
  name: `${form.name} ${attack.name}`, kind: 'weapon' as const, systems: ['pf2e' as const], source: 'official' as const,
  level: 4, traits: ['Unarmed', ...(attack.traits ?? [])], description: '', effects: [], updatedAt: 0,
  data: { weapon_category: 'Unarmed', weapon_type: 'Melee', hands: 0, damage: attack.damage,
    reach: attack.reach ?? 5, dinosaur_form: form.name, persistent_bleed: attack.bleed ?? '', critical_bleed: attack.criticalBleed ?? '' },
})))

export const ANIMAL_FORMS: { name: string; speed: number; swimSpeed?: number; climbSpeed?: number;
  note?: string; attacks: { name: string; damage: string; traits?: string[]; reach?: number; extra?: string }[] }[] = [
  { name: 'Ape', speed: 25, climbSpeed: 20, attacks: [{ name: 'Fist', damage: '2d6 bludgeoning' }] },
  { name: 'Bear', speed: 30, attacks: [{ name: 'Jaws', damage: '2d8 piercing' }, { name: 'Claw', damage: '1d8 slashing', traits: ['Agile'] }] },
  { name: 'Bull', speed: 30, attacks: [{ name: 'Horn', damage: '2d8 piercing' }] },
  { name: 'Canine', speed: 40, attacks: [{ name: 'Jaws', damage: '2d8 piercing' }] },
  { name: 'Cat', speed: 40, attacks: [{ name: 'Jaws', damage: '2d6 piercing' }, { name: 'Claw', damage: '1d10 slashing', traits: ['Agile'] }] },
  { name: 'Deer', speed: 50, attacks: [{ name: 'Antler', damage: '2d6 piercing' }] },
  { name: 'Frog', speed: 25, swimSpeed: 25, attacks: [{ name: 'Jaws', damage: '2d6 bludgeoning' }, { name: 'Tongue', damage: '2d4 bludgeoning', reach: 15 }] },
  { name: 'Shark', speed: 0, swimSpeed: 35, note: 'Breathe underwater but not in air.', attacks: [{ name: 'Jaws', damage: '2d8 piercing' }] },
  { name: 'Snake', speed: 20, climbSpeed: 20, swimSpeed: 20, attacks: [{ name: 'Fangs', damage: '2d4 piercing', extra: '1d6 poison' }] },
  { name: 'Crab', speed: 25, swimSpeed: 15, note: 'Breathe in water and air.', attacks: [{ name: 'Big Claw', damage: '2d8 piercing' }, { name: 'Little Claw', damage: '2d4 piercing', traits: ['Agile'] }] },
  { name: 'Crocodile', speed: 25, swimSpeed: 30, note: 'Can hold your breath throughout the transformation.', attacks: [
    { name: 'Jaws', damage: '2d8 piercing' }, { name: 'Tail', damage: '1d8 bludgeoning', traits: ['Agile'] }] },
  { name: 'Orca', speed: 0, swimSpeed: 35, note: 'Can hold your breath throughout the transformation.', attacks: [{ name: 'Jaws', damage: '2d8 piercing' }] },
  { name: 'Seal', speed: 20, swimSpeed: 30, note: 'Can hold your breath throughout the transformation.', attacks: [{ name: 'Jaws', damage: '2d6 piercing', traits: ['Grapple'] }] },
]

const ANIMAL_WEAPONS: ContentEntry[] = ANIMAL_FORMS.flatMap(form => form.attacks.map(attack => ({
  id: `spell:animal-form:${form.name.toLowerCase()}:${attack.name.toLowerCase()}`, name: `${form.name} ${attack.name}`,
  kind: 'weapon', systems: ['pf2e'], source: 'official', level: 2, traits: ['Unarmed', ...(attack.traits ?? [])],
  description: '', effects: [], updatedAt: 0,
  data: { weapon_category: 'Unarmed', weapon_type: 'Melee', hands: 0, damage: attack.damage,
    reach: attack.reach ?? 5, battle_form: form.name, extra_damage: attack.extra ?? '' },
})))

export const BATTLE_FORM_WEAPONS = [...DINOSAUR_WEAPONS, ...ANIMAL_WEAPONS]

export function animalBattleForm(name: string, rank: number, level: number) {
  const form = ANIMAL_FORMS.find(form => form.name.toLowerCase() === name.trim().toLowerCase())
  if (!form || !Number.isInteger(rank) || rank < 2 || rank > 10) return undefined
  const tier = Math.min(rank, 5)
  return {
    name: form.name, source: 'Animal Form', rank, speed: form.speed, swimSpeed: form.swimSpeed ?? 0,
    climbSpeed: form.climbSpeed ?? 0, note: form.note,
    size: tier >= 5 ? 'Huge' : tier >= 4 ? 'Large' : 'Medium',
    ac: level + (tier >= 4 ? 18 : tier === 3 ? 17 : 16),
    temporaryHp: 5 * (tier - 1), attack: tier >= 5 ? 18 : tier === 4 ? 16 : tier === 3 ? 14 : 9,
    damageBonus: tier >= 5 ? 7 : tier === 4 ? 9 : tier === 3 ? 5 : 1,
    athletics: tier >= 5 ? 20 : tier === 4 ? 16 : tier === 3 ? 14 : 9,
    attacks: ANIMAL_WEAPONS.filter(entry => entry.data.battle_form === form.name).map((entry): ContentEntry => ({ ...entry, data: { ...entry.data,
      damage: String(entry.data.damage).replace(/^\d+/, dice => String(Number(dice) * (tier >= 5 ? 2 : 1))),
      extra_damage: String(entry.data.extra_damage).replace(/^\d+/, dice => String(Number(dice) * (tier >= 5 ? 2 : 1))),
      reach: tier >= 5 ? 15 : tier >= 4 ? 10 : Number(entry.data.reach),
    } })),
  }
}

export const crocodileBattleForm = (rank: number, level: number) => animalBattleForm('Crocodile', rank, level)

export function dinosaurBattleForm(name: string, rank: number, level: number) {
  const form = DINOSAUR_FORMS.find(form => form.name.toLowerCase() === name.trim().toLowerCase())
  if (!form || !Number.isInteger(rank) || rank < 4 || rank > 10) return undefined
  const greater = rank >= 7
  const heightened = rank >= 5
  return {
    name: form.name, source: 'Dinosaur Form', rank, speed: form.speed, swimSpeed: 0, climbSpeed: 0, note: undefined,
    size: greater ? 'Gargantuan' : heightened ? 'Huge' : 'Large',
    ac: level + (greater ? 21 : 18), temporaryHp: greater ? 25 : heightened ? 20 : 15,
    attack: greater ? 25 : heightened ? 18 : 16,
    damageBonus: greater ? 15 : heightened ? 6 : 9,
    athletics: greater ? 25 : heightened ? 21 : 18,
    attacks: DINOSAUR_WEAPONS.filter(entry => entry.data.dinosaur_form === form.name).map((entry): ContentEntry => ({
      ...entry, data: { ...entry.data,
        damage: String(entry.data.damage).replace(/^\d+/, dice => String(Number(dice) * (heightened ? 2 : 1))),
        reach: heightened ? (greater ? 20 : 15) + (entry.data.reach === 15 ? 5 : 0) : Number(entry.data.reach),
      },
    })),
  }
}
