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
