import type { ContentEntry } from './types'

const ANCESTRAL_HIDE = 'Ancestral Embrace Hide Armor'
const ARMORS = new Set(['Ancestral Embrace', ANCESTRAL_HIDE, "Slithermaw's Bane", "Slithermaw's Bane (Artifact)"])
const BODY = /\n\n-{3,}\s*\n\n/
export const SCALE_OF_IGROON_FORTRESS = 'Scale of Igroon (Fortress Shield)'
export const isScaleOfIgroonShield = (name?: string) =>
  name === 'Scale of Igroon' || name === SCALE_OF_IGROON_FORTRESS

export function isNamedArmor(name: string) {
  return ARMORS.has(name)
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

export function makeNamedArmorEntries(entries: ContentEntry[], runes: { name: string }[]) {
  return entries.filter(item => item.kind === 'item' && !item.deleted && item.systems.includes('pf2e') && ARMORS.has(item.name))
    .flatMap(item => item.name === 'Ancestral Embrace' ? ancestralEmbraceVariants(item) : [item])
    .flatMap((item: ContentEntry & { baseOverride?: string }) => {
      const elven = /\belven chain\b/i.test(item.description)
        ? entries.find(entry => entry.kind === 'item' && !entry.deleted && entry.name === 'Elven Chain'
          && entry.systems.includes('pf2e')) : undefined
      const baseName = item.baseOverride ?? /\bBase Armor\s+([^\n.]+)/i.exec(item.description)?.[1].trim()
        ?? (elven ? /\bis a ([^.]+?) made of/i.exec(elven.description)?.[1] : undefined)
      const base = baseName && entries.find(entry => entry.kind === 'armor' && !entry.deleted
        && entry.systems.includes('pf2e') && entry.name.toLowerCase() === baseName.toLowerCase())
      if (!base || /\belven chain\b/i.test(item.description) && !elven) return []
      const enchantment = /\+([1-4])\s+([^.!?\n]{0,100}?)\b(?:leather armor|hide armor|elven chain)\b/i.exec(item.description)
      if (!enchantment) return []
      let properties = ` ${enchantment[2].toLowerCase()} `
      const fixed: string[] = WEAVE_ARMORS.has(item.name) ? ['Moonweave (Major)', 'Sunweave (Major)'] : []
      const candidates = [...runes, ...(/\bgreater fortification\b/i.test(enchantment[2])
        && !runes.some(rune => rune.name === 'Fortification (Greater)') ? [{ name: 'Fortification (Greater)' }] : [])]
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
      const thickening = fortification && /increasing its Bulk by (\d+) and the Strength modifier[^.]+?by (\d+)/i.exec(fortification.description)
      const traits = [...new Set([...base.traits.filter(trait => !notNoisy || trait.toLowerCase() !== 'noisy'), ...item.traits])]
      return [{
        ...item, kind: 'armor' as const, traits,
        data: {
          ...base.data, ...item.data, price: item.data.price ?? '', item_subcategory: 'Specific Magic Armor',
          named_armor: true, named_armor_base: base.name,
          named_armor_potency: Number(enchantment[1]),
          named_armor_resilient: /\bmajor resilient\b/i.test(enchantment[2]) ? 3
            : /\bgreater resilient\b/i.test(enchantment[2]) ? 2 : /\bresilient\b/i.test(enchantment[2]) ? 1 : 0,
          named_armor_runes: fixed.join(';'),
          ...(item.name === ANCESTRAL_HIDE ? { named_armor_rune_limit: 3 } : {}),
          ...(quiet ? { check_penalty: 0 } : {}),
          ...(thickening ? { bulk: Number(item.data.bulk ?? base.data.bulk) + Number(thickening[1]),
            strength: Number(base.data.strength) + Number(thickening[2]) } : {}),
          ...(elven ? { named_armor_elven: true, named_armor_material: /\bhigh-grade elven chain\b/i.test(item.description) ? 'High-grade dawnsilver elven chain' : 'Dawnsilver elven chain' } : {}),
          ...(WEAVE_ARMORS.has(item.name) ? { named_armor_material: 'Orichalcum' } : {}),
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
