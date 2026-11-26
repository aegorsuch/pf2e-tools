import type { Character, ContentEntry } from './types'
import { activeFeatsNamed, armorEntry, automaticSpecificArmorUpgrades, ownedArmors, ownedShields, runeName, shieldEntry, weaponAttack, weaponEntry } from './builder'
import { withNamedWeaponState } from './namedWeapons'
import { limitedSpellUses } from './featSpells'
import { getSettings } from './settings'
import { isHighhelmPlate } from './namedArmor'

export interface ItemSpell {
  source: ContentEntry
  usageKey: string
  name: string
  entry?: ContentEntry
  rank: number
  actions?: string
  frequency?: string
  condition?: string
  note?: string
  dc?: number
  attackBonus?: number
  usesSpellcasting: boolean
  augmentationUses?: { id: string; baseLimit: number }
}

function savedItemSpellUses(c: Character, spell: ItemSpell) {
  const saved = c.itemSpellUses?.[spell.usageKey]
  if (saved || !spell.augmentationUses) return saved
  const { id, baseLimit } = spell.augmentationUses
  return [...(c.augmentationDailyUses?.[id] ? [0] : []),
    ...(c.augmentationExtraDailyUses?.[id] ? [baseLimit] : [])]
}

export function itemSpellUses(c: Character, spell: ItemSpell) {
  const saved = savedItemSpellUses(c, spell)
  const limit = limitedSpellUses(spell.frequency)?.limit
  const uses = limitedSpellUses(spell.frequency, spell.augmentationUses && limit !== undefined
    ? saved?.filter(index => index < limit) : saved)
  return uses && { key: spell.usageKey, ...uses }
}

export function itemSpellUsesChange(c: Character, spell: ItemSpell, spent: number[]) {
  const limit = limitedSpellUses(spell.frequency)?.limit
  const hidden = spell.augmentationUses && limit !== undefined
    ? (savedItemSpellUses(c, spell) ?? []).filter(index => index >= limit) : []
  return { itemSpellUses: { ...c.itemSpellUses, [spell.usageKey]: [...spent, ...hidden] } }
}

export const presenceIntensifierUsageKey = (id: string) => JSON.stringify([id, 'presence-intensifier', 'suggestion'])
export const cloakingSkinUsageKey = (id: string) => JSON.stringify([id, 'cloaking-skin', 'invisibility'])

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const normalized = (text: string) => text.replace(/[\u2018\u2019]/g, "'").toLowerCase()
const aliases: Record<string, string> = {
  barkskin: 'oaken resilience', 'disguise self': 'illusory disguise', 'searing light': 'holy light',
  'dimension door': 'translocate', 'pass without trace': 'vanishing tracks', regeneration: 'regenerate',
}
const catalogs = new WeakMap<ContentEntry[], { names: RegExp; spells: Map<string, ContentEntry[]> }>()
function catalog(entries: ContentEntry[]) {
  let result = catalogs.get(entries)
  if (!result) {
    const spells = new Map<string, ContentEntry[]>()
    for (const entry of entries) if (entry.kind === 'spell' && !entry.deleted) {
      const name = normalized(entry.name)
      spells.set(name, [...spells.get(name) ?? [], entry])
    }
    const names = [...new Set([...spells.keys(), ...Object.keys(aliases)])].sort((a, b) => b.length - a.length)
    result = { names: new RegExp(`\\b(?:${names.map(escape).join('|')})\\b`, 'gi'), spells }
    catalogs.set(entries, result)
  }
  return result
}

function itemRules(source: ContentEntry, staff: boolean) {
  const text = source.description.replace(/[\u2018\u2019]/g, "'")
  const family = source.name.replace(/[\u2018\u2019]/g, "'").replace(/\s+\([^)]*\)$/, '')
  const headers = [...text.matchAll(new RegExp(`(?:^|\\n\\n)(${escape(family)}(?: \\([^\\n]+\\))?)(?=\\n\\n|$)`, 'gi'))]
    .filter(match => match.index > 0)
  const selected = headers.findIndex(match => normalized(match[1]) === normalized(source.name))
  if (!headers.length || selected < 0) return text
  const common = text.slice(0, headers[0].index)
  const section = (index: number) => text.slice(headers[index].index, headers[index + 1]?.index)
  return [common, ...(staff ? headers.slice(0, selected + 1).map((_, index) => section(index)) : [section(selected)])].join('\n\n')
}

