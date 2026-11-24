import type { ContentEntry, OwnedWeapon } from './types'
import { getSettings } from './settings'

export const BRIAR_MAX_SHARPNESS = 20
export function briarSharpnessPoints(value: number | undefined) {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0 ? Math.min(value, BRIAR_MAX_SHARPNESS) : 0
}

const basePattern = "(?:Composite )?(?:Shortbows?|Longbows?)|Dancer['\u2019]s Spear|Dwarven War ?Axe|Elven Curve Blade|Bastard Sword|Dueling Pistol|Fighting Fan|Light Hammer|Gun Sword|Longsword|Shortsword|Greatsword|Greataxe|Morningstar|Longspear|Guisarme|Glaive|Rapier|Spear|Club|Dart|Hatchet|Spiked Gauntlet"
const weaponBase = new RegExp(`\\bBase Weapon\\s+(${basePattern})\\b`, 'i')
const enchantment = new RegExp(`\\+([1-4])\\s+([^.!?\\n]{0,100}?)\\b(?:${basePattern})\\b`, 'i')
const BASES: Record<string, string[]> = {
  "Horselord's Longbow": ['Composite Longbow'],
  'Splithead Bow': ['Composite Longbow'],
  "Hunter's Anthem": ['Composite Longbow'],
  'Mammoth Bow': ['Composite Longbow'],
  Shadowpiercer: ['Spear', "Dancer's Spear", 'Broadspear', 'Broad Spear'],
  'Callooh Callay': ['Longsword'],
  'Blade of Fallen Stars': ['Gun Sword (Melee)', 'Gun Sword (Ranged)'],
  'Final Stand': ['Rapier'],
  Briar: ['Bastard Sword'],
  'Axe of the Dwarven Lords': ['Dwarven Waraxe'],
  'Azlanti Diamond': ['Longsword'],
  Blackaxe: ['Greataxe'],
  'Cane of the Maelstrom': ['Club'],
  "Clear Cutter's Axe": ['Hatchet'],
  'Fungicidal Hatchet': ['Hatchet'],
  'Scalding Gauntlets': ['Spiked Gauntlet', 'Gauntlet', 'Bladed Gauntlet', 'Clawed Gauntlet'],
  "Cayden's Tankard": ['Light Hammer'],
  'Coldstar Pistols': ['Dueling Pistol', 'Clan Pistol'],
  'Debilitating Dart': ['Dart'],
  "Freedom's Flame": ['Morningstar'],
  "Ghosthand's Comet": ["Ghosthand's Comet"],
  "Hunter's Dawn": ['Club', 'Dart', 'Javelin'],
  'Kortos Diamond': ['Longsword'],
  'Lamentation of the Faithless': ['Greatsword'],
  "Meloth's Lifedrinker (Improved)": ['Longsword'],
  Ovinrbaane: ['Greatsword'],
  'Phoenix Fighting Fan': ['Fighting Fan'],
  Ridill: ['Greatsword'],
  Serithtial: ['Longsword', 'Bastard Sword', 'Dagger', 'Shortsword', 'Scimitar', 'Falchion', 'Greatsword', 'Rapier'],
  'Soulcutter (Artifact)': ['Elven Curve Blade'],
  "Sorshen's Sinuous Guisarme": ['Guisarme'],
  "Spear of the Destroyer's Flame": ['Longspear'],
  'Whisperer of Souls': ['Glaive'],
}
const ACTIONS: Record<string, { name: string; actions: string }[]> = {
  'Starday Night Special': [{ name: 'Lucky Bullet', actions: 'Free Action' }],
  SLARP: [{ name: 'Sample Return', actions: 'Free Action' }],
  'Liminal Laser Rifle': [{ name: 'Liminal Lock', actions: 'Single Action' }],
  'Stun Stick': [{ name: 'Short, Sharp Shock', actions: 'Single Action' }],
  'Raptorial Edge': [{ name: 'Mind Slice', actions: 'Free Action' }],
  'Wintershot (Artifact)': [{ name: 'Auroral Shine', actions: 'Single Action' }, { name: 'Signal Flare', actions: 'Single Action' },
    { name: 'Rimecrust', actions: 'Two Actions' }],
  Shadowpiercer: [{ name: 'Absorb Shadows', actions: 'Two Actions' }, { name: 'Rebuff Gloom', actions: 'Reaction' }],
  'Callooh Callay': [{ name: 'One, Two!', actions: 'Two Actions' }, { name: 'Rest Thee by the Tumtum', actions: 'Single Action' }],
  'Blade of Fallen Stars': [{ name: 'Deploy bipod', actions: 'Single Action' }, { name: 'Starlight shot', actions: 'Two Actions' }],
  Briar: [{ name: 'Oaken Resilience', actions: 'Single Action' }, { name: 'Wither plant', actions: 'Reaction' },
    { name: 'Save partner', actions: 'Reaction' }, { name: 'Strike Nyrissa', actions: 'Reaction' }],
  'Coldstar Pistols': [{ name: 'Switch form and Feint', actions: 'Single Action' }, { name: 'Twin shots', actions: 'Single Action' }],
}

