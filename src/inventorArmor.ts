import { featTakenLevel } from './featChoices'
import type { Character } from './types'

type Tier = 'initial' | 'breakthrough' | 'revolutionary'
type Modification = { name: string; tier: Tier; note: string; suit?: 'Power Suit' | 'Subterfuge Suit'; requires?: string[] }

export const ARMOR_MODIFICATIONS: Modification[] = [
  { name: 'Harmonic Oscillator', tier: 'initial', note: 'Resistance to force and sonic; increases during Overdrive.' },
  { name: 'Metallic Reactance', tier: 'initial', note: 'Resistance to acid and electricity; increases during Overdrive.' },
  { name: 'Muscular Exoskeleton', tier: 'initial', suit: 'Power Suit', note: 'During Overdrive, circumstance bonus to Athletics (+2 at master Crafting).' },
  { name: 'Otherworldly Protection', tier: 'initial', note: 'Resistance to spirit and void; use vitality instead of void if you have void healing. Sanctified creatures also resist opposing sanctification damage.' },
  { name: 'Phlogistonic Regulator', tier: 'initial', note: 'Resistance to cold and fire; increases during Overdrive.' },
  { name: 'Speed Boosters', tier: 'initial', note: 'Status bonus to Speed; increases during Overdrive.' },
  { name: 'Subtle Dampeners', tier: 'initial', suit: 'Subterfuge Suit', note: 'During Overdrive, circumstance bonus to Stealth (+2 at master Crafting).' },
  { name: 'Antimagic Plating', tier: 'breakthrough', note: '+1 circumstance to AC and saves against spells; +4 against spells targeting the armor.' },
  { name: 'Camouflage Pigmentation', tier: 'breakthrough', suit: 'Subterfuge Suit', note: 'You can Hide without cover or concealment while wearing the armor.' },
  { name: 'Dense Plating', tier: 'breakthrough', note: 'Resistance to slashing.' },
  { name: 'Enhanced Resistance', tier: 'breakthrough', requires: ['Harmonic Oscillator', 'Metallic Reactance', 'Phlogistonic Regulator', 'Otherworldly Protection'], note: 'Choose one initial resistance modification to use your full level instead of half.' },
  { name: 'Heavy Construction', tier: 'breakthrough', suit: 'Power Suit', note: 'Heavy plate armor; uses medium armor proficiency. Strength +3 removes its Speed penalty.' },
  { name: 'Hyper Boosters', tier: 'breakthrough', requires: ['Speed Boosters'], note: 'Improves Speed Boosters; legendary Crafting further improves Overdrive Speed.' },
  { name: 'Layered Mesh', tier: 'breakthrough', note: 'Resistance to piercing.' },
  { name: 'Tensile Absorption', tier: 'breakthrough', note: 'Resistance to bludgeoning.' },
  { name: 'Automated Impediments', tier: 'revolutionary', note: 'Adjacent spaces are difficult terrain for enemies.' },
  { name: 'Energy Barrier', tier: 'revolutionary', requires: ['Harmonic Oscillator', 'Metallic Reactance', 'Phlogistonic Regulator'], note: 'Resistance to all energy damage.' },
  { name: 'Incredible Resistance', tier: 'revolutionary', requires: ['Dense Plating', 'Layered Mesh', 'Tensile Absorption'], note: 'Choose one physical resistance modification to use your full level instead of half.' },
  { name: 'Multisensory Mask', tier: 'revolutionary', suit: 'Subterfuge Suit', note: 'Concealed from all creatures, including nonvisual senses; concealment ends after a hostile action until restored with one manipulate action. Cannot Hide or Sneak using it.' },
  { name: 'Perfect Fortification', tier: 'revolutionary', suit: 'Power Suit', note: 'DC 13 flat check to turn critical hits into hits; resistance to precision damage.' },
  { name: 'Physical Protections', tier: 'revolutionary', requires: ['Dense Plating', 'Layered Mesh', 'Tensile Absorption'], note: 'Resistance to all physical damage, including bleed.' },
  { name: 'Rune Capacity', tier: 'revolutionary', note: 'One extra armor property rune, maximum four.' },
]

export type ArmorModificationSlot = 'initial' | 'breakthrough' | 'revolutionary' | 'manifold' | 'basic'
export const armorOverdriveActive = (c: Character) => c.className === 'Inventor' && !!c.inventorArmorModifications?.overdrive
const tiers: Record<ArmorModificationSlot, number> = { initial: 0, breakthrough: 1, revolutionary: 2, manifold: 0, basic: 0 }
const tierValue: Record<Tier, number> = { initial: 0, breakthrough: 1, revolutionary: 2 }

