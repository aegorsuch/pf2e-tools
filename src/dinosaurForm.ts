import type { ContentEntry } from './types'

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

export function dinosaurBattleForm(name: string, rank: number, level: number) {
  const form = DINOSAUR_FORMS.find(form => form.name === name)
  if (!form || !Number.isInteger(rank) || rank < 4 || rank > 10) return undefined
  const greater = rank >= 7
  const heightened = rank >= 5
  return {
    name: form.name, rank, speed: form.speed,
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
