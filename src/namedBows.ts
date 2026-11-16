import type { ContentEntry } from './types'

const bowBase = /\bBase Weapon\s+((?:Composite )?(?:Shortbow|Longbow))\b/i
const enchantment = /\+([1-3])\s+([^.!?\n]{0,100}?)\b(?:composite\s+)?(?:shortbows?|longbows?)\b/i

function enhancements(item: ContentEntry, family: ContentEntry[], runes: { name: string }[]) {
  const marker = (name: string) => `\n\n${name}\n\n`
  const boundaries = family.map(peer => item.description.indexOf(marker(peer.name))).filter(index => index >= 0)
  const common = item.description.slice(0, boundaries.length ? Math.min(...boundaries) : undefined)
  const start = item.description.lastIndexOf(marker(item.name))
  const following = start < 0 ? [] : boundaries.filter(index => index > start)
  const section = start < 0 ? '' : item.description.slice(start, following.length ? Math.min(...following) : undefined)
  const match = enchantment.exec(section) ?? enchantment.exec(common)
  let properties = ` ${match?.[2].toLowerCase() ?? ''} `
  const fixed: string[] = []
  for (const rune of [...runes].sort((a, b) => b.name.length - a.name.length)) {
    const phrase = rune.name.replace(/^(.+) \((Lesser|Greater|Major|True)\)$/, '$2 $1').toLowerCase()
    if (!properties.includes(` ${phrase} `)) continue
    fixed.push(rune.name)
    properties = properties.replace(` ${phrase} `, ' ')
  }
  return {
    named_bow_potency: match ? Number(match[1]) : 0,
    named_bow_striking: /\bmajor striking\b/i.test(match?.[2] ?? '') ? 3
      : /\bgreater striking\b/i.test(match?.[2] ?? '') ? 2 : /\bstriking\b/i.test(match?.[2] ?? '') ? 1 : 0,
    named_bow_runes: fixed.join(';'),
    named_bow_rules_missing: !match || !!properties.replace(/\b(?:(?:greater|major)\s+)?striking\b|\bmagic(?:al)?\b/g, '').trim(),
  }
}

export function makeNamedBowEntries(entries: ContentEntry[], runes: { name: string }[]) {
  const items = entries.filter(entry => entry.kind === 'item' && !entry.deleted
    && (entry.data.item_subcategory === 'Specific Magic Weapons' || entry.name === 'Wintershot (Artifact)'))
  return items.flatMap(item => {
    const originalBase = bowBase.exec(item.description)?.[1]
      ?? (item.name === 'Wintershot (Artifact)' && /\bcomposite shortbow\b/i.test(item.description) ? 'Composite Shortbow' : undefined)
    if (!originalBase) return []
    const composite = /^composite /i.test(originalBase)
    const family = items.filter(peer => peer.data.url && peer.data.url === item.data.url)
    const fixed = enhancements(item, family, runes)
    return (['Shortbow', 'Longbow'] as const).flatMap(type => {
      const base = entries.find(entry => entry.kind === 'weapon' && !entry.deleted
        && entry.name.toLowerCase() === `${composite ? 'Composite ' : ''}${type}`.toLowerCase()
        && entry.systems.some(system => item.systems.includes(system)))
      if (!base) return []
      const custom = base.name.toLowerCase() !== originalBase.toLowerCase()
      const traits = [...new Map([...base.traits, ...item.traits].map(trait => [trait.toLowerCase(), trait])).values()]
      const data = { ...base.data, url: item.data.url ?? '', sourceBook: item.data.sourceBook ?? '',
        price: item.data.price ?? '', rarity: item.data.rarity ?? 'common', item_category: 'Weapons',
        item_subcategory: 'Specific Magic Weapons', named_bow: true, named_bow_source: item.name, named_bow_base: base.name, ...fixed }
      const entry: ContentEntry = { ...item, id: `${item.id}:${type.toLowerCase()}`, kind: 'weapon',
        source: custom ? 'homebrew' : item.source, name: `${item.name} (${type})`, traits, data,
        description: `${custom ? 'Custom bow version' : 'Base weapon'}: ${base.name}. Named-item abilities are unchanged.\n\n${item.description}` }
      return [...(custom ? [] : [{ ...entry, id: item.id, name: item.name }]), entry]
    })
  })
}

export function namedBowEnhancements(entry?: ContentEntry) {
  if (!entry?.data.named_bow) return undefined
  return {
    potency: Number(entry.data.named_bow_potency),
    striking: Number(entry.data.named_bow_striking),
    runes: String(entry.data.named_bow_runes).split(';').filter(Boolean),
  }
}