const MATERIALS: Record<string, string> = {
  'Scalding Gauntlets': 'Orichalcum', 'Coldstar Pistols': 'Orichalcum',
  Briar: 'Cold Iron', Blackaxe: 'Adamantine', Ridill: 'Adamantine', Serithtial: 'Orichalcum',
  'Axe of the Dwarven Lords': 'Orichalcum', 'Wintershot (Artifact)': 'Orichalcum', "Clear Cutter's Axe": 'Orichalcum',
  'Blade of Fallen Stars': 'Cold Siccatite (High-Grade)',
  'Debilitating Dart': 'Orichalcum',
  'Phoenix Fighting Fan': 'Silver', "Sorshen's Sinuous Guisarme": 'Dawnsilver (High-Grade)',
}

const ELEMENTAL_GAUNTLETS: Record<string, { rune: string; damage: string }> = {
  Corroding: { rune: 'Corrosive', damage: 'acid' }, Freezing: { rune: 'Frost', damage: 'cold' }, Shocking: { rune: 'Shock', damage: 'electricity' },
}
const SCALDING_RUNES: Record<string, string> = { 'Scalding Gauntlet': 'Flaming',
  ...Object.fromEntries(Object.entries(ELEMENTAL_GAUNTLETS).map(([element, { rune }]) => [`${element} Gauntlet`, rune])) }
export const ELEMENTAL_GAUNTLET_SOURCES = Object.keys(SCALDING_RUNES)
const runeBase = (rune: string) => rune.replace(/ \((?:Lesser|Greater|Major|True)\)$/, '')

function artifactRunes(entry: ContentEntry, runes: string) {
  return [...new Set([...runes.split(';').filter(Boolean),
    ...(entry.name === 'Serithtial' ? ['Astral (Greater)'] : []),
    ...(entry.name === 'Coldstar Pistols' || entry.data.named_weapon_source === 'Coldstar Pistols' ? ['Impossible'] : []),
    ...(entry.name === 'Wintershot (Artifact)' ? ['Impossible'] : []),
    ...(entry.traits.some(trait => trait.toLowerCase() === 'artifact') ? ['Grievous'] : [])])].join(';')
}

export function namedWeaponBases(entry?: ContentEntry) {
  const bases = BASES[String(entry?.data.named_weapon_source)] ?? []
  return bases.length > 1 && !bases.some(base => /\((?:Melee|Ranged)\)$/.test(base)) ? bases : []
}

function sections(item: ContentEntry, family: ContentEntry[]) {
  const marker = (name: string) => `\n\n${name}\n\n`
  const boundaries = family.map(peer => item.description.indexOf(marker(peer.name))).filter(index => index >= 0)
  const common = item.description.slice(0, boundaries.length ? Math.min(...boundaries) : undefined)
  const start = item.description.lastIndexOf(marker(item.name))
  const following = start < 0 ? [] : boundaries.filter(index => index > start)
  const section = start < 0 ? '' : item.description.slice(start, following.length ? Math.min(...following) : undefined)
  return { common, section }
}