const rankIn = (text: string) => {
  const rank = /\brank\s+(\d+)\b|\b(\d+)(?:st|nd|rd|th)[- ](?:rank|level)\b|\b(\d+)(?:st|nd|rd|th)\s+rank\b/i.exec(text)
  return rank ? Number(rank[1] ?? rank[2] ?? rank[3]) : undefined
}

export function itemSpells(c: Character, entries: ContentEntry[]): ItemSpell[] {
  if (!c.equipment.some(item => item.qty > 0) && !c.weapons?.length && !c.armors?.length && !c.shield && !c.augmentations?.length) return []
  const minimumRank = getSettings().innateAutoHeighten ? Math.ceil(c.level / 2) : 0
  const index = catalog(entries)
  const eligible = (entry?: ContentEntry): entry is ContentEntry => !!entry && !entry.deleted
    && entry.systems.some(system => c.systems.includes(system))
  const sources = new Map<string, ContentEntry>()
  const automaticArmorSources = new Map<string, string>()
  const add = (entry?: ContentEntry) => { if (eligible(entry) && !sources.has(entry.id)) sources.set(entry.id, entry) }
  const addRunes = (runes: string[]) => {
    for (const name of runes) add(entries.find(entry => entry.kind === 'item' && entry.name === runeName(name) && eligible(entry)))
  }
  const weapons = c.weapons ?? c.equipment.filter(item => item.qty > 0).flatMap(item => {
    const entry = weaponEntry(entries, item.name)
    return entry ? [{ id: `eq-${item.name}`, name: item.name, potency: 0, striking: 0, runes: [] }] : []
  })
  for (const weapon of weapons) {
    add(withNamedWeaponState(weaponEntry(entries, weapon.name), weapon, c.level))
    addRunes(weapon.runes)
  }
  for (const armor of ownedArmors(c, entries)) if (armor.worn || isHighhelmPlate(armor.name) && armor.strongholdWallActive) {
    const armorItem = armorEntry(c, entries, armor.name, armor.id)
    add(armorItem)
    if (armor.worn) for (const upgrade of automaticSpecificArmorUpgrades(c, entries, armorItem)) {
      add(upgrade)
      automaticArmorSources.set(upgrade.id, armor.id)
    }
    addRunes(armor.runes)
  }
  for (const shield of ownedShields(c)) add(shieldEntry(entries, shield.name))
  for (const item of c.equipment) if (item.qty > 0) {
    if (weaponEntry(entries, item.name) || armorEntry(c, entries, item.name)) continue
    add(entries.find(entry => entry.kind === 'item' && entry.name === item.name && eligible(entry)))
  }
  const out: ItemSpell[] = []
  for (const source of sources.values()) {
    const staff = source.traits.some(trait => /^staff$/i.test(trait)) || source.data.item_category === 'Staves'
    const text = itemRules(source, staff)
    const costOverride = /\bactivation is a ([123])-action/i.exec(text)?.[1]
    const actionCosts = String(source.data.artifact_activation_actions ?? source.data.item_activation_actions ?? '').split(';')
    const atWill = /activate it any number of times per day/i.test(text)
    const bladeOwner = source.data.named_weapon_source === 'Blade of the Black Sovereign'
      ? c.weapons?.find(weapon => weaponEntry(entries, weapon.name, weapon.id)?.id === source.id) : undefined
    const bladeAttack = bladeOwner ? weaponAttack(c, entries, bladeOwner).attack : undefined
    const addSpell = (name: string, rank?: number, details: Partial<ItemSpell> = {}) => {
      const key = normalized(name)
      const candidates = [...index.spells.get(key) ?? [], ...index.spells.get(aliases[key]) ?? []].filter(eligible)
      const entry = candidates.find(entry => entry.systems.some(system => source.systems.includes(system))) ?? candidates[0]
      const gradeRank = new RegExp(`${escape(name)}(?: spell)? is (\\d+)(?:st|nd|rd|th)[- ]rank`, 'i').exec(text)?.[1]
      const cantrip = entry?.traits.some(trait => /^cantrip$/i.test(trait))
      const itemRank = gradeRank ? Number(gradeRank) : rank === 0 || rank === undefined && cantrip ? Math.ceil(c.level / 2) : rank ?? entry?.level ?? 1
      out.push({ source, name: entry?.name ?? name, entry,
        usageKey: JSON.stringify([source.id, 'spell', normalized(entry?.name ?? name)]),
        rank: Math.max(minimumRank, itemRank),
        usesSpellcasting: staff || source.traits.some(trait => /^(?:wand|scroll|spellheart)$/i.test(trait))
          || /(?:your|wielder's) spell (?:DC|attack)|your spellcasting/i.test(text),
        ...details,
        ...(bladeAttack !== undefined ? { attackBonus: bladeAttack, dc: 10 + bladeAttack, usesSpellcasting: false } : {}),
        ...(atWill ? { frequency: 'At will' } : {}),
        ...(costOverride ? { actions: ['', 'Single Action', 'Two Actions', 'Three Actions'][Number(costOverride)] } : {}) })
    }
    if (isHighhelmPlate(source.name)) addSpell('Wall of Stone', undefined, { actions: 'Three Actions' })
    if (/^Cloaking Device(?: \((?:Commercial|Tactical)\))?$/i.test(source.name)) {
      addSpell('Invisibility', Math.max(2, Math.ceil(c.level / 2)), {
        actions: 'Single Action',
        frequency: /\(Tactical\)$/i.test(source.name) ? 'three times per day' : 'once per day',
        note: 'Invisible for 1 minute.',
        usageKey: JSON.stringify([automaticArmorSources.get(source.id) ?? source.id, 'cloaking-device', 'invisibility']),
      })
    }
    if (/^Programmer's Plushie \((?:Tactical|Advanced)\)$/i.test(source.name)) {
      const lock = /\block spell is (\d+)(?:st|nd|rd|th) rank \(DC (\d+)\)/i.exec(text)
      if (lock) addSpell('Lock', Number(lock[1]), { dc: Number(lock[2]) })
    }
    for (const rule of source.spellGrants ?? []) for (const name of rule.spells) addSpell(name,
      rule.heightened ? Math.ceil(c.level / 2) : rule.rank, { frequency: rule.frequency, condition: rule.condition,
        usageKey: JSON.stringify([source.id, 'grant', rule.spells.map(normalized).sort(), rule.shared || rule.choice ? 'shared' : normalized(name)]) })
    const blocks = text.split(/(?:^|\n\n)(?=Activate\b)/)
    let activation = 0
    for (const block of blocks) {
      const activated = /^Activate\b/.test(block)
      const action = activated ? actionCosts[activation++] || /\b(?:Single Action|One Action|Two Actions|Three Actions|Free Action|Reaction|\d+ minutes?)\b/i.exec(block.split(/\bEffect\b/)[0])?.[0] : undefined
      const body = block.split(/\bCraft Requirements\b|\bDestruction\b/)[0]
      const effect = /\bEffect\b/.exec(body)
      const content = effect ? body.slice(effect.index + effect[0].length) : body
      const frequency = /\bFrequency\s+([^;\n]+?)(?=\s+(?:Trigger|Requirements|Effect)\b|;|\n|$)/i.exec(body)?.[1]?.trim()
        ?? (/\bat[- ]will\b/i.test(content) ? 'At will' : undefined)
      const condition = [
        /\bRequirements\s+([^;\n]+)(?:;|\n|$)/i.exec(body)?.[1],
        /\bTrigger\s+([^;\n]+)(?:;|\n|$)/i.exec(body)?.[1],
      ].filter(Boolean).join('; ') || undefined
      const dc = /\bDC\s+(\d+)\b/i.exec(content)?.[1]
      for (const cast of content.matchAll(/\bcast(?:s|ing)?\s+([^.!?\n]+)/gi)) {
        const prefix = content.slice(0, cast.index).split(/[.!?\n]/).at(-1) ?? ''
        if (/\b(?:cannot|can't|must|as if|as though)\b/i.test(prefix)
          || /\b(?:when|whenever|after|before)(?:\s+you|\s+they|\s+the wielder)?\s*$/i.test(prefix)
          || !activated && /\b(?:when|whenever|anytime|any time|after|before|have|had)\b/i.test(prefix)) continue
        let previous = 0
        for (const match of cast[1].matchAll(index.names)) {
          const between = cast[1].slice(previous, match.index).trim()
          if (previous ? !/^(?:,?\s*(?:and|or)?\s*)$/i.test(between)
            : !/^(?:(?:a|an|the|rank|level|heightened|version|of)\s+|\d+(?:st|nd|rd|th)?(?:[- ](?:rank|level))?\s*)*$/i.test(between)) break
          addSpell(match[0], rankIn(between) ?? rankIn(cast[1].slice(match.index + match[0].length)), {
            actions: action, frequency, condition, ...(dc ? { dc: Number(dc) } : {}),
            usageKey: JSON.stringify([source.id, activated ? 'activation' : 'description', activation]),
          })
          previous = match.index + match[0].length
        }
      }
    }
    if (source.data.named_weapon_source === 'Blade of the Black Sovereign' && !out.some(spell => spell.source.id === source.id && normalized(spell.name) === 'electric arc'))
      addSpell('Electric Arc', 8, { actions: 'Two Actions', usageKey: JSON.stringify([source.id, 'activation', 1]) })
    if (staff) for (const list of text.matchAll(/\b(Cantrip|\d+(?:st|nd|rd|th))\s+(.+?)(?=\b(?:Cantrip|\d+(?:st|nd|rd|th))\s+|\n|$)/gi)) {
      if (!/^(?:Source|Price|Bulk)\b/.test(list[2])) for (const match of list[2].matchAll(index.names)) {
        addSpell(match[0], /^cantrip$/i.test(list[1]) ? 0 : parseInt(list[1]), { frequency: 'Staff charges' })
      }
    }
  }
  if (c.systems.includes('sf2e')) for (const augmentation of c.augmentations ?? []) {
    if (/^Cloaking Skin(?: \((Commercial|Tactical|Advanced)\))?$/i.test(augmentation.name)) {
      const source = entries.find(entry => entry.id === augmentation.entryId && entry.name === augmentation.name
        && entry.kind === 'item' && eligible(entry))
      if (!source) continue
      const advanced = /\(Advanced\)$/i.test(source.name)
      const baseLimit = /\((Tactical|Advanced)\)$/i.test(source.name) ? 3 : 1
      const tuned = activeFeatsNamed(c, 'Finely Tuned').some(feat => feat.choice === augmentation.name)
      const count = baseLimit + Number(tuned)
      const frequency = ['once per day', 'twice per day', 'three times per day', 'four times per day'][count - 1]
      const spell = index.spells.get('invisibility')?.find(entry => eligible(entry) && entry.systems.includes('sf2e'))
      out.push({ source, name: spell?.name ?? 'Invisibility', entry: spell,
        usageKey: cloakingSkinUsageKey(augmentation.id), augmentationUses: { id: augmentation.id, baseLimit },
        rank: Math.max(minimumRank, advanced ? 4 : 2), actions: 'Single Action', frequency, usesSpellcasting: false })
      continue
    }
    if (augmentation.name !== 'Presence Intensifier') continue
    const source = entries.find(entry => entry.id === augmentation.entryId && entry.name === augmentation.name
      && entry.kind === 'item' && eligible(entry))
    if (!source) continue
    const houseRule = getSettings().presenceIntensifierDaily
    const tuned = houseRule && activeFeatsNamed(c, 'Finely Tuned').some(feat => feat.choice === augmentation.name)
    const spell = index.spells.get('suggestion')?.find(entry => eligible(entry) && entry.systems.includes('sf2e'))
    out.push({ source, name: spell?.name ?? 'Suggestion', entry: spell,
      usageKey: presenceIntensifierUsageKey(augmentation.id),
      rank: Math.min(10, Math.max(4, houseRule ? Math.ceil(c.level / 2) : minimumRank)),
      actions: 'Two Actions', frequency: houseRule ? tuned ? 'twice per day' : 'once per day' : 'once per hour',
      dc: 38, usesSpellcasting: false })
  }
  const unique = new Map<string, ItemSpell>()
  for (const spell of out) unique.set(JSON.stringify([spell.usageKey, spell.name, spell.rank, spell.frequency, spell.actions, spell.condition]), spell)
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name) || a.source.name.localeCompare(b.source.name) || a.rank - b.rank)
}
