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