export function namedWeaponBaseName(entry: ContentEntry) {
  return String(entry.data.named_weapon_base ?? entry.name).replace(/ \((?:Melee|Ranged)\)$/, '')
}

function enhancements(item: ContentEntry, family: ContentEntry[], runes: { name: string }[]) {
  const { common, section } = sections(item, family)
  const plain = (text: string) => text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[_*]/g, '')
  const match = enchantment.exec(plain(section)) ?? enchantment.exec(plain(common))
  let properties = ` ${match?.[2].toLowerCase() ?? ''} `
  properties = properties.replace(/\bspeed\b/g, 'quickstrike').replace(/\bspell-storing\b/g, 'spell reservoir')
  if (item.name === "Hunter's Dawn") properties = properties.replace(/\bquickstrike\b/g, 'astral')
  const fixed: string[] = []
  for (const legacy of ['Anarchic', 'Axiomatic']) {
    if (properties.includes(` ${legacy.toLowerCase()} `)) {
      fixed.push(legacy)
      properties = properties.replace(` ${legacy.toLowerCase()} `, ' ')
    }
  }
  if (/\b(?:beast-bane|dragon bane)\b/.test(properties)) {
    fixed.push('Bane')
    properties = properties.replace(/\b(?:beast-bane|dragon bane)\b/g, ' ')
  }
  for (const rune of [...runes, ...(item.name === 'Debilitating Dart' ? [{ name: 'Returning' }] : [])].sort((a, b) => b.name.length - a.name.length)) {
    const phrase = rune.name.replace(/^(.+) \((Lesser|Greater|Major|True)\)$/, '$2 $1').toLowerCase()
    if (!properties.includes(` ${phrase} `)) continue
    fixed.push(rune.name)
    properties = properties.replace(` ${phrase} `, ' ')
  }
  if (item.name === "Hunter's Dawn" && !fixed.some(rune => rune.toLowerCase() === 'astral')) fixed.push('Astral')
  return {
    named_weapon_potency: match ? Number(match[1]) : 0,
    named_weapon_striking: /\bmythic striking\b/i.test(match?.[2] ?? '') ? 4 : /\bmajor striking\b/i.test(match?.[2] ?? '') ? 3
      : /\bgreater striking\b/i.test(match?.[2] ?? '') ? 2 : /\bstriking\b/i.test(match?.[2] ?? '') ? 1 : 0,
    named_weapon_runes: fixed.join(';'),
    named_weapon_rules_missing: !match || !!properties.replace(/\b(?:(?:greater|major|mythic)\s+)?striking\b|\bmagic(?:al)?\b|\b(?:cold iron|silver|adamantine|obsidian|high-grade dawnsilver|beast-bane|dragon bane)\b/g, '').trim(),
  }
}