export function armorModificationSlots(c: Character): ArmorModificationSlot[] {
  const slots: ArmorModificationSlot[] = []
  if (c.className === 'Inventor') {
    slots.push('initial')
    if (c.level >= 7) slots.push('breakthrough')
    if (c.level >= 15) slots.push('revolutionary')
    if (c.feats.some(feat => feat.name === 'Manifold Modifications' && featTakenLevel(feat) <= c.level)) slots.push('manifold')
  }
  if (c.feats.some(feat => feat.name === 'Basic Modification' && featTakenLevel(feat) <= c.level)) slots.push('basic')
  return slots
}

export function armorModifications(c: Character) {
  const slots = armorModificationSlots(c)
  const saved = c.inventorArmorModifications ?? {}
  const suit = c.inventorArmorSuit ?? 'Power Suit'
  let selected: Modification[] = []
  for (const slot of slots) {
    const option = ARMOR_MODIFICATIONS.find(mod => mod.name === saved[slot])
    if (!option || tierValue[option.tier] > tiers[slot] || option.suit && option.suit !== suit
      || selected.some(mod => mod.name === option.name)) continue
    selected.push(option)
  }
  selected = selected.filter(option => !option.requires || option.requires.some(name => selected.some(mod => mod.name === name)))
  return selected
}

export function armorModificationOptions(c: Character, slot: ArmorModificationSlot) {
  const current = c.inventorArmorModifications?.[slot]
  const other = armorModifications({ ...c, inventorArmorModifications: { ...c.inventorArmorModifications, [slot]: undefined } })
  return ARMOR_MODIFICATIONS.filter(option => tierValue[option.tier] <= tiers[slot]
    && (!option.suit || option.suit === (c.inventorArmorSuit ?? 'Power Suit'))
    && (option.name === current || !other.some(mod => mod.name === option.name))
    && (!option.requires || option.requires.some(name => other.some(mod => mod.name === name))))
}

export function inventorArmorResistances(c: Character) {
  const mods = armorModifications(c)
  const names = new Set(mods.map(mod => mod.name))
  const config = c.inventorArmorModifications
  const half = Math.floor(c.level / 2)
  const overdrive = armorOverdriveActive(c) ? 2 : 0
  const initial = ['Harmonic Oscillator', 'Metallic Reactance', 'Phlogistonic Regulator', 'Otherworldly Protection']
    .filter(name => names.has(name))
  const physical = ['Dense Plating', 'Layered Mesh', 'Tensile Absorption'].filter(name => names.has(name))
  const enhanced = names.has('Enhanced Resistance') ? initial.length === 1 ? initial[0] : config?.enhanced : undefined
  const incredible = names.has('Incredible Resistance') ? physical.length === 1 ? physical[0] : config?.incredible : undefined
  const out: { damage: string; value: number; source: string }[] = []
  const add = (source: string, damage: string[], value: number) => {
    if (names.has(source) && value > 0) for (const type of damage) out.push({ damage: type, value, source })
  }
  for (const [source, damage, base, extra] of [
    ['Harmonic Oscillator', ['force', 'sonic'], 3, overdrive],
    ['Metallic Reactance', ['acid', 'electricity'], 3, overdrive],
    ['Phlogistonic Regulator', ['cold', 'fire'], 0, overdrive],
    ['Otherworldly Protection', ['spirit', config?.voidHealing ? 'vitality' : 'void',
      ...(c.sanctification === 'Holy' ? ['unholy'] : c.sanctification === 'Unholy' ? ['holy'] : [])], 3, 0],
  ] as const) add(source, [...damage], base + (enhanced === source ? c.level : half) + extra)
  for (const [source, damage] of [['Dense Plating', 'slashing'], ['Layered Mesh', 'piercing'], ['Tensile Absorption', 'bludgeoning']] as const)
    add(source, [damage], incredible === source ? c.level : half)
  add('Energy Barrier', ['acid', 'cold', 'electricity', 'fire', 'force', 'sonic', 'vitality', 'void'], 2 + half)
  add('Physical Protections', ['bludgeoning', 'piercing', 'slashing', 'bleed'], half)
  add('Perfect Fortification', ['precision'], 2 + half)
  return out
}
