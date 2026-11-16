import type { ContentEntry } from './types'

export const WORN_EQUIPMENT_GROUPS = [
  'Backpacks', 'Belts', 'Boots', 'Bracelets', 'Cloaks', 'Clothing', 'Eyewear', 'Gloves', 'Headwear', 'Necklaces', 'Rings', 'Other Worn Items',
] as const

export const EQUIPMENT_GROUPS = ['Arrows', 'Bolts', 'Bullets', 'Grafts', 'Other equipment', 'Poisons', 'Tattoos', ...WORN_EQUIPMENT_GROUPS] as const
export type EquipmentGroupName = typeof EQUIPMENT_GROUPS[number]

const wornPlacements: [typeof WORN_EQUIPMENT_GROUPS[number], RegExp][] = [
  ['Backpacks', /\b(?:backpacks?|rucksacks?)\b/],
  ['Belts', /\b(?:belts?|girdles?|sashes?|waist)\b/],
  ['Boots', /\b(?:boots?|shoes?|sandals?|slippers?|footwear|anklets?|feet)\b/],
  ['Bracelets', /\b(?:bracelets?|bracers?|armbands?|wrists?)\b/],
  ['Cloaks', /\b(?:cloaks?|capes?|mantles?|epaulets?|shoulders?)\b/],
  ['Clothing', /\b(?:clothing|clothes|garments?|robes?|vests?|outfits?)\b/],
  ['Eyewear', /\b(?:eyepieces?|goggles?|spectacles?|lenses|eyes)\b/],
  ['Gloves', /\b(?:gloves?|gauntlets?|handwraps?|handwear|hands?)\b/],
  ['Headwear', /\b(?:headwear|headgear|headbands?|head|helms?|helmets?|hats?|caps?|circlets?|crowns?|masks?)\b/],
  ['Necklaces', /\b(?:necklaces?|amulets?|pendants?|collars?|neck)\b/],
  ['Rings', /\brings?\b/],
]

export function equipmentGroupName(entry?: ContentEntry, name = entry?.name ?? ''): EquipmentGroupName {
  const category = String(entry?.data.item_category ?? '').trim().toLowerCase()
  if (category === 'grafts') return 'Grafts'
  if (category === 'tattoos') return 'Tattoos'
  if (entry?.kind === 'item' && entry.traits.some(trait => trait.toLowerCase() === 'poison')) return 'Poisons'
  const usage = String(entry?.data.usage ?? '').trim().toLowerCase()
  if (category === 'worn items' || /^worn\b/.test(usage)) {
    const placement = usage && usage !== 'worn' ? usage : name.toLowerCase()
    return wornPlacements.find(([, pattern]) => pattern.test(placement))?.[0] ?? 'Other Worn Items'
  }
  const ammo = /\b(?:arrows?|bolts?|bullets?)\b/i.exec(name)?.[0].toLowerCase()
  return ammo?.startsWith('arrow') ? 'Arrows' : ammo?.startsWith('bolt') ? 'Bolts' : ammo ? 'Bullets' : 'Other equipment'
}
