import type { ContentEntry, EquipmentGroupName, WORN_EQUIPMENT_GROUPS } from './types'
export { WORN_EQUIPMENT_GROUPS, EQUIPMENT_GROUPS, type EquipmentGroupName } from './types'

export const EQUIPMENT_BONUS_SKILLS = ['Acrobatics', 'Arcana', 'Athletics', 'Computers', 'Crafting', 'Deception',
  'Diplomacy', 'Intimidation', 'Lore', 'Medicine', 'Nature', 'Occultism', 'Performance', 'Piloting',
  'Religion', 'Society', 'Stealth', 'Survival', 'Thievery'] as const

const bonusSkillCache = new WeakMap<ContentEntry, {
  description: string; indexed: unknown; name: string; skills: Set<string>; bonuses: Map<string, Set<number>>
}>()
const bonusSkillPatterns = EQUIPMENT_BONUS_SKILLS.map(skill => [skill, new RegExp(`\\b${skill}\\b`, 'i')] as const)
const bonusSkillActions: [string, RegExp][] = [
  ['Athletics', /\b(?:climb|grapple|high jump|long jump|shove|swim|trip)\b/i],
  ['Crafting', /\b(?:craft|repair)\b/i],
  ['Deception', /\b(?:create a diversion|impersonate|lie)\b/i],
  ['Diplomacy', /\b(?:gather information|make an impression|make a request|request)\b/i],
  ['Intimidation', /\b(?:coerce|demoralize)\b/i],
  ['Medicine', /\b(?:administer first aid|treat wounds|treat disease|treat poison)\b/i],
  ['Nature', /\bcommand an animal\b/i],
  ['Stealth', /\b(?:conceal an object|hide|sneak)\b/i],
  ['Survival', /\b(?:subsist|track)\b/i],
  ['Thievery', /\b(?:disable a device|palm an object|pick a lock|steal)\b/i],
]

export function equipmentBonusSkills(entry: ContentEntry) {
  const cached = bonusSkillCache.get(entry)
  if (cached?.description === entry.description && cached.indexed === entry.data.skill && cached.name === entry.name) return cached.skills
  const skills = new Set<string>()
  const bonuses = new Map<string, Set<number>>()
  for (const match of entry.description.matchAll(/(?:\+(\d+)\s+(?:item\s+)?bonus|\bitem bonus)\s+(?:to|on|when)\s+((?:(?!\band (?:a|an) \+\d+\s+(?:(?:item|circumstance|status)\s+)?bonus\b)[^.;\n]){0,180})/gi)) {
    const target = match[2].split(/\b(?:while|when|if|unless|against|and (?:a|an|you|it|your|use|gain|can|must|attempt|make)\b)/i, 1)[0]
    const matched = new Set<string>()
    for (const [skill, pattern] of bonusSkillPatterns) if (pattern.test(target)) matched.add(skill)
    for (const [skill, pattern] of bonusSkillActions) if (pattern.test(target)) matched.add(skill)
    if (/^(?:the|that|this) check\b/i.test(target.trim())) {
      const indexed = String(entry.data.skill ?? '').split(',').map(name => name.trim())
      const distinct = [...new Set(indexed)]
      if (distinct.length === 1 && EQUIPMENT_BONUS_SKILLS.some(skill => skill === distinct[0])) matched.add(distinct[0])
    }
    for (const skill of matched) {
      skills.add(skill)
      if (match[1]) {
        const values = bonuses.get(skill) ?? new Set<number>()
        values.add(Number(match[1]))
        bonuses.set(skill, values)
      }
    }
  }
  const heading = `\n\n${entry.name}\n\n`
  const variantStart = entry.description.lastIndexOf(heading)
  if (variantStart >= 0) {
    const variant = entry.description.slice(variantStart + heading.length)
    const separator = variant.indexOf('\n\n---\n\n')
    if (separator >= 0 && variant.slice(0, separator).split('\n\n')
      .every(part => /^(?:Source|Price|Usage|Bulk)\b/i.test(part.trim()))) {
      const paragraph = variant.slice(separator + 7).split('\n\n', 1)[0]
      const match = /the (?:item )?bonus to ([^.]{0,100}?) checks? is \+(\d+)/i.exec(paragraph)
      if (match) for (const [skill, pattern] of bonusSkillPatterns)
        if (pattern.test(match[1]) && skills.has(skill)) bonuses.set(skill, new Set([Number(match[2])]))
      const implicit = /\b(?:tools|item|it)\s+grant(?:s)?\s+(?:a|an)\s+\+(\d+)\s+item bonus\b|\bitem bonus is \+(\d+)/i.exec(paragraph)
      const value = implicit?.[1] ?? implicit?.[2]
      if (value && skills.size === 1) bonuses.set([...skills][0], new Set([Number(value)]))
    }
  }
  bonusSkillCache.set(entry, { description: entry.description, indexed: entry.data.skill, name: entry.name, skills, bonuses })
  return skills
}

export function equipmentSkillBonuses(entry: ContentEntry, skill: string) {
  equipmentBonusSkills(entry)
  return [...(bonusSkillCache.get(entry)?.bonuses.get(skill) ?? [])].sort((a, b) => a - b)
}

export const equipmentDisplayName = (name: string) => name.replace(/[\u2018\u2019]/g, "'")
  .replace(/^Orc Necksplitter$/, 'Orc Necksplitter Axe')
  .replace(/\bStarday Night Special \((Gyrojet|Rotating|Semi-Auto) Pistol\)$/, 'Starday Night Special $1 Pistol')
  .replace(/\bRaptorial Edge$/, 'Raptorial Edge Phase Cutlass')
  .replace(/^(Minor|Lesser|Moderate|Greater|Major|Supreme|True)\s+(.+)$/, '$2 ($1)')

export function specificMagicItemName(entry: ContentEntry | undefined, name = entry?.name ?? '', owned = false) {
  const sourceName = String(entry?.data.named_weapon_source ?? name)
  if (sourceName === 'Coldstar Pistols')
    return `Coldstar ${entry?.data.named_weapon_base ?? 'Dueling Pistol'}${Number(entry?.data.hands) === 1 ? '' : 's'}`
  if (sourceName === 'Blade of the Black Sovereign' && entry?.data.named_weapon_base)
    return `${entry.data.named_weapon_base} of the Black Sovereign`
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
  if (entry?.kind === 'item' && entry.traits.some(trait => trait.toLowerCase() === 'grenade')) return 'Grenades'
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
