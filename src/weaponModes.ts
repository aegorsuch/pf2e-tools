import type { ContentEntry, OwnedWeapon, WeaponMode } from './types.ts'

export function isWeaponMode(value: unknown): value is WeaponMode {
  return !!value && typeof value === 'object' && 'id' in value && typeof value.id === 'string'
    && 'damageType' in value && typeof value.damageType === 'string'
    && 'traits' in value && Array.isArray(value.traits) && value.traits.every(trait => typeof trait === 'string')
}

export function parseWeaponModes(markdown: string): WeaponMode[] {
  const types: Record<string, string> = {
    A: 'acid', B: 'bludgeoning', C: 'cold', E: 'electricity', F: 'fire', P: 'piercing',
    S: 'slashing', SO: 'sonic', V: 'void', VI: 'vitality', SP: 'spirit',
  }
  return [...markdown.matchAll(/<title\b[^>]*>\s*Mode\s+(\d+)\s*<\/title>([\s\S]*?)(?=<title\b|$)/gi)].flatMap(match => {
    const type = /\*\*Damage\*\*\s*\d+d\d+\s+([A-Za-z]+)/i.exec(match[2])?.[1]?.toUpperCase()
    const traits = /<traits\b[^>]*>([\s\S]*?)<\/traits>/i.exec(match[2])?.[1]
    if (!type || !types[type] || !traits) return []
    return [{ id: `mode-${match[1]}`, damageType: types[type],
      traits: [...traits.matchAll(/<trait\b[^>]*\blabel="([^"]+)"/gi)].map(trait => trait[1].replace(/\b1d(\d+)/i, 'd$1')) }]
  })
}

export function weaponWithMode(weapon: OwnedWeapon, entry?: ContentEntry) {
  const modes = entry?.weaponModes
  if (!entry || !modes?.length) return entry
  const selected = modes.find(mode => mode.id === weapon.weaponMode) ?? modes[0]
  const key = (trait: string) => trait.toLowerCase().replace(/\s+(?:d\d+|\+\d+)$/, '')
  const conditional = new Set(modes.flatMap(mode => mode.traits).map(key)
    .filter(trait => !modes.every(mode => mode.traits.some(value => key(value) === trait))))
  const traits = entry.traits.filter(trait => !conditional.has(key(trait)))
  for (const trait of selected.traits) {
    if (!traits.some(value => key(value) === key(trait))) traits.push(trait)
  }
  return { ...entry, traits, data: { ...entry.data,
    damage: String(entry.data.damage ?? '').replace(/(\d+d\d+)\s*[A-Za-z]+/, `$1 ${selected.damageType}`),
    damage_type: selected.damageType,
  } }
}
