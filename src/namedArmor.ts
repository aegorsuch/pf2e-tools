import type { ContentEntry } from './types'

const ANCESTRAL_HIDE = 'Ancestral Embrace Hide Armor'
const ARMORS = new Set(['Ancestral Embrace', ANCESTRAL_HIDE, "Slithermaw's Bane", "Slithermaw's Bane (Artifact)"])
const BODY = /\n\n-{3,}\s*\n\n/

export function isNamedArmor(name: string) {
  return ARMORS.has(name)
}

const isAncestralEmbrace = (name: string) => name === 'Ancestral Embrace' || name === ANCESTRAL_HIDE

function ancestralEmbraceVariants(item: ContentEntry): (ContentEntry & { baseOverride?: string })[] {
  const leather = { ...item, description: item.description.replace(/\bThis brightly colored\b/, 'This') }
  const hide = {
    ...leather, id: `${item.id}:hide`, name: ANCESTRAL_HIDE, baseOverride: 'Hide Armor',
    description: leather.description.replace(/\bleather armor\b/gi, 'hide armor').replace(/\bBase Armor\s+Leather Armor/i, 'Base Armor Hide Armor')
      .replace(/^This /, 'Fashioned from thick hide, this ').replace(/\+4 (?=\[?major resilient)/i, '+4 greater fortification '),
  }
  return [leather, hide]
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
      const fixed: string[] = isAncestralEmbrace(item.name) ? ['Moonweave (Major)', 'Sunweave (Major)'] : []
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
          ...(quiet ? { check_penalty: 0 } : {}),
          ...(thickening ? { bulk: Number(item.data.bulk ?? base.data.bulk) + Number(thickening[1]),
            strength: Number(base.data.strength) + Number(thickening[2]) } : {}),
          ...(isAncestralEmbrace(item.name) ? { named_armor_material: 'Grisantian Hide' } : {}),
          ...(elven ? { named_armor_material: /\bhigh-grade elven chain\b/i.test(item.description) ? 'High-grade dawnsilver elven chain' : 'Dawnsilver elven chain' } : {}),
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

const shieldCache = new WeakMap<ContentEntry[], ContentEntry | null>()

export function makeNamedShieldEntry(entries: ContentEntry[], name: string): ContentEntry | undefined {
  if (name !== 'Scale of Igroon') return undefined
  const cached = shieldCache.get(entries)
  if (cached !== undefined) return cached ?? undefined
  const item = entries.find(entry => entry.kind === 'item' && !entry.deleted && entry.name === name && entry.systems.includes('pf2e'))
  const stats = item && /\bHardness (\d+), HP (\d+), BT (\d+)\b/.exec(item.description)
  const shield = item && stats ? { ...item, kind: 'shield' as const,
    data: { ...item.data, named_shield: true, hardness: Number(stats[1]), hp: Number(stats[2]), bt: Number(stats[3]) } } : undefined
  shieldCache.set(entries, shield ?? null)
  return shield
}

const ACTIONS: Record<string, string[]> = {
  'Ancestral Embrace': ['Free Action', 'Free Action', 'Two Actions'],
  [ANCESTRAL_HIDE]: ['Free Action', 'Free Action', 'Two Actions'],
  "Slithermaw's Bane": ['Reaction', ''],
  "Slithermaw's Bane (Artifact)": ['Reaction', 'Two Actions', 'Two Actions'],
  'Scale of Igroon': ['Single Action', 'Single Action', 'Free Action'],
  'Shadowed Scale, the Jungle Secret': ['Single Action', 'Single Action'],
}

export function namedArmorAbilities(entry?: ContentEntry) {
  if (!entry || !entry.data.named_armor && !entry.data.named_shield && entry.name !== 'Shadowed Scale, the Jungle Secret') return []
  const body = entry.description.split('\n\nElven chain construction:')[0].split(BODY).at(-1)!
    .replace(/\n\nNethys Note:[\s\S]*$/, '')
  const starts = [...body.matchAll(/(?:^|\n\n)(Activate|Destruction)\b/g)]
  const paragraphs = (text: string) => text.split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean)
  return [
    { name: 'Properties', paragraphs: paragraphs(body.slice(0, starts[0]?.index)), actions: undefined as string | undefined },
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
}
