import type { ContentEntry, EquipmentGroupName, WORN_EQUIPMENT_GROUPS } from './types'
export { WORN_EQUIPMENT_GROUPS, EQUIPMENT_GROUPS, type EquipmentGroupName } from './types'

export const equipmentDisplayName = (name: string) => name.replace(/[\u2018\u2019]/g, "'")
  .replace(/^Orc Necksplitter$/, 'Orc Necksplitter Axe')
  .replace(/\bStarday Night Special \(Gyrojet Pistol\)$/, 'Starday Night Special Gyrojet Pistol')
  .replace(/\bStarday Night Special \(Rotating Pistol\)$/, 'Starday Night Special Rotating Pistol')
  .replace(/^(Minor|Lesser|Moderate|Greater|Major|Supreme|True)\s+(.+)$/, '$2 ($1)')

export function specificMagicItemName(entry: ContentEntry | undefined, name = entry?.name ?? '', owned = false) {
  const sourceName = String(entry?.data.named_weapon_source ?? name)
  if (sourceName === 'Coldstar Pistols')
    return `Coldstar ${entry?.data.named_weapon_base ?? 'Dueling Pistol'}${Number(entry?.data.hands) === 1 ? '' : 's'}`
  if (sourceName === 'Axe of the Dwarven Lords') return sourceName
  if (/^(?:Scalding|Corroding|Freezing|Shocking) Gauntlet$/.test(sourceName)) return `${sourceName.split(' ')[0]} ${entry?.data.named_weapon_base ?? 'Gauntlet'}`
  const rawBase = String(entry?.data.named_armor_base ?? entry?.data.named_weapon_base
    ?? (entry?.data.named_shield || sourceName === 'Scale of Igroon' ? 'Shield' : ''))
  const base = !!entry?.data.named_armor_elven && rawBase === 'Chain Shirt' ? 'Elven Chain Shirt' : rawBase
  const source = sourceName === 'Soulcutter (Artifact)' ? 'Soulcutter'
    : owned ? sourceName.replace(/ \(Artifact\)/gi, '') : sourceName
  const lowerSource = source.toLowerCase()
  const lowerBase = base.toLowerCase()
  return base && !lowerSource.endsWith(lowerBase) && !lowerSource.startsWith(`${lowerBase} of `)
    ? `${source} ${base}` : source
}

const wornPlacements: [typeof WORN_EQUIPMENT_GROUPS[number], RegExp][] = [
  ['Backpacks', /\b(?:backpacks?|rucksacks?)\b/],
  ['Belt', /\b(?:belts?|girdles?|sashes?|waist)\b/],
  ['Boots', /\b(?:boots?|shoes?|sandals?|slippers?|footwear|anklets?)\b/],
  ['Bracelets', /\b(?:bracelets?|bracers?|armbands?)\b/],
  ['Cloaks', /\b(?:cloaks?|capes?|mantles?|shawls?|epaulets?)\b/],
  ['Clothing', /\b(?:clothing|clothes|garments?|robes?|vests?|outfits?|dresses)\b/],
  ['Mask', /\b(?:masks?|warmasks?)\b/],
  ['Eyewear', /\b(?:eyepieces?|goggles?|spectacles?|lenses)\b/],
  ['Gloves', /\b(?:gloves?|gauntlets?|handwear)\b/],
  ['Handwraps', /\bhandwraps?\b/],
  ['Headband', /\bheadbands?\b/],
  ['Headwear', /\b(?:headwear|headgear|helms?|helmets?|hats?|caps?|circlets?|crowns?|phylacter(?:y|ies))\b/],
  ['Necklaces', /\b(?:necklaces?|amulets?|pendants?|collars?)\b/],
  ['Rings', /\brings?\b/],
  ['Arms', /\barms?\b/],
  ['Body', /\bbody\b/],
  ['Chest', /\bchest\b/],
  ['Eyes', /\beyes\b/],
  ['Face', /\bface\b/],
  ['Feet', /\bfeet\b/],
  ['Hands', /\bhands?\b/],
  ['Head', /\bhead\b/],
  ['Neck', /\bneck\b/],
  ['Shoulders', /\bshoulders?\b/],
  ['Throat', /\b(?:throat|badges?|brooches?|medals?|medallions?|periapts?|scarabs?|scarfs?|scarves|torcs?)\b/],
  ['Torso', /\b(?:torso|shirts?|tunics?|vestments?)\b/],
  ['Wrists', /\bwrists?\b/],
]

const SLOT_CONTENT: Partial<Record<EquipmentGroupName, readonly EquipmentGroupName[]>> = {
  Arms: ['Bracelets'], Body: ['Clothing'], Chest: ['Clothing', 'Torso'], Eyes: ['Eyewear'],
  Face: ['Eyewear', 'Mask'], Feet: ['Boots'], Hands: ['Gloves'], Head: ['Headwear', 'Headband'],
  Neck: ['Necklaces'], Shoulders: ['Cloaks'], Throat: ['Necklaces'], Torso: ['Clothing'],
  Wrists: ['Bracelets'],
}

export function equipmentFitsGroup(entry: ContentEntry, group: EquipmentGroupName) {
  const actual = equipmentGroupName(entry)
  return actual === group || !!SLOT_CONTENT[group]?.includes(actual)
}

export function equipmentGroupName(entry?: ContentEntry, name = entry?.name ?? '', savedGroup?: EquipmentGroupName | 'Belts' | 'Waist'): EquipmentGroupName {
  if ((!savedGroup || savedGroup === 'Gloves' || savedGroup === 'Hands') && /\bhandwraps?\b/i.test(name)) return 'Handwraps'
  if ((!savedGroup || savedGroup === 'Other equipment') && entry?.kind === 'item'
    && /\b(?:kit|toolkit|medkit|tools)(?:\b|s\b)/i.test(name)) return 'Toolkits'
  if (savedGroup) return savedGroup === 'Belts' || savedGroup === 'Waist' ? 'Belt' : savedGroup
  const category = String(entry?.data.item_category ?? '').trim().toLowerCase()
  if (category === 'grafts') return 'Grafts'
  if (category === 'tattoos') return 'Tattoos'
  if (entry?.kind === 'item' && entry.traits.some(trait => trait.toLowerCase() === 'poison')) return 'Poisons'
  const usage = String(entry?.data.usage ?? '').trim().toLowerCase()
  if (category === 'worn items' || /^worn\b/.test(usage)) {
    const generic = !usage || usage === 'worn' || /^worn (?:headwear|headgear|head|face)$/.test(usage)
    const placement = generic ? `${name.toLowerCase()} ${usage}` : usage
    return wornPlacements.find(([, pattern]) => pattern.test(placement))?.[0] ?? (usage === 'worn face' ? 'Mask' : 'Other Worn Items')
  }
  const ammo = /\b(?:arrows?|bolts?|bullets?)\b/i.exec(name)?.[0].toLowerCase()
  return ammo?.startsWith('arrow') ? 'Arrows' : ammo?.startsWith('bolt') ? 'Bolts' : ammo ? 'Bullets' : 'Other equipment'
}
