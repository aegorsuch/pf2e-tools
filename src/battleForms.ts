import type { ContentEntry } from './types'

export const BATTLE_FORM_SPELLS = new Set(['Animal Form', 'Dinosaur Form'])
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

const CROCODILE_WEAPONS: ContentEntry[] = [
  { name: 'Jaws', damage: '2d8 piercing', traits: [] },
  { name: 'Tail', damage: '1d8 bludgeoning', traits: ['Agile'] },
].map(attack => ({
  id: `spell:animal-form:crocodile:${attack.name.toLowerCase()}`, name: `Crocodile ${attack.name}`,
  kind: 'weapon', systems: ['pf2e'], source: 'official', level: 2, traits: ['Unarmed', ...attack.traits],
  description: '', effects: [], updatedAt: 0,
  data: { weapon_category: 'Unarmed', weapon_type: 'Melee', hands: 0, damage: attack.damage, reach: 5, battle_form: 'Crocodile' },
}))

export const BATTLE_FORM_WEAPONS = [...DINOSAUR_WEAPONS, ...CROCODILE_WEAPONS]

export function crocodileBattleForm(rank: number, level: number) {
  if (!Number.isInteger(rank) || rank < 2 || rank > 10) return undefined
  const tier = Math.min(rank, 5)
  return {
    name: 'Crocodile', source: 'Animal Form', rank, speed: 25, swimSpeed: 30,
    size: tier >= 5 ? 'Huge' : tier >= 4 ? 'Large' : 'Medium',
    ac: level + (tier >= 4 ? 18 : tier === 3 ? 17 : 16),
    temporaryHp: 5 * (tier - 1), attack: tier >= 5 ? 18 : tier === 4 ? 16 : tier === 3 ? 14 : 9,
    damageBonus: tier >= 5 ? 7 : tier === 4 ? 9 : tier === 3 ? 5 : 1,
    athletics: tier >= 5 ? 20 : tier === 4 ? 16 : tier === 3 ? 14 : 9,
    attacks: CROCODILE_WEAPONS.map((entry): ContentEntry => ({ ...entry, data: { ...entry.data,
      damage: String(entry.data.damage).replace(/^\d+/, dice => String(Number(dice) * (tier >= 5 ? 2 : 1))),
      reach: tier >= 5 ? 15 : tier >= 4 ? 10 : 5,
    } })),
  }
}

export function dinosaurBattleForm(name: string, rank: number, level: number) {
  const form = DINOSAUR_FORMS.find(form => form.name === name)
  if (!form || !Number.isInteger(rank) || rank < 4 || rank > 10) return undefined
  const greater = rank >= 7
  const heightened = rank >= 5
  return {
    name: form.name, source: 'Dinosaur Form', rank, speed: form.speed, swimSpeed: 0,
    size: greater ? 'Gargantuan' : heightened ? 'Huge' : 'Large',
    ac: level + (greater ? 21 : 18), temporaryHp: greater ? 25 : heightened ? 20 : 15,
    attack: greater ? 25 : heightened ? 18 : 16,
    damageBonus: greater ? 15 : heightened ? 6 : 9,
    athletics: greater ? 25 : heightened ? 21 : 18,
    attacks: DINOSAUR_WEAPONS.filter(entry => entry.data.dinosaur_form === name).map((entry): ContentEntry => ({
      ...entry, data: { ...entry.data,
        damage: String(entry.data.damage).replace(/^\d+/, dice => String(Number(dice) * (heightened ? 2 : 1))),
        reach: heightened ? (greater ? 20 : 15) + (entry.data.reach === 15 ? 5 : 0) : Number(entry.data.reach),
      },
    })),
  }
}
