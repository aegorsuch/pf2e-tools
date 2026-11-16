import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { effectiveWeapon, gearPickerEntries, isMagicItem, weaponAttack, weaponEntry } from './builder'
import { WeaponList } from './GearSection'
import { mapAonHit } from './aon'
import { wintershotActivations } from './namedBows'
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
  traits: ['Magical', 'Unique'], description: [
    'Base Weapon Composite Shortbow. This +2 greater striking frost composite shortbow ignores mist and precipitation.',
    'Activate\u2014Auroral Shine (cold, concentrate, light, primal) Frequency once per 10 minutes; Effect DC 34 Fortitude.',
    'Critical Success Unaffected. Success Dazzled for 2 rounds. Failure 2d6 persistent cold damage. Critical Failure 4d6 persistent cold damage.',
    'Activate\u2014Signal Flare (light, manipulate, primal) Frequency once per day; Effect Counteract rank 7 with a +26 modifier.',
  ].join('\n\n'),
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
    const activations = [...markup.matchAll(/<details>([\s\S]*?)<\/details>/g)].map(match => match[1])
    expect(activations).toHaveLength(2)
    expect(activations[0]).toContain('<summary>Auroral Shine ')
    expect(activations[0]).toContain('aria-label="Single Action"')
    expect(activations[0]).toContain('once per 10 minutes')
    expect(activations[0]).toContain('DC 34 Fortitude')
    expect(activations[0]).toContain('<p>Critical Success Unaffected.</p>')
    expect(activations[0]).not.toContain('Signal Flare')
    expect(activations[1]).toContain('once per day')
    expect(activations[1]).toContain('Counteract rank 7')
    expect(markup).not.toContain('Wintershot activation details unavailable.')
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

it.each(['Shortbow', 'Longbow'])('shows all artifact activations and outcomes for %s without using standard-bow rules', type => {
  const artifact = mapAonHit({ _id: 'artifact', _source: {
    name: 'Wintershot (Artifact)', category: 'equipment', level: 20,
    markdown: [
      'Wintershot is a +3 major striking greater frost holy composite shortbow.',
      '**Activate\u2014Auroral Shine** <actions string="Single Action" /> (cold, concentrate, light) **Frequency** once per minute; **Effect** Wintershot can\u2019t use this activation. Fire an arrow; on a hit, attempt a DC 43 Fortitude save instead of damage.',
      '**Critical Success** Unaffected.<br /> **Success** Dazzled for 2 rounds; invisible becomes concealed.<br /> **Failure** 6d6 persistent cold damage; lights last 1 minute.<br /> **Critical Failure** 6d6 persistent cold damage; lights last 10 minutes.',
      '**Activate\u2014Signal Flare** <actions string="Single Action" /> (light, manipulate) **Frequency** once per hour; **Effect** Wintershot fires a beacon 500 feet upward. Counteract rank 9 with a +25 modifier (+30 against a fiend\u2019s darkness).',
      '**Activate\u2014Rimecrust** <actions string="Two Actions" /> (cold, concentrate, incapacitation) **Effect** One creature within 30 feet attempts a DC 43 Fortitude save, then becomes temporarily immune for 24 hours.',
      '**Critical Success** Unaffected.<br /> **Success** Off-guard until its next turn; cold immunity applies.<br /> **Failure** Slowed 1 and off-guard for 1 minute, or until it Escapes (DC 43).<br /> **Critical Failure** Slowed 1 and restrained until it Escapes (DC 43), then slowed 1 and off-guard for 1 minute.',
      '_Nethys Note: unrelated reference._',
    ].join('\n\n'),
  } }, 'pf2e')!
  const entries = [...catalog, artifact]
  const name = `Wintershot (Artifact) (${type})`
  const parsed = wintershotActivations(weaponEntry(entries, name))
  expect(parsed.map(activation => activation.name)).toEqual(['Auroral Shine', 'Signal Flare', 'Rimecrust'])
  expect(parsed[0].paragraphs).toHaveLength(5)
  expect(parsed[2].paragraphs).toHaveLength(5)
  for (const displayOnly of [false, true]) {
    const markup = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [owned(name)] }}
      entries={entries} save={() => {}} displayOnly={displayOnly} />)
    const activations = [...markup.matchAll(/<details>([\s\S]*?)<\/details>/g)].map(match => match[1])
    expect(activations).toHaveLength(3)
    expect(activations[0]).toContain('once per minute')
    expect(activations[0]).toContain('DC 43 Fortitude')
    expect(activations[0]).toContain('Wintershot can\u2019t use this activation')
    expect(activations[0]).toContain('<p>Failure 6d6 persistent cold damage; lights last 1 minute.</p>')
    expect(activations[0]).toContain('<p>Critical Failure 6d6 persistent cold damage; lights last 10 minutes.</p>')
    expect(activations[1]).toContain('once per hour')
    expect(activations[1]).toContain('Counteract rank 9')
    expect(activations[1]).toContain('+25 modifier (+30')
    expect(activations[2]).toContain('aria-label="Two Actions"')
    expect(activations[2]).toContain('temporarily immune for 24 hours')
    expect(activations[2]).toContain('Escapes (DC 43)')
    expect(activations[2]).toContain('restrained')
    expect(activations.join('')).not.toMatch(/Nethys Note|DC 34|once per 10 minutes|rank 7/)
  }
})

it('reports missing Wintershot activation text instead of silently hiding its abilities', () => {
  const incomplete = { ...winter, description: 'Base Weapon Composite Shortbow. A +2 greater striking frost composite shortbow.' }
  const markup = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [owned(winter.name)] }}
    entries={catalog.map(entry => entry.id === winter.id ? incomplete : entry)} save={() => {}} displayOnly />)
  expect(markup).toContain('Wintershot activation details unavailable. Sync content or open its item description.')
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
