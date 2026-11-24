import type { ContentEntry, OwnedArmor } from './types'
import { automaticArmigerRunes } from './grantedArmor'

const ANCESTRAL_HIDE = 'Ancestral Embrace Hide Armor'
export const isAncestralEmbrace = (name?: string) => name === 'Ancestral Embrace' || name === ANCESTRAL_HIDE
const PLATE_VARIANTS: Record<string, string[]> = {
  'Rebounding Breastplate': ['Rebounding Breastplate', 'Rebounding Full Plate', 'Rebounding Bastion Plate'],
  'Breastplate of the Mountain': ['Breastplate of the Mountain', 'Full Plate of the Mountain', 'Bastion Plate of the Mountain'],
}
const plateVariantNames = Object.values(PLATE_VARIANTS).flat()
const isScalingPlateVariant = (name?: string) => !!name && plateVariantNames.includes(name)
const ARMORS = new Set(['Ancestral Embrace', ANCESTRAL_HIDE, "Slithermaw's Bane", "Slithermaw's Bane (Artifact)",
  'Highhelm Stronghold Plate', 'Bastion of the Inheritor', 'Immortal Bastion', 'Library Robes', ...Object.keys(PLATE_VARIANTS)])
const BASTION_NAMES: Record<string, string> = {
  'Highhelm Stronghold Plate': 'Highhelm Stronghold Bastion Plate',
  'Bastion of the Inheritor': 'Bastion Plate of the Inheritor',
  'Immortal Bastion': 'Immortal Bastion Plate',
}
export const isBastionNamedArmor = (name?: string) =>
  !!name && (Object.hasOwn(BASTION_NAMES, name) || Object.values(BASTION_NAMES).includes(name)
    || name === 'Rebounding Bastion Plate' || name === 'Bastion Plate of the Mountain')
export const INHERITOR_RUNE_FAMILIES = ['Advancing', 'Fortification', 'Moonweave', 'Sunweave'] as const
export const isInheritorPlate = (name?: string) => name === 'Bastion Plate of the Inheritor' || name === 'Bastion of the Inheritor'
export const isHighhelmPlate = (name?: string) => name === 'Highhelm Stronghold Bastion Plate' || name === 'Highhelm Stronghold Plate'
export const isLibraryRobes = (name?: string) => name === 'Library Robes' || name === 'Library Scroll Robes'
export const libraryRobesRank = (level: number) => level >= 19 ? 9 : level >= 15 ? 8 : level >= 12 ? 6 : 5
export const isImmortalBastion = (name?: string) => name === 'Immortal Bastion Plate' || name === 'Immortal Bastion'
export const scalingBastionRuneFamilies = (name?: string): readonly string[] =>
  isInheritorPlate(name) || isScalingPlateVariant(name) ? INHERITOR_RUNE_FAMILIES : isImmortalBastion(name) ? INHERITOR_RUNE_FAMILIES : isHighhelmPlate(name) ? ['Fortification', 'Moonweave', 'Sunweave']
    : isLibraryRobes(name) ? ['Moonweave', 'Sunweave'] : []
const BODY = /\n\n-{3,}\s*\n\n/
export const SCALE_OF_IGROON_FORTRESS = 'Scale of Igroon (Fortress Shield)'
export const isScaleOfIgroonShield = (name?: string) =>
  name === 'Scale of Igroon' || name === SCALE_OF_IGROON_FORTRESS

export function isNamedArmor(name: string) {
  return ARMORS.has(name) || isBastionNamedArmor(name) || isScalingPlateVariant(name)
}

const WEAVE_ARMORS = new Set([ANCESTRAL_HIDE, "Slithermaw's Bane"])

function ancestralEmbraceVariants(item: ContentEntry): (ContentEntry & { baseOverride?: string })[] {
  return [{
    ...item, id: `${item.id}:hide`, name: ANCESTRAL_HIDE, baseOverride: 'Hide Armor',
    description: item.description.replace(/\bThis brightly colored\b/, 'This')
      .replace(/\bleather armor\b/gi, 'hide armor').replace(/\bBase Armor\s+Leather Armor/i, 'Base Armor Hide Armor')
      .replace(/\n\nThis /, '\n\nFashioned from thick hide, this '),
  }]
}