export function makeNamedWeaponEntries(entries: ContentEntry[], runes: { name: string }[]) {
  const items = entries.filter(entry => entry.kind === 'item' && !entry.deleted
    && entry.name !== 'Wintershot' && !/^Scalding Gauntlets \(/.test(entry.name) && entry.name !== "Meloth's Lifedrinker"
    && (entry.data.item_subcategory === 'Specific Magic Weapons' || entry.name === 'Wintershot (Artifact)' || !!BASES[entry.name]))
  const result = items.flatMap(item => {
    const sourceName = item.name === "Meloth's Lifedrinker (Improved)" ? "Meloth's Lifedrinker"
      : item.name === "Clear Cutter's Axe" ? "Clear Cutter's Hatchet" : item.name === 'Scalding Gauntlets' ? 'Scalding Gauntlet' : item.name
    const originalBase = (item.name === 'Serithtial' ? 'Longsword' : undefined)
      ?? weaponBase.exec(item.description)?.[1]?.replace(/Dwarven War Axe/i, 'Dwarven Waraxe')
      ?? (item.name === 'Wintershot (Artifact)' && /\bcomposite shortbow\b/i.test(item.description) ? 'Composite Shortbow' : undefined)
      ?? (BASES[item.name]?.length === 1 ? BASES[item.name][0] : undefined)
      ?? (item.name === "Ghosthand's Comet" ? item.name : undefined)
    if (!originalBase || !BASES[item.name] && !/\b(?:shortbow|longbow)$/i.test(originalBase)) return []
    const composite = /^composite /i.test(originalBase)
    const family = items.filter(peer => peer.data.url && peer.data.url === item.data.url)
    const fixed = enhancements(item, family, runes)
    if (item.name === "Ghosthand's Comet") Object.assign(fixed, {
      named_weapon_potency: 4, named_weapon_striking: 3, named_weapon_runes: 'Bane;Impactful (Greater)', named_weapon_rules_missing: false,
    })
    const choices = BASES[item.name] ?? (/^(?:Composite )?(?:Shortbow|Longbow)$/i.test(originalBase)
      ? ['Composite Longbow'] : ['Shortbow', 'Longbow'].map(type => `${composite ? 'Composite ' : ''}${type}`))
    const { common: rawCommon, section: rawSection } = sections(item, family)
    let alias = false
    return choices.flatMap(baseName => {
      const base = item.name === "Ghosthand's Comet" ? item : entries.find(entry => entry.kind === 'weapon' && !entry.deleted
        && entry.name.toLowerCase() === baseName.toLowerCase()
        && entry.systems.some(system => item.systems.includes(system)))
      if (!base) return []
      const replaceDawnRunes = (text: string) => {
        if (item.name !== "Hunter's Dawn") return text
        const astral = text.replace(/\[speed\]\(\/Equipment\.aspx\?ID=\d+\)/i, '[Astral](/Equipment.aspx?ID=2832)')
        return base.name === 'Club' ? astral : astral.replace(/\[ghost touch\]\([^)]+\)/i, 'Returning')
      }
      const common = replaceDawnRunes(rawCommon)
      const section = replaceDawnRunes(rawSection)
      const native = base.name.replace(/ \((?:Melee|Ranged)\)$/, '').toLowerCase() === originalBase.toLowerCase()
      const custom = !native && !['Serithtial', "Hunter's Dawn"].includes(item.name)
      const label = /\((Melee|Ranged)\)$/.exec(base.name)?.[1] ?? base.name.replace(/^Composite /i, '')
      const traits = [...new Map([...base.traits.filter(trait => !/^(?:common|uncommon|rare|unique)$/i.test(trait)),
        ...(item.name === 'Scalding Gauntlets' ? ['Free-Hand'] : []),
        ...item.traits].map(trait => [trait.toLowerCase(), trait])).values()]
      const fixedRunes = fixed.named_weapon_runes.split(';').filter(Boolean)
      const formRunes = item.name === "Hunter's Dawn" && base.name !== 'Club'
        ? [...new Set([...fixedRunes.filter(rune => runeBase(rune) !== 'Ghost Touch'), 'Returning'])].join(';')
        : fixed.named_weapon_runes
      const data: ContentEntry['data'] = { ...base.data, url: item.data.url ?? '', sourceBook: item.data.sourceBook ?? '',
        price: item.data.price ?? '', rarity: item.data.rarity ?? 'common', item_category: 'Weapons',
        artifact_activation_actions: item.data.artifact_activation_actions ?? item.data.item_activation_actions ?? '',
        item_subcategory: 'Specific Magic Weapons', named_weapon: true, named_weapon_source: sourceName, named_weapon_base: base.name,
        named_weapon_material: MATERIALS[item.name] ?? '',
        named_weapon_resolver_only: item.name === 'Serithtial' && !native, ...fixed,
        named_weapon_runes: artifactRunes(item, formRunes) }
      if (item.data.bulk !== undefined) data.bulk = item.data.bulk
      if (item.name === 'Mammoth Bow') {
        data.range = 180
        traits.splice(0, traits.length, ...traits.filter(trait => !/^volley\b/i.test(trait)), 'Volley 50 ft.')
      }
      if (['Axe of the Dwarven Lords', "Spear of the Destroyer's Flame"].includes(item.name)) {
        data.thrown_range = 30
        data.hands = 2
        traits.push('Thrown 30 ft.')
      }
      if (item.name === "Freedom's Flame") traits.push('Razing')
      if (item.name === "Sorshen's Sinuous Guisarme") {
        traits.push('Twin')
      }
      if (item.name === 'Coldstar Pistols') {
        traits.push('Agile')
        data.hands = 2
        data.named_weapon_no_ammunition = true
      }
      if (item.name === "Hunter's Dawn" && base.name !== 'Club') {
        const range = Number(base.data.thrown_range ?? base.data.range)
        if (range > 0) {
          if (Number(base.data.range) > 0) data.range = range * 2
          data.thrown_range = range * 2
          for (let i = 0; i < traits.length; i++) if (/^Thrown\b/i.test(traits[i])) traits[i] = `Thrown ${range * 2} ft.`
        }
      }
      if (item.name === "Ghosthand's Comet") {
        Object.assign(data, { damage: '1d8 force', weapon_type: 'Ranged', weapon_category: 'Advanced', weapon_group: 'Firearm',
          range: 300, hands: 2, named_weapon_damage_dice: 5, named_weapon_no_ammunition: true })
        traits.splice(0, traits.length, ...item.traits, 'Backstabber', 'Concussive', 'Kickback', 'Fatal d12')
      }
      const entry: ContentEntry = { ...item, id: choices.length === 1 ? item.id : `${item.id}:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, kind: 'weapon',
        source: custom ? 'homebrew' : item.source, name: choices.length === 1 ? sourceName : `${sourceName} (${label})`, traits, data,
        description: `${custom ? 'Custom weapon version' : 'Base weapon'}: ${base.name}. Named-item abilities are unchanged.\n\n${common}${section}` }
      if (!native || alias || choices.length === 1) return [entry]
      alias = true
      return [{ ...entry, id: item.id, name: item.name, data: { ...data, named_weapon_resolver_only: true } }, entry]
    })
  })
  const elemental = result.filter(entry => entry.data.named_weapon_source === 'Scalding Gauntlet' && !entry.data.named_weapon_resolver_only)
  return [...result, ...Object.entries(ELEMENTAL_GAUNTLETS).flatMap(([element, { rune, damage }]) => elemental.map((entry): ContentEntry => {
    const label = `${element} Gauntlet`
    const rename = (text: string) => text.replace(/Scalding Gauntlets?/g, label).replace(/persistent fire/g, `persistent ${damage}`)
      .replace(/\bflaming\b/gi, rune.toLowerCase()).replace(/\bfire\b/g, damage).replace(/\bFire\b/g, damage[0].toUpperCase() + damage.slice(1))
      .replace(/\bflames?\b/g, damage).replace(/\bscalding\b/g, element.toLowerCase())
    return { ...entry, id: `${entry.id}:${element.toLowerCase()}`, name: rename(entry.name), description: rename(entry.description),
      traits: entry.traits.map(trait => trait.toLowerCase() === 'fire' ? damage[0].toUpperCase() + damage.slice(1) : trait),
      data: { ...entry.data, named_weapon_source: label,
        named_weapon_runes: String(entry.data.named_weapon_runes ?? '').split(';').filter(r => r && runeBase(r) !== 'Flaming').join(';') } }
  }))]
}

export function withNamedWeaponState(entry: ContentEntry | undefined, weapon: OwnedWeapon, level?: number) {
  if (!entry?.data.named_weapon) return entry
  const source = entry.data.named_weapon_source
  if (typeof source === 'string' && SCALDING_RUNES[source]) {
    const at = level ?? entry.level
    const element = SCALDING_RUNES[source]
    const runes = String(entry.data.named_weapon_runes ?? '').split(';').filter(Boolean)
    return { ...entry, data: { ...entry.data,
      named_weapon_potency: at >= 18 ? 3 : 2, named_weapon_striking: at >= 13 ? 2 : 1,
      named_weapon_runes: [...new Set([...runes.filter(rune => runeBase(rune) !== 'Flaming' && runeBase(rune) !== element),
        at >= 18 ? `${element} (Greater)` : element, 'Hooked', 'Grappling', 'Grievous'])].join(';') } }
  }
  if (source === 'Fungicidal Hatchet') {
    const runes = String(entry.data.named_weapon_runes ?? '').split(';').filter(Boolean)
    return { ...entry, data: { ...entry.data, named_weapon_runes: [...new Set([...runes, 'Returning', 'Grievous'])].join(';'),
      named_weapon_material: `Peachwood (${(level ?? entry.level) >= 18 ? 'High' : 'Standard'}-Grade)` } }
  }
  if (source === "Hunter's Dawn") {
    const at = level ?? entry.level
    const runes = String(entry.data.named_weapon_runes ?? '').split(';').filter(Boolean)
    return { ...entry, data: { ...entry.data,
      named_weapon_material: `Peachwood (${at >= 18 ? 'High' : 'Standard'}-Grade)`,
      named_weapon_runes: [...new Set(runes.map(rune => runeBase(rune) === 'Astral'
        ? at >= 15 ? 'Astral (Greater)' : 'Astral' : rune))].join(';') } }
  }
  if (source === 'Debilitating Dart' && (level ?? entry.level) >= 10) {
    const runes = String(entry.data.named_weapon_runes ?? '').split(';').filter(Boolean)
    return { ...entry, data: { ...entry.data, named_weapon_runes: [...new Set([
      ...runes, 'Cunning', ...((level ?? entry.level) >= 20 ? ['Impossible'] : []),
    ])].join(';') } }
  }
  if (source === "Clear Cutter's Hatchet") {
    const at = level ?? entry.level
    const runes = String(entry.data.named_weapon_runes ?? '').split(';').filter(Boolean)
    return { ...entry, data: { ...entry.data, named_weapon_runes: [...new Set([...runes, 'Returning', 'Grievous',
      ...(at >= 8 ? [at >= 15 ? 'Flaming (Greater)' : 'Flaming'] : []),
      ...(at >= 20 ? ['Impossible'] : [])])].join(';') } }
  }
  if (source === 'Coldstar Pistols') {
    const merged = weapon.coldstarForm === 'Merged'
    const baseRange = Number(entry.data.range) || 60
    return { ...entry, data: { ...entry.data, hands: !weapon.coldstarForm || weapon.coldstarForm === 'Paired' ? 2 : 1,
      range: merged ? baseRange * 2 : baseRange, named_weapon_potency: merged ? 4 : 3, named_weapon_striking: merged ? 3 : 2,
      named_weapon_runes: artifactRunes(entry, merged ? 'Flaming (Greater);Frost (Greater)'
        : weapon.coldstarForm === 'Frost' ? 'Frost (Greater)' : 'Flaming (Greater)'), named_weapon_rules_missing: false } }
  }
  if (source === 'Azlanti Diamond') {
    const bond = [0, 1, 2].includes(weapon.azlantiBond ?? 0) ? weapon.azlantiBond ?? 0 : 0
    return { ...entry, level: Math.max(entry.level, level ?? entry.level),
      data: { ...entry.data, named_weapon_potency: bond + 1, named_weapon_striking: bond + 1 } }
  }
  if (source !== 'Briar') return entry
  const points = briarSharpnessPoints(weapon.briarSharpness)
  const tiers = [...entry.description.matchAll(/(?:^|\n\n)(1|4|8|14|20) Sharpness Points?\b/g)]
  const tier = tiers.filter(match => Number(match[1]) <= points).at(-1)
  const next = tier && tiers[tiers.indexOf(tier) + 1]
  const destruction = entry.description.search(/(?:^|\n\n)Destruction\b/)
  const end = destruction < 0 ? entry.description.length : destruction
  const intro = entry.description.slice(0, tiers[0]?.index ?? end)
  const active = tier ? entry.description.slice(tier.index, next?.index ?? end) : ''
  const baseOakenRank = points >= 20 ? 8 : points >= 14 ? 6 : points >= 8 ? 4 : points >= 4 ? 2 : 0
  const oakenRank = baseOakenRank && level !== undefined && getSettings().innateAutoHeighten
    ? Math.max(baseOakenRank, Math.ceil(level / 2)) : baseOakenRank
  const oakenResistance = 2 * Math.floor(oakenRank / 2)
  const remastered = active.replace(/\bcasts (?:an? )?(?:[2468](?:nd|th)-level )?barkskin on its partner\.?/gi,
    `casts rank ${oakenRank} Oaken Resilience on its partner. For 10 minutes, the partner gains resistance ${oakenResistance} to bludgeoning and piercing damage and weakness ${oakenResistance * 3 / 2} to fire. After taking fire damage, the partner can Dismiss the spell as a free action triggered by that damage; this does not reduce the triggering damage.`)
    .replace(/\bbarkskin\b/gi, 'Oaken Resilience')
  return { ...entry, description: [intro, remastered, destruction < 0 ? '' : entry.description.slice(destruction)].join('\n\n'),
    traits: [...entry.traits.filter(trait => trait !== 'Intelligent'), ...(points >= 4 ? ['Intelligent'] : [])],
    data: { ...entry.data, named_weapon_potency: points >= 8 ? 4 : 3, named_weapon_striking: points >= 4 ? 3 : 2,
      named_weapon_runes: artifactRunes(entry, [points >= 1 ? 'Shifting' : '', points >= 20 ? 'Vorpal' : ''].filter(Boolean).join(';')),
      named_weapon_oaken_rank: oakenRank,
      artifact_activation_actions: ['Single Action', 'Reaction', 'Reaction', 'Reaction'].slice(0,
        points >= 20 ? 4 : points >= 14 ? 3 : points >= 8 ? 2 : points >= 4 ? 1 : 0).join(';'),
      named_weapon_rules_missing: tiers.length !== 5 } }
}

export function namedWeaponEnhancements(entry?: ContentEntry) {
  if (!entry?.data.named_weapon) return undefined
  return {
    potency: Number(entry.data.named_weapon_potency),
    striking: Number(entry.data.named_weapon_striking),
    runes: String(entry.data.named_weapon_runes).split(';').filter(Boolean),
    material: String(entry.data.named_weapon_material ?? '') || undefined,
  }
}

export function namedWeaponDamage(entry?: ContentEntry) {
  const source = entry?.data.named_weapon_source
  if (source === 'Mammoth Bow') return [{
    source, value: '2d6 piercing', note: 'Additional draw-power damage. Requires a Large or larger wielder.',
  }]
  if (source === "Horselord's Longbow") return [{
    source, value: '2 circumstance vs. eligible unmounted targets',
    note: 'Only while mounted, against unmounted creatures smaller than your mount.',
  }]
  if (source === "Hunter's Anthem") return [{
    source, value: '1d6 sonic vs. hunted prey',
    note: 'Requires the Hunt Prey class feature. The Thundering rune applies only on Strikes against your prey.',
  }]
  if (source === 'Shadowpiercer') return [{
    source, value: '2d6 precision vs. incorporeal or shadow creatures',
    note: 'Against creatures with the incorporeal or shadow trait, this weapon ignores immunity and resistance to precision damage.',
  }]
  if (source === 'Callooh Callay') return [{
    source, value: '2d6 persistent bleed vs. Tane or linnorms',
    note: 'Applies only when Striking a Tane or linnorm, not other targets.',
  }]
  if (source === 'Fungicidal Hatchet') return [{ source, value: '1 poison (1d6 vs. fungus)',
    note: 'Additional poison damage on a successful Strike; 1d6 if the target has the fungus trait.' }]
  const conditional = source === 'Axe of the Dwarven Lords' ? '1d6 vs. orcs'
    : source === 'Blackaxe' ? '2d6 vs. plants'
      : source === 'Serithtial' ? '2d6 vs. worshippers of Zon-Kuthon'
        : source === 'Ridill' ? '1d6 vs. dragons'
          : source === "Ghosthand's Comet" ? '1d6 vs. beasts' : undefined
  if (conditional) return [{ source: String(source), value: conditional, note: 'Additional damage applies only against the specified targets. See Properties for full rules.' }]
  return []
}

export function namedWeaponAbilities(entry?: ContentEntry) {
  if (!entry?.data.named_weapon && !entry?.data.special_weapon_source) return []
  const source = String(entry.data.special_weapon_source ?? entry.data.named_weapon_source)
  const definitions = ACTIONS[source] ?? []
  const blocks = entry.description.split(/\n\n-{3,}\s*\n\n/)
  const statBlock = blocks.length > 2 && /^Perception\b/.test(blocks[1].trim()) ? blocks[1] : ''
  const body = (statBlock ? blocks.slice(2).join('\n\n') : blocks.length > 1 ? blocks.slice(1).join('\n\n') : blocks[0])
    .replace(/^(?:Custom weapon version|Base weapon):[^\n]*\n\n/, '')
    .replace(/(?:^|\n\n)Nethys Note:[^\n]*(?=\n\n|$)/g, '')
    .replace(/(?:^|\n\n)-{3,}(?=\n\n|$)/g, '')
  const costs = String(entry.data.artifact_activation_actions ?? '').split(';')
  const starts = [...body.matchAll(/(?:^|\n\n)(Activate|Destruction)\b/g)]
  const paragraphs = (text: string) => text.replace(/\b(Critical Success|Success|Critical Failure|Failure)\b/g, '\n\n$1')
    .split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean)
  const abilities = starts.map((match, index) => {
    const section = body.slice(match.index + match[0].length, starts[index + 1]?.index).trim()
    const named = /^[\u2014\u2013-]\s*(.+?)(?=\s+\(|\s*;|\s+(?:Cast a Spell|Frequency|Requirements|Trigger|Effect)\b)/.exec(section)
    const definition = named ? definitions.find(definition => definition.name === named[1].trim()) : definitions[index]
    return {
      name: match[1] === 'Destruction' ? 'Destruction' : named?.[1].trim() ?? definition?.name ?? `Activation ${index + 1}`,
      actions: match[1] === 'Destruction' ? undefined : costs[index] || definition?.actions,
      paragraphs: paragraphs(named ? section.slice(named[0].length) : section),
    }
  })
  const summary = paragraphs(body.slice(0, starts[0]?.index))
  if (summary.length) abilities.unshift({ name: 'Summary', actions: undefined, paragraphs: summary })
  const senses = paragraphs(statBlock)
  if (senses.length) abilities.unshift({ name: 'Senses', actions: undefined, paragraphs: senses })
  const rank = (name: string) => name === 'Senses' ? 0 : name === 'Summary' ? 1 : name === 'Destruction' ? 3 : 2
  return abilities.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
}

export function namedWeaponStrikeNote(entry?: ContentEntry) {
  const source = entry?.data.named_weapon_source ?? entry?.data.special_weapon_source
  if (source === 'Debilitating Dart') return 'A creature struck and damaged takes a -2 status penalty to its next saving throw against a magical effect within 1 round, then becomes immune to this effect for 24 hours. Track the target\'s penalty and immunity manually.'
  const paragraphs = namedWeaponAbilities(entry).find(ability => ability.name === 'Summary')?.paragraphs ?? []
  const effects = paragraphs.filter(paragraph => /\b(?:on (?:a |an |a critical )?(?:hit|critical hit)|(?:a |the )?(?:creature|target) (?:struck|hit)|(?:when|whenever) [^.]*\b(?:hits?|strikes?)\b|(?:strikes?|critical hits?) (?:with [^.]*? )?(?:deal|deals|cause|causes|inflict|inflicts))\b/i.test(paragraph))
  return effects.length ? effects.join(' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`]/g, '') : undefined
}
