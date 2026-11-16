import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { effectiveWeapon, gearPickerEntries, isMagicItem, weaponAttack, weaponEntry } from './builder'
import { WeaponList } from './GearSection'
import type { Character, ContentEntry, OwnedWeapon } from './types'

const bow = (name: string, long: boolean, composite = true): ContentEntry => ({
  id: name, systems: ['pf2e'], kind: 'weapon', source: 'official', name, level: 0,
  traits: ['Deadly d10', ...(long ? ['Volley 30 ft.'] : []), ...(composite ? ['Propulsive'] : [])],
  description: '', data: { damage: `1d${long ? 8 : 6} piercing`, range: long ? 100 : 60,
    weapon_type: 'Ranged', weapon_category: 'Martial', weapon_group: 'Bow', hands: '1+', bulk: long ? 2 : 1 },
  effects: [], updatedAt: 0,
})
const winter: ContentEntry = {
  id: 'wintershot', systems: ['pf2e'], kind: 'item', source: 'official', name: 'Wintershot', level: 15,
  traits: ['Magical', 'Unique'], description: 'Base Weapon Composite Shortbow. This +2 greater striking frost composite shortbow ignores mist and precipitation. Auroral Shine: DC 34 Fortitude. Signal Flare: once per day.',
  data: { item_subcategory: 'Specific Magic Weapons', rarity: 'unique', url: 'https://2e.aonprd.com/Equipment.aspx?ID=3702' },
  effects: [], updatedAt: 0,
}
const rune = (name: string): ContentEntry => ({ ...winter, id: name, name,
  data: { item_subcategory: 'Weapon Property Runes' }, description: '' })
const catalog = [bow('Composite Shortbow', false), bow('Composite Longbow', true), winter,
  rune('Frost'), rune('Greater Frost'), rune('Holy'), rune('Thundering'), rune('Greater Thundering')]
const c: Character = {
  id: 'c', systems: ['pf2e'], name: 'Bow test', level: 1, className: 'Fighter',
  abilities: { str: 14, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const owned = (name: string): OwnedWeapon => ({ id: 'bow', name, potency: 0, striking: 0, runes: [] })

it('offers explicit shortbow and longbow versions with inherited composite traits and unchanged original records', () => {
  const choices = gearPickerEntries(catalog, 'weapon').filter(entry => entry.data.named_bow)
  expect(choices.map(entry => entry.name)).toEqual(['Wintershot (Shortbow)', 'Wintershot (Longbow)'])
  const short = weaponAttack(c, catalog, owned(choices[0].name))
  const long = weaponAttack(c, catalog, owned(choices[1].name))
  expect(short.range).toBe(60)
  expect(long.range).toBe(100)
  expect(short.damage).toBe('3d6+1 piercing')
  expect(long.damage).toBe('3d8+1 piercing')
  expect(short.traits).toContain('Propulsive')
  expect(long.traits).toContain('Propulsive')
  expect(short.traits.some(trait => /volley/i.test(trait))).toBe(false)
  expect(long.traits).toContain('Volley 30 ft.')
  expect(choices.every(isMagicItem)).toBe(true)
  expect(choices[0].source).toBe('official')
  expect(choices[1].source).toBe('homebrew')
  expect(winter.kind).toBe('item')
  expect(catalog[0].traits).toEqual(['Deadly d10', 'Propulsive'])
  expect(weaponAttack(c, catalog, JSON.parse(JSON.stringify(owned('Wintershot')))).damage).toBe(short.damage)
})

it('applies Wintershot fundamental and Frost runes, preserves upgrades, and shows its manual activations in both views', () => {
  const weapon = owned('Wintershot (Longbow)')
  expect(effectiveWeapon(c, catalog, weapon)).toMatchObject({ potency: 2, striking: 2, runes: ['Frost'] })
  expect(effectiveWeapon(c, catalog, { ...weapon, potency: 3, striking: 3, runes: ['Frost', 'Holy'] }))
    .toMatchObject({ potency: 3, striking: 3, runes: ['Frost', 'Holy'] })
  for (const displayOnly of [false, true]) {
    const markup = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [weapon] }} entries={catalog} save={() => {}} displayOnly={displayOnly} />)
    expect(markup).toContain('1d6 cold')
    expect(markup).toContain('Auroral Shine: DC 34 Fortitude')
    expect(markup).toContain('Ignores concealment from mist or precipitation')
    expect(markup).toContain('up to -2')
    expect(markup).toContain('Activations are tracked manually')
    expect(markup).toContain('1 (hold)')
    expect(markup).toContain('2 (shoot)')
    if (!displayOnly) {
      expect(markup).toContain('Built into Wintershot')
      expect(markup).not.toContain('aria-label="Remove Frost"')
    }
  }
  expect(weapon.runes).toEqual([])
})

