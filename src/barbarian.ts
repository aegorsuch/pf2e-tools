export const DRAGON_INSTINCTS = {
  Adamantine: { tradition: 'Primal', damage: 'bludgeoning' },
  Conspirator: { tradition: 'Occult', damage: 'poison' },
  Diabolic: { tradition: 'Divine', damage: 'fire' },
  Empyreal: { tradition: 'Divine', damage: 'spirit' },
  Fortune: { tradition: 'Arcane', damage: 'force' },
  Horned: { tradition: 'Primal', damage: 'poison' },
  Mirage: { tradition: 'Arcane', damage: 'mental' },
  Omen: { tradition: 'Occult', damage: 'mental' },
} as const

export type DragonInstinct = keyof typeof DRAGON_INSTINCTS

export const ELEMENTAL_INSTINCTS = {
  Air: { damage: ['electricity', 'slashing'], evolution: 'cold' },
  Earth: { damage: ['bludgeoning', 'piercing'], evolution: 'poison' },
  Fire: { damage: ['fire'], evolution: 'cold' },
  Metal: { damage: ['piercing', 'slashing'], evolution: 'electricity' },
  Water: { damage: ['bludgeoning', 'cold'], evolution: 'acid' },
  Wood: { damage: ['bludgeoning', 'piercing'], evolution: 'poison' },
} as const

export type ElementalInstinct = keyof typeof ELEMENTAL_INSTINCTS

type AnimalAttack = { name: string; damage?: string; traits: string[]; range?: number }

export const ANIMAL_INSTINCTS: Record<string, AnimalAttack[]> = {
  Ape: [{ name: 'Fist', damage: '1d10 B', traits: ['Grapple'] }],
  Bear: [{ name: 'Jaws', damage: '1d10 P', traits: [] }, { name: 'Claw', damage: '1d6 S', traits: ['Agile'] }],
  Bull: [{ name: 'Horn', damage: '1d10 P', traits: ['Shove'] }],
  Cat: [{ name: 'Jaws', damage: '1d10 P', traits: [] }, { name: 'Claw', damage: '1d6 S', traits: ['Agile'] }],
  Deer: [{ name: 'Antler', damage: '1d10 P', traits: ['Grapple'] }],
  Frog: [{ name: 'Jaws', damage: '1d10 B', traits: [] }, { name: 'Tongue', damage: '1d6 B', traits: ['Agile'] }],
  Shark: [{ name: 'Jaws', damage: '1d10 P', traits: ['Grapple'] }],
  Snake: [{ name: 'Fangs', damage: '1d10 P', traits: ['Grapple'] }],
  Wolf: [{ name: 'Jaws', damage: '1d10 P', traits: ['Trip'] }],
  Ankylosaurus: [{ name: 'Tail', damage: '1d10 B', traits: ['Razing'] }],
  Ant: [{ name: 'Mandibles', damage: '1d10 P', traits: ['Grapple'] }],
  Bat: [{ name: 'Fangs', damage: '1d10 P', traits: [] }, { name: 'Wings', damage: '1d4 P', traits: ['Parry'] }],
  Bird: [{ name: 'Beak', damage: '1d10 P', traits: [] }, { name: 'Talon', damage: '1d6 S', traits: ['Agile'] }],
  Brontosaurus: [{ name: 'Tail', damage: '1d10 B', traits: ['Trip'] }],
  Crab: [{ name: 'Big Claw', damage: '1d10 B', traits: ['Razing'] }, { name: 'Claw', damage: '1d4 S', traits: ['Parry'] }],
  Crocodile: [{ name: 'Jaws', damage: '1d10 P', traits: [] }, { name: 'Tail', damage: '1d6 B', traits: ['Agile'] }],
  Orca: [{ name: 'Jaws', damage: '1d8 P', traits: ['Forceful'] }],
  Scorpion: [{ name: 'Stinger', damage: '1d6 P', traits: ['Reach', 'Venomous'] }, { name: 'Pincer', damage: '1d4 S', traits: ['Parry'] }],
  Seal: [{ name: 'Jaws', damage: '1d10 P', traits: ['Grapple'] }],
  Spider: [{ name: 'Fangs', damage: '1d8 P', traits: ['Grapple', 'Venomous'] }, { name: 'Web', traits: [], range: 15 }],
  Tyrannosaurus: [{ name: 'Jaws', damage: '1d8 P', traits: ['Deadly d12'] }, { name: 'Tail', damage: '1d6 B', traits: ['Agile'] }],
  Wasp: [{ name: 'Stinger', damage: '1d4 P', traits: ['Backstabber', 'Deadly d8', 'Venomous'] }],
}

export const ANIMAL_BRUTALITY_TRAITS = ['Backswing', 'Forceful', 'Parry', 'Razing', 'Sweep'] as const