function plateVariants(item: ContentEntry): (ContentEntry & { baseOverride?: string })[] {
  return PLATE_VARIANTS[item.name].map((name, index) => {
    const baseOverride = ['Breastplate', 'Full Plate', 'Bastion Plate'][index]
    return { ...item, id: `${item.id}:${baseOverride.toLowerCase().replaceAll(' ', '-')}`, name, baseOverride,
      description: item.description.replace(/breastplate/gi, match =>
        match[0] === 'B' ? baseOverride : baseOverride.toLowerCase()) }
  })
}

export function makeNamedArmorEntries(entries: ContentEntry[], runes: { name: string }[]) {
  return entries.filter(item => item.kind === 'item' && !item.deleted && item.systems.includes('pf2e') && ARMORS.has(item.name))
    .flatMap(item => item.name === 'Ancestral Embrace' ? ancestralEmbraceVariants(item)
      : PLATE_VARIANTS[item.name] ? plateVariants(item) : [item])
    .flatMap((item: ContentEntry & { baseOverride?: string }) => {
      const elven = /\belven chain\b/i.test(item.description)
        ? entries.find(entry => entry.kind === 'item' && !entry.deleted && entry.name === 'Elven Chain'
          && entry.systems.includes('pf2e')) : undefined
      const baseName = item.baseOverride ?? /\bBase Armor\s+([^\n.]+)/i.exec(item.description)?.[1].trim()
        ?? (elven ? /\bis a ([^.]+?) made of/i.exec(elven.description)?.[1] : undefined)
      const base = baseName && entries.find(entry => entry.kind === 'armor' && !entry.deleted
        && entry.systems.includes('pf2e') && entry.name.toLowerCase() === baseName.toLowerCase())
      if (!base || /\belven chain\b/i.test(item.description) && !elven) return []
      const enchantment = /\+([1-4])\s+([^.!?\n]{0,100}?)\b(?:leather armor|hide armor|elven chain|bastion plate|full plate|breastplate|scroll robes)\b/i.exec(item.description)
      if (!enchantment) return []
      let properties = ` ${enchantment[2].toLowerCase()} `
      const fixed: string[] = WEAVE_ARMORS.has(item.name) ? ['Moonweave (Major)', 'Sunweave (Major)'] : []
      const candidates = [...runes]
      for (const name of ['Fortification', 'Fortification (Greater)']) {
        if (!candidates.some(rune => rune.name === name)) candidates.push({ name })
      }
      for (const rune of candidates.sort((a, b) => b.name.length - a.name.length)) {
        const phrase = rune.name.replace(/^(.+) \((Lesser|Greater|Major|True)\)$/, '$2 $1').toLowerCase()
        if (!properties.includes(` ${phrase} `)) continue
        fixed.push(rune.name)
        properties = properties.replace(` ${phrase} `, ' ')
      }
      const quiet = !!elven && /\bno check penalty\b/i.test(elven.description)
      const notNoisy = !!elven && /doesn[’']t have the noisy trait/i.test(elven.description)
      const fortification = fixed.some(rune => /^Fortification(?: \(Greater\))?$/.test(rune))
        ? entries.find(entry => entry.kind === 'item' && !entry.deleted && entry.name === 'Fortification'
          && entry.systems.includes('pf2e')) : undefined
      const thickening = fortification && /increasing its Bulk by (\d+) and the Strength (?:modifier )?[^.]+?by (\d+)/i.exec(fortification.description)
      const fortifiedBastion = !isScalingPlateVariant(item.name) && isBastionNamedArmor(item.name) && fixed.some(rune => /^Fortification(?: \(Greater\))?$/.test(rune))
      const traits = [...new Set([...base.traits.filter(trait => !notNoisy || trait.toLowerCase() !== 'noisy'), ...item.traits])]
      return [{
        ...item, name: item.name === 'Library Robes' ? 'Library Scroll Robes' : BASTION_NAMES[item.name] ?? item.name, kind: 'armor' as const, traits,
        data: {
          ...base.data, ...item.data, price: item.data.price ?? '', item_subcategory: 'Specific Magic Armor',
          ...(isScalingPlateVariant(item.name) ? { bulk: base.data.bulk } : {}),
          named_armor: true, named_armor_base: base.name,
          named_armor_potency: Number(enchantment[1]),
          named_armor_resilient: /\bmajor resilient\b/i.test(enchantment[2]) ? 3
            : /\bgreater resilient\b/i.test(enchantment[2]) ? 2 : /\bresilient\b/i.test(enchantment[2]) ? 1 : 0,
          named_armor_runes: fixed.join(';'),
          ...(item.name === ANCESTRAL_HIDE ? { named_armor_rune_limit: 3 } : {}),
          ...(quiet ? { check_penalty: 0 } : {}),
          ...(!isScalingPlateVariant(item.name) && (thickening || fortifiedBastion) ? { bulk: fortifiedBastion && item.data.bulk !== undefined
            ? Number(item.data.bulk) : Number(item.data.bulk ?? base.data.bulk) + Number(thickening?.[1] ?? 1),
            strength: Number(base.data.strength) + Number(thickening?.[2] ?? 1) } : {}),
          ...(elven ? { named_armor_elven: true, named_armor_material: /\bhigh-grade elven chain\b/i.test(item.description) ? 'High-grade dawnsilver elven chain' : 'Dawnsilver elven chain' } : {}),
          ...(WEAVE_ARMORS.has(item.name) || item.name === 'Immortal Bastion' || isInheritorPlate(item.name) || isScalingPlateVariant(item.name) ? { named_armor_material: 'Orichalcum' } : {}),
          ...(isHighhelmPlate(item.name) ? { named_armor_material: 'Keep Stone' } : {}),
          ...(item.name === 'Immortal Bastion' || isInheritorPlate(item.name) || isHighhelmPlate(item.name) || isLibraryRobes(item.name) || isScalingPlateVariant(item.name) ? { automatic_fundamentals: true } : {}),
          ...(item.name.startsWith('Rebounding ') ? { resistances: 'bludgeoning=5,piercing=5,slashing=5,force=10' } : {}),
        },
        description: `${item.description}${elven ? `\n\nElven chain construction: ${elven.description.split(BODY)[1]?.trim() ?? elven.description}` : ''}`,
      }]
    })
}

export function namedArmorEnhancements(entry?: ContentEntry) {
  if (!entry?.data.named_armor) return undefined
  return {
    potency: Number(entry.data.named_armor_potency),
    resilient: Number(entry.data.named_armor_resilient),
    runes: String(entry.data.named_armor_runes ?? '').split(';').filter(Boolean),
  }
}

export function scaledNamedArmorDescription(entry: ContentEntry, armor: OwnedArmor) {
  if (!entry.data.named_armor || entry.data.automatic_fundamentals !== true) return entry.description
  const resilient = ['', 'resilient', 'greater resilient', 'major resilient'][armor.resilient]
  if (entry.data.library_spell_rank) return `Stores one spell of up to rank ${entry.data.library_spell_rank}. ${entry.description}`
  const runes = armor.runes.map(rune => rune.replace(/^(.+) \((Lesser|Greater|Major|True)\)$/, '$2 $1').toLowerCase())
  const enhancements = [armor.potency ? `+${armor.potency}` : '', resilient, ...runes].filter(Boolean).join(' ')
  return entry.description.replace(/\+[1-4]\s+[^.!?\n]{0,100}?\b(bastion plate|full plate|breastplate)\b/i,
    `${enhancements ? `${enhancements} ` : ''}$1`)
}

export function scaleAncestralEmbrace(entry: ContentEntry | undefined, level: number) {
  if (!entry?.data.named_armor || entry.name !== ANCESTRAL_HIDE || level < 12) return entry
  const runes = String(entry.data.named_armor_runes ?? '').split(';').filter(Boolean)
  return { ...entry, data: { ...entry.data,
    ...(isScalingPlateVariant(entry.name) ? { named_armor_runes: '' } : {}),
    named_armor_runes: [...runes, level >= 18 ? 'Fortification (Greater)' : 'Fortification'].join(';'),
    bulk: Number(entry.data.bulk) + 1, strength: Number(entry.data.strength) + 1,
  } }
}

export function scaleInheritorPlate(entry: ContentEntry | undefined, level: number) {
  if (!entry?.data.named_armor || !scalingBastionRuneFamilies(entry.name).length) return entry
  const fortification = level >= 12
  const highhelm = isHighhelmPlate(entry.name)
  const immortal = isImmortalBastion(entry.name)
  if (isLibraryRobes(entry.name)) {
    return { ...entry, data: { ...entry.data, named_armor_runes: '', library_spell_rank: libraryRobesRank(level),
      automatic_property_runes: automaticArmigerRunes(level).filter(rune => /^(Moonweave|Sunweave)/.test(rune)).join(';') } }
  }
  if (immortal) {
    return { ...entry, data: { ...entry.data, named_armor_runes: '',
      automatic_property_runes: [...automaticArmigerRunes(level).filter(rune => /^(Moonweave|Sunweave|Advancing)/.test(rune)),
        'Fortification (Greater)'].join(';') } }
  }
  return { ...entry, data: { ...entry.data,
    ...(highhelm ? { named_armor_runes: '', strength: Number(entry.data.strength) - (fortification ? 0 : 1) } : {}),
    automatic_property_runes: automaticArmigerRunes(level).filter(rune => !highhelm || !rune.startsWith('Advancing')).join(';'),
    ...(!highhelm && fortification ? { bulk: Number(entry.data.bulk) + 1, strength: Number(entry.data.strength) + 1 } : {}),
  } }
}

export function namedArmorRuneLimit(entry?: ContentEntry) {
  const limit = Number(entry?.data.named_armor_rune_limit)
  return Number.isInteger(limit) && limit >= 0 ? limit : undefined
}

const shieldCache = new WeakMap<ContentEntry[], Map<string, ContentEntry | null>>()

export function makeNamedShieldEntry(entries: ContentEntry[], name: string): ContentEntry | undefined {
  if (!isScaleOfIgroonShield(name)) return undefined
  let cache = shieldCache.get(entries)
  if (!cache) shieldCache.set(entries, cache = new Map())
  if (cache.has(name)) return cache.get(name) ?? undefined
  const item = entries.find(entry => entry.kind === 'item' && !entry.deleted && entry.name === name && entry.systems.includes('pf2e'))
    ?? entries.find(entry => entry.kind === 'item' && !entry.deleted && entry.name === 'Scale of Igroon' && entry.systems.includes('pf2e'))
  const stats = item && /\bHardness (\d+), HP (\d+), BT (\d+)\b/.exec(item.description)
  const fortress = name === SCALE_OF_IGROON_FORTRESS
    ? entries.find(entry => entry.kind === 'shield' && !entry.deleted && entry.name === 'Fortress Shield' && entry.systems.includes('pf2e'))
    : undefined
  const profile = fortress ? 'Fortress Shield profile: AC Bonus 3 (4 while raised and taking cover); Speed Penalty -10 feet; Bulk 5.' : undefined
  const description = item
    ? profile ? item.description.replace(/\n\n(?:\*\*)?Activate(?:\*\*)?/, `\n\n${profile}\n\nActivate`) : item.description
    : ''
  const shield = item && stats && (name !== SCALE_OF_IGROON_FORTRESS || fortress) ? {
    ...item, id: name === SCALE_OF_IGROON_FORTRESS ? `${item.id}:fortress-shield` : item.id,
    name, kind: 'shield' as const, description,
    traits: [...new Set([...(fortress?.traits ?? []), ...item.traits])],
    data: {
      ...fortress?.data, ...item.data, named_shield: true,
      ...(fortress ? { named_shield_base: fortress.name, named_shield_fortress: true,
        ac: fortress.data.ac, bulk: fortress.data.bulk, speed_penalty: fortress.data.speed_penalty,
        hands: fortress.data.hands } : {}),
      hardness: Number(stats[1]), hp: Number(stats[2]), bt: Number(stats[3]),
    },
  } : undefined
  cache.set(name, shield ?? null)
  return shield
}

const ACTIONS: Record<string, string[]> = {
  'Ancestral Embrace': ['Free Action', 'Free Action', 'Two Actions'],
  [ANCESTRAL_HIDE]: ['Free Action', 'Free Action', 'Two Actions'],
  "Slithermaw's Bane": ['Reaction', ''],
  "Slithermaw's Bane (Artifact)": ['Reaction', 'Two Actions', 'Two Actions'],
  'Scale of Igroon': ['Single Action', 'Single Action', 'Free Action'],
  [SCALE_OF_IGROON_FORTRESS]: ['Single Action', 'Single Action', 'Free Action'],
  'Shadowed Scale, the Jungle Secret': ['Single Action', 'Single Action'],
  'Highhelm Stronghold Plate': ['Three Actions'],
  'Highhelm Stronghold Bastion Plate': ['Three Actions'],
  'Bastion of the Inheritor': ['Single Action'],
  'Bastion Plate of the Inheritor': ['Single Action'],
  'Immortal Bastion': ['Reaction', 'Reaction'],
  'Immortal Bastion Plate': ['Reaction', 'Reaction'],
  'Rebounding Breastplate': ['Single Action'],
  'Rebounding Full Plate': ['Single Action'],
  'Rebounding Bastion Plate': ['Single Action'],
  'Breastplate of the Mountain': ['Two Actions', 'Single Action', 'Reaction'],
  'Full Plate of the Mountain': ['Two Actions', 'Single Action', 'Reaction'],
  'Bastion Plate of the Mountain': ['Two Actions', 'Single Action', 'Reaction'],
}

export function namedArmorAbilities(entry?: ContentEntry) {
  if (!entry || !entry.data.named_armor && !entry.data.named_shield && entry.name !== 'Shadowed Scale, the Jungle Secret') return []
  const sections = entry.description.split('\n\nElven chain construction:')[0].split(BODY)
  const body = sections.at(-1)!.replace(/\n\nNethys Note:[\s\S]*$/, '')
  const statBlock = sections.length > 2 && /^Perception\b/.test(sections.at(-2)!.trim()) ? sections.at(-2)! : ''
  const starts = [...body.matchAll(/(?:^|\n\n)(Activate|Destruction)\b/g)]
  const paragraphs = (text: string) => text.split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean)
  const abilities = [
    { name: 'Senses', paragraphs: paragraphs(statBlock), actions: undefined as string | undefined },
    { name: 'Summary', paragraphs: paragraphs(body.slice(0, starts[0]?.index)), actions: undefined as string | undefined },
    ...starts.map((match, index) => {
      const section = body.slice(match.index + match[0].length, starts[index + 1]?.index).trim()
      const named = /^[—–-]\s*(.+?)(?=\s+\(|\s+(?:Frequency|Requirements|Trigger|Effect)\b|\s+\d+\s+(?:minutes?|hours?|rounds?)\b)/.exec(section)
      return {
        name: match[1] === 'Destruction' ? 'Destruction' : named?.[1].trim() ?? `Activation ${index + 1}`,
        actions: match[1] === 'Destruction' ? undefined : ACTIONS[entry.name]?.[index],
        paragraphs: paragraphs(named ? section.slice(named[0].length) : section),
      }
    }),
  ].filter(ability => ability.paragraphs.length)
  const rank = (name: string) => name === 'Senses' ? 0 : name === 'Summary' ? 1 : name === 'Destruction' ? 3 : 2
  return abilities.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
}