it('keeps the artifact version distinct with +3 major striking, Greater Frost and Holy', () => {
  const artifact = { ...winter, name: 'Wintershot (Artifact)', id: 'wintershot-artifact', level: 20,
    data: { ...winter.data, item_subcategory: '', item_category: 'Artifacts' },
    description: 'Wintershot is a +3 major striking greater frost holy composite shortbow. Auroral Shine requires DC 43 Fortitude.' }
  const entries = [...catalog, artifact]
  expect(effectiveWeapon(c, entries, owned('Wintershot (Artifact) (Shortbow)')))
    .toMatchObject({ potency: 3, striking: 3, runes: ['Frost (Greater)', 'Holy'] })
  expect(weaponAttack(c, entries, owned('Wintershot (Artifact) (Longbow)')).damage).toBe('4d8+1 piercing')
  expect(weaponEntry(entries, 'Wintershot (Artifact)')?.level).toBe(20)
})

it('uses each named tier rather than applying the stronger family version to every bow', () => {
  const description = 'Base Weapon Composite Shortbow. A +2 greater striking thundering composite shortbow.\n\nSinging Shortbow\n\nPrice 4500 gp.\n\nGreater Singing Shortbow\n\nThe weapon is a +3 greater striking greater thundering composite shortbow.'
  const base = { ...winter, name: 'Singing Shortbow', id: 'singing', description }
  const greater = { ...base, name: 'Greater Singing Shortbow', id: 'singing-greater', level: 18 }
  const entries = [...catalog, base, greater]
  expect(effectiveWeapon(c, entries, owned('Singing Shortbow (Shortbow)')))
    .toMatchObject({ potency: 2, striking: 2, runes: ['Thundering'] })
  expect(effectiveWeapon(c, entries, owned('Greater Singing Shortbow (Longbow)')))
    .toMatchObject({ potency: 3, striking: 2, runes: ['Thundering (Greater)'] })
})

it('does not make crossbow variants or add Propulsive to non-composite bows', () => {
  const hunter = { ...winter, name: "Hunter's Bow", id: 'hunter',
    description: 'Base Weapon Shortbow. A +1 magic shortbow.' }
  const crossbow = { ...hunter, name: 'Tidal Crossbow', id: 'crossbow', description: 'Base Weapon Crossbow. A +2 striking crossbow.' }
  const entries = [...catalog, bow('Shortbow', false, false), bow('Longbow', true, false), hunter, crossbow]
  const variant = weaponEntry(entries, "Hunter's Bow (Longbow)")
  expect(variant?.traits).not.toContain('Propulsive')
  expect(effectiveWeapon(c, entries, owned("Hunter's Bow (Longbow)"))).toMatchObject({ potency: 1, striking: 0 })
  expect(gearPickerEntries(entries, 'weapon').some(entry => entry.name.startsWith('Tidal Crossbow'))).toBe(false)
})

it('applies Erastil moderate boon to longbow variants and saved native magic longbows', () => {
  const native = { ...winter, id: 'native-longbow', name: "Hunter's Anthem",
    description: 'Base Weapon Composite Longbow. A +2 greater striking composite longbow.' }
  const entries = [...catalog, native]
  const blessed = { ...c, deity: 'Erastil', divineIntercessions: { Erastil: ['moderate-boon'] } }
  for (const name of ['Wintershot (Longbow)', native.name]) {
    const attack = weaponAttack(blessed, entries, owned(name))
    expect(attack.range).toBe(200)
    expect(attack.traits).toContain('Volley (if beneficial)')
    expect(attack.traits).not.toContain('Volley 30 ft.')
  }
  expect(weaponAttack(blessed, entries, owned('Wintershot (Shortbow)')).range).toBe(60)
})

it('reports missing fixed rune data in both views instead of silently omitting its effects', () => {
  const entries = catalog.filter(entry => entry.name !== 'Frost')
  for (const displayOnly of [false, true]) {
    const markup = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [owned('Wintershot')] }}
      entries={entries} save={() => {}} displayOnly={displayOnly} />)
    expect(markup).toContain('Named bow enhancement details unavailable.')
  }
})
