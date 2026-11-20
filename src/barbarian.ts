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

type DragonForm = { damage: string; save: 'Reflex' | 'Fortitude' | 'Will'; tradition: 'Arcane' | 'Divine' | 'Occult' | 'Primal'; movement?: 'Burrow' | 'Climb' | 'Swim'; line?: boolean }
export const DRAGON_FORMS: Record<string, DragonForm> = {
  Adamantine: { tradition: 'Primal', damage: 'bludgeoning', save: 'Reflex', movement: 'Burrow' },
  Barrage: { tradition: 'Arcane', damage: 'force', save: 'Reflex' },
  Bog: { tradition: 'Primal', damage: 'acid', save: 'Reflex', movement: 'Swim' },
  Brine: { tradition: 'Primal', damage: 'bludgeoning', save: 'Reflex', movement: 'Swim', line: true },
  Cinder: { tradition: 'Primal', damage: 'fire', save: 'Reflex' },
  Cloud: { tradition: 'Primal', damage: 'electricity', save: 'Reflex' },
  Conspirator: { tradition: 'Occult', damage: 'poison', save: 'Fortitude', movement: 'Climb' },
  Coral: { tradition: 'Primal', damage: 'bludgeoning', save: 'Reflex', movement: 'Swim', line: true },
  Crystal: { tradition: 'Primal', damage: 'piercing', save: 'Reflex' },
  Delight: { tradition: 'Divine', damage: 'spirit', save: 'Reflex' },
  Despair: { tradition: 'Occult', damage: 'sonic', save: 'Will' },
  Diabolic: { tradition: 'Divine', damage: 'fire', save: 'Reflex' },
  Empyreal: { tradition: 'Divine', damage: 'spirit', save: 'Reflex' },
  Executor: { tradition: 'Divine', damage: 'sonic', save: 'Reflex' },
  Forest: { tradition: 'Primal', damage: 'piercing', save: 'Reflex' },
  Fortune: { tradition: 'Arcane', damage: 'force', save: 'Reflex' },
  Horned: { tradition: 'Primal', damage: 'poison', save: 'Fortitude', movement: 'Swim' },
  Magma: { tradition: 'Primal', damage: 'fire', save: 'Reflex', movement: 'Burrow' },
  Mirage: { tradition: 'Arcane', damage: 'mental', save: 'Will', movement: 'Climb' },
  Mocking: { tradition: 'Occult', damage: 'bludgeoning', save: 'Reflex' },
  Oath: { tradition: 'Divine', damage: 'spirit', save: 'Will' },
  Omen: { tradition: 'Occult', damage: 'mental', save: 'Will' },
  Phase: { tradition: 'Arcane', damage: 'force', save: 'Reflex' },
  Requiem: { tradition: 'Divine', damage: 'spirit', save: 'Will', movement: 'Swim', line: true },
  Resurrection: { tradition: 'Divine', damage: 'void', save: 'Fortitude' },
  Rime: { tradition: 'Primal', damage: 'cold', save: 'Reflex', movement: 'Swim' },
  Rune: { tradition: 'Arcane', damage: 'fire', save: 'Reflex' },
  Sage: { tradition: 'Occult', damage: 'mental', save: 'Will' },
  Sea: { tradition: 'Arcane', damage: 'bludgeoning', save: 'Reflex', movement: 'Swim' },
  Sky: { tradition: 'Divine', damage: 'electricity', save: 'Reflex' },
  Sovereign: { tradition: 'Occult', damage: 'mental', save: 'Reflex' },
  Stormcrown: { tradition: 'Primal', damage: 'electricity', save: 'Reflex', line: true },
  Time: { tradition: 'Arcane', damage: 'force', save: 'Will' },
  Umbral: { tradition: 'Occult', damage: 'void', save: 'Reflex' },
  Underworld: { tradition: 'Arcane', damage: 'fire', save: 'Reflex', movement: 'Burrow' },
  Vizir: { tradition: 'Occult', damage: 'fire', save: 'Reflex', movement: 'Swim' },
  Vorpal: { tradition: 'Arcane', damage: 'void', save: 'Will' },
  Wailing: { tradition: 'Arcane', damage: 'sonic', save: 'Fortitude' },
  Whisper: { tradition: 'Occult', damage: 'mental', save: 'Will' },
  Wish: { tradition: 'Arcane', damage: 'mental', save: 'Will', movement: 'Climb' },
}

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
