import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { expect, it, onTestFinished, vi } from 'vitest'
import { combinationForms, combinationName, effectiveWeapon, equippedHands, gearPickerEntries, isFavoredWeapon, isMagicItem, oakenResilience, resistances, savingThrowBreakdown, weaponAttack, weaponEntry, weaponEquipped, weaponHands } from './builder'
import { WeaponList } from './GearSection'
import { mapAonHit } from './aon'
import { makeNamedWeaponEntries, namedWeaponAbilities, namedWeaponBases, namedWeaponDamage, withNamedWeaponState } from './namedWeapons'
import { specificMagicItemName } from './equipmentGroups'
import { getSettings, updateSettings } from './settings'
import { SkillsSection } from './SkillsSection'
import { gearAccess } from './gearAccess'
import { HUNTERS_ARROWHEADS } from './supplemental'
import { hunterArrowheadBonus } from './builder'
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
const winterArtifact: ContentEntry = {
  ...winter, id: 'wintershot-artifact', name: 'Wintershot (Artifact)', level: 20,
  traits: [...winter.traits, 'Artifact'],
  data: { ...winter.data, item_subcategory: '', item_category: 'Artifacts', url: 'https://2e.aonprd.com/Equipment.aspx?ID=3703' },
  description: [
    'Base Weapon Composite Shortbow. This +3 major striking greater frost holy composite shortbow ignores mist and precipitation.',
    'Activate\u2014Auroral Shine (cold, concentrate, light, primal) Frequency once per minute; Effect DC 43 Fortitude.',
    'Critical Success Unaffected. Success Dazzled for 2 rounds. Failure 6d6 persistent cold damage. Critical Failure 6d6 persistent cold damage.',
    'Activate\u2014Signal Flare (light, manipulate, primal) Frequency once per hour; Effect Counteract rank 9 with a +25 modifier.',
    'Activate\u2014Rimecrust (cold, concentrate, incapacitation) Frequency once per day; Effect DC 43 Fortitude.',
  ].join('\n\n'),
}
const rune = (name: string): ContentEntry => ({ ...winter, id: name, name,
  data: { item_subcategory: 'Weapon Property Runes' }, description: '' })
const catalog = [bow('Composite Shortbow', false), bow('Composite Longbow', true), winterArtifact,
  rune('Frost'), rune('Greater Frost'), rune('Holy'), rune('Thundering'), rune('Greater Thundering'), rune('Astral')]
const c: Character = {
  id: 'c', systems: ['pf2e'], name: 'Bow test', level: 1, className: 'Fighter',
  abilities: { str: 14, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const owned = (name: string): OwnedWeapon => ({ id: 'bow', name, potency: 0, striking: 0, runes: [] })

it('implements Debilitating Dart as a returning dart with its conditional saving throw penalty', () => {
  const item = mapAonHit({ _id: 'equipment-5017', _source: {
    name: 'Debilitating Dart', category: 'equipment', level: 9, price: 65000, bulk: 0.1,
    item_subcategory: 'Specific Magic Weapons', trait: ['Magical'],
    markdown: '**Base Weapon** [Dart](/Weapons.aspx?ID=426)\n\n---\n\nForged from black steel, this _[+1 striking ](/Equipment.aspx?ID=2861) [returning ](/Equipment.aspx?ID=2845) [dart](/Weapons.aspx?ID=426)_ is etched with runes.',
  } }, 'pf2e')!
  const dart: ContentEntry = { ...bow('Dart', false, false), traits: ['Agile', 'Thrown'],
    data: { weapon_type: 'Ranged', weapon_category: 'Simple', weapon_group: 'Dart', hands: 1, range: 20, damage: '1d4 piercing' } }
  for (const entries of [[item, dart], [item, dart, rune('Returning')]]) {
    const choices = gearPickerEntries(entries, 'weapon').filter(entry => entry.name === item.name)
    expect(choices).toHaveLength(1)
    expect(choices[0]).toMatchObject({ level: 9, data: { price: 65000, named_weapon_base: 'Dart', named_weapon_rules_missing: false } })
    expect(effectiveWeapon(c, entries, owned(item.name))).toMatchObject({ potency: 1, striking: 1, material: 'Orichalcum', runes: ['Returning'] })
    expect(weaponAttack(c, entries, owned(item.name))).toMatchObject({ range: 20, damage: '2d4+2 piercing', item: 1 })
    const level19 = { ...c, level: 19 }
    const level20 = { ...c, level: 20 }
    expect(effectiveWeapon({ ...c, level: 9 }, entries, owned(item.name)).runes).toEqual(['Returning'])
    expect(effectiveWeapon({ ...c, level: 10 }, entries, owned(item.name)).runes).toEqual(['Returning', 'Cunning'])
    expect(effectiveWeapon(level19, entries, owned(item.name)).runes).toEqual(['Returning', 'Cunning'])
    expect(effectiveWeapon(level20, entries, owned(item.name))).toMatchObject({ material: 'Orichalcum', runes: ['Returning', 'Cunning', 'Impossible'] })
    expect(weaponAttack(level20, entries, owned(item.name)).range).toBe(40)
    expect(effectiveWeapon(level20, entries, { ...owned(item.name), runes: ['Cunning', 'Impossible'] }).runes).toEqual(['Returning', 'Cunning', 'Impossible'])
    for (const displayOnly of [false, true]) {
      const html = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [owned(item.name)] }} entries={entries} save={() => {}} displayOnly={displayOnly} />)
      expect(html).toContain('>Returning</button>')
      expect(html).toContain('>Thrown 20</button>')
      expect(html).toContain('-2 status penalty to its next saving throw against a magical effect within 1 round')
      expect(html).toContain('immune to this effect for 24 hours')
      expect(html).not.toContain('Named weapon enhancement details unavailable')
      expect(html).toMatch(/Damage 2d4\+2 P<button[^>]*aria-label="Debilitating Dart note"/)
      expect(html.match(/aria-label="Debilitating Dart note"/g)).toHaveLength(1)
      expect(html).not.toContain('<summary>Summary')
      const maxLevel = renderToStaticMarkup(<WeaponList c={{ ...level20, weapons: [owned(item.name)] }} entries={entries} save={() => {}} displayOnly={displayOnly} />)
      expect(maxLevel).toContain('>Impossible</button>')
      expect(maxLevel).toContain('>Cunning</button>')
      expect(maxLevel).not.toContain(' + Cunning')
      expect(maxLevel).toContain('>Thrown 40</button>')
      expect(maxLevel).not.toContain('>Orichalcum</button>')
    }
  }
  expect(gearPickerEntries([item], 'weapon').some(entry => entry.name === item.name)).toBe(false)
})

it('places passive strike effects beside damage and hides duplicate summaries', () => {
  const item: ContentEntry = { ...winter, id: 'hunter', name: 'Splithead Bow', description: [
    'Base Weapon Composite Longbow. A +1 magic composite longbow.',
    'A creature struck by this bow is dazzled for 1 round.',
    'Activate\u2014Dazzling Arrow (light) Frequency once per day; Effect Fire an arrow.',
  ].join('\n\n') }
  const entries = [item, bow('Composite Longbow', true)]
  for (const displayOnly of [false, true]) {
    const html = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [owned(item.name)] }} entries={entries} save={() => {}} displayOnly={displayOnly} />)
    expect(html).toMatch(/Damage 1d8\+1 P<button[^>]*aria-label="Splithead Bow note"/)
    expect(html).toContain('A creature struck by this bow is dazzled for 1 round.')
    expect(html).toContain('<summary>Dazzling Arrow ')
    expect(html).not.toContain('<summary>Summary')
  }
})

it.each([
  [1, 1, 1, 'Standard'], [10, 2, 1, 'Standard'], [12, 2, 2, 'Standard'],
  [16, 3, 2, 'Standard'], [18, 3, 2, 'High'], [19, 3, 3, 'High'],
] as const)("locks every Hunter's Dawn form to Peachwood and scales fundamentals at level %i", (level, potency, striking, grade) => {
  const item: ContentEntry = { ...winter, id: 'dawn', name: "Hunter's Dawn", level: 5,
   description: "Base Weapon Club. _Hunter's Dawn_ is a _+3 [greater striking](/Equipment.aspx?ID=280) [speed](/Equipment.aspx?ID=304) [ghost touch](/Equipment.aspx?ID=297) [club](/Weapons.aspx?ID=2)_. " }
  const bases: ContentEntry[] = ['Club', 'Dart', 'Javelin'].map(name => ({
    ...bow(name, false), data: { damage: '1d6 piercing', weapon_type: name === 'Club' ? 'Melee' : 'Ranged',
      weapon_category: 'Simple', hands: 1, range: name === 'Club' ? 0 : 20 },
  }))
  const entries = [item, ...bases]
  const options = gearPickerEntries(entries, 'weapon').filter(entry => entry.data.named_weapon_source === item.name)
  expect(options.map(entry => entry.data.named_weapon_base)).toEqual(['Club'])
  expect(namedWeaponBases(options[0])).toEqual(['Club', 'Dart', 'Javelin'])
  const forms = makeNamedWeaponEntries(entries, entries.filter(entry => entry.data.item_subcategory === 'Weapon Property Runes'))
    .filter(entry => entry.data.named_weapon_source === item.name && !entry.data.named_weapon_resolver_only)
  expect(forms).toHaveLength(3)
  expect(forms.find(entry => entry.data.named_weapon_base === 'Dart')?.data.range).toBe(40)
  for (const entry of forms) {
    const weapon: OwnedWeapon = { ...owned(entry.name), material: 'Orichalcum', runes: ['Flaming'] }
    const character = { ...c, level, weapons: [weapon] }
    const before = JSON.stringify(character)
    expect(effectiveWeapon(character, entries, weapon)).toMatchObject({
      material: `Peachwood (${grade}-Grade)`, potency: Math.max(potency, 3), striking: Math.max(striking, 2),
      runes: expect.arrayContaining(['Flaming']),
    })
    expect(effectiveWeapon(character, entries, weapon)?.runes).toContain('Astral')
    expect(effectiveWeapon(character, entries, weapon)?.runes).not.toContain('Quickstrike')
    const markup = renderToStaticMarkup(<WeaponList c={character} entries={entries} save={() => {}} />)
    expect(markup).toContain(`>Peachwood (${grade}-Grade)</button>`)
    expect(markup).not.toContain('aria-label="Weapon material"')
    expect(markup).not.toContain(`aria-label="Remove Peachwood (${grade}-Grade) material"`)
    expect(markup).not.toContain('<label>Potency')
    expect(markup).not.toContain('<label>Striking')
    expect(markup).not.toContain('aria-label="Fundamental runes"')
    expect(markup).toContain('[Astral](/Equipment.aspx?ID=2832)')
    expect(markup).not.toContain('[speed](/Equipment.aspx?ID=304)')
    expect(JSON.stringify(character)).toBe(before)
  }
})

it.each([
  ["Horselord's Longbow", 6, 25000, 2, '+1 striking', 1, [], 100],
  ['Splithead Bow', 7, 36000, 2, '+1 striking hauling', 1, ['Hauling'], 100],
  ["Hunter's Anthem", 11, 130000, 2, '+2 striking', 2, [], 100],
  ['Mammoth Bow', 12, 200000, 4, '+2 striking', 2, [], 180],
] as const)('implements %s among the four composite longbows without changing its price or magic', (name, level, price, bulk, magic, potency, runes, range) => {
  const item = mapAonHit({ _id: name, _source: {
    name, category: 'equipment', level, price, bulk, item_subcategory: 'Specific Magic Weapons',
    markdown: `**Base Weapon** [${name === 'Mammoth Bow' ? 'Composite Longbow' : 'Longbow'}](/Weapons.aspx?ID=1)\n\nA ${magic} longbow.`,
  } }, 'pf2e')!
  const entries = [...catalog, bow('Longbow', true, false), item, rune('Hauling')]
  const choices = gearPickerEntries(entries, 'weapon').filter(entry => entry.data.named_weapon_source === name)
  expect(choices).toHaveLength(1)
  expect(choices[0]).toMatchObject({ name, level, data: { price, bulk, named_weapon_base: 'Composite Longbow' } })
  expect(choices[0].traits).toContain('Propulsive')
  expect(weaponAttack(c, entries, owned(name))).toMatchObject({ damage: '2d8+1 piercing', range })
  expect(effectiveWeapon(c, entries, owned(name))).toMatchObject({ potency, striking: 1, runes: [...runes] })
  if (name === 'Mammoth Bow') {
    const attack = weaponAttack(c, entries, owned(name))
    expect(attack.traits).toContain('Volley 50 ft.')
    expect(attack.traits).not.toContain('Volley 30 ft.')
    expect(attack.additionalDamage).toContainEqual(expect.objectContaining({ value: '2d6 piercing' }))
  }
})

it('keeps specific bow activation costs and conditional damage rather than granting blanket bonuses', () => {
  const anthem = mapAonHit({ _id: 'anthem', _source: {
    name: "Hunter's Anthem", category: 'equipment', item_subcategory: 'Specific Magic Weapons',
    markdown: '**Base Weapon** [Longbow](/Weapons.aspx?ID=1)\n\nA +2 striking longbow.\n\n'
      + '**Activate\u2014Song of the Bow** <actions string="Two Actions" /> **Frequency** once per day; **Effect** DC 28 basic Fortitude save.',
  } }, 'pf2e')!
  const entries = [...catalog, anthem]
  const attack = weaponAttack(c, entries, owned(anthem.name))
  expect(attack.additionalDamage).toContainEqual(expect.objectContaining({ value: '1d6 sonic vs. hunted prey' }))
  expect(effectiveWeapon(c, entries, owned(anthem.name)).runes).not.toContain('Thundering')
  expect(namedWeaponAbilities(weaponEntry(entries, anthem.name)))
    .toContainEqual(expect.objectContaining({ name: 'Song of the Bow', actions: 'Two Actions' }))
})

it('offers only artifact Wintershot as a composite longbow and suppresses non-artifact Wintershot', () => {
  const choices = gearPickerEntries(catalog, 'weapon').filter(entry => entry.data.named_weapon)
  expect(choices.map(entry => entry.name)).toEqual(['Wintershot (Artifact)'])
  expect(choices[0].data.named_weapon_base).toBe('Composite Longbow')
  const attack = weaponAttack(c, catalog, owned(choices[0].name))
  expect(attack.range).toBe(200)
  expect(attack.damage).toBe('4d8+1 piercing')
  expect(attack.traits).toContain('Propulsive')
  expect(attack.traits).toContain('Volley 30 ft.')
  expect(choices.every(isMagicItem)).toBe(true)
  expect(choices[0].source).toBe('homebrew')
  expect(gearPickerEntries([...catalog, winter], 'weapon').filter(entry => entry.data.named_weapon_source === 'Wintershot'))
    .toEqual([])
  expect(winter.kind).toBe('item')
  expect(catalog[0].traits).toEqual(['Deadly d10', 'Propulsive'])
  expect(weaponAttack(c, catalog, JSON.parse(JSON.stringify(owned('Wintershot')))).damage).toBe(attack.damage)
})

it('applies Wintershot fundamental and Frost runes, preserves upgrades, and shows its manual activations in both views', () => {
  const weapon = owned('Wintershot (Artifact)')
  expect(effectiveWeapon(c, catalog, weapon)).toMatchObject({ potency: 3, striking: 3, material: 'Orichalcum', runes: ['Frost (Greater)', 'Holy', 'Impossible', 'Grievous'] })
  expect(effectiveWeapon(c, catalog, { ...weapon, potency: 3, striking: 3, runes: ['Frost', 'Holy'] }))
    .toMatchObject({ potency: 3, striking: 3, runes: expect.arrayContaining(['Frost (Greater)', 'Holy', 'Grievous', 'Impossible', 'Frost']) })
  for (const displayOnly of [false, true]) {
    const markup = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [weapon] }} entries={catalog} save={() => {}} displayOnly={displayOnly} />)
    expect(markup).toContain('1d6 cold')
    const activations = [...markup.matchAll(/<details>([\s\S]*?)<\/details>/g)].map(match => match[1])
      .filter(text => !text.startsWith('<summary>Summary '))
    expect(activations).toHaveLength(3)
    expect(activations[0]).toContain('<summary>Auroral Shine ')
    expect(activations[0]).toContain('aria-label="Single Action"')
    expect(activations[0]).toContain('once per minute')
    expect(activations[0]).toContain('DC 43 Fortitude')
    expect(activations[0]).toContain('<p>Critical Success Unaffected.</p>')
    expect(activations[0]).not.toContain('Signal Flare')
    expect(activations[1]).toContain('<summary>Rimecrust ')
    expect(activations[1]).toContain('once per day')
    expect(activations[1]).toContain('DC 43 Fortitude')
    expect(activations[2]).toContain('<summary>Signal Flare ')
    expect(activations[2]).toContain('Counteract rank 9')
    expect(markup).not.toContain('Wintershot activation details unavailable.')
    expect(markup).toContain('Ignores concealment from mist or precipitation')
    expect(markup).not.toContain('up to -2')
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

it('resolves former Wintershot bow names to the artifact composite longbow', () => {
  const artifact = { ...winter, name: 'Wintershot (Artifact)', id: 'wintershot-artifact', level: 20,
    traits: [...winter.traits, 'Artifact'],
    data: { ...winter.data, item_subcategory: '', item_category: 'Artifacts' },
    description: 'Wintershot is a +3 major striking greater frost holy composite shortbow. Auroral Shine requires DC 43 Fortitude.' }
  const entries = [...catalog.filter(entry => entry !== winterArtifact), artifact]
  expect(effectiveWeapon(c, entries, owned('Wintershot (Artifact) (Shortbow)')))
    .toMatchObject({ potency: 3, striking: 3, material: 'Orichalcum', runes: ['Frost (Greater)', 'Holy', 'Impossible', 'Grievous'] })
  expect(weaponAttack(c, entries, owned('Wintershot (Artifact) (Longbow)')).damage).toBe('4d8+1 piercing')
  expect(weaponAttack(c, entries, owned('Wintershot (Longbow)')).damage).toBe('4d8+1 piercing')
  expect(weaponEntry(entries, 'Wintershot (Artifact)')?.level).toBe(20)
  expect(gearPickerEntries(entries, 'weapon').filter(entry => entry.data.named_weapon_source === 'Wintershot (Artifact)'))
    .toHaveLength(1)
  for (const displayOnly of [false, true]) {
    const html = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [owned('Wintershot (Artifact) (Longbow)')] }}
      entries={entries} save={() => {}} displayOnly={displayOnly} />)
    expect(html).toContain('>Wintershot Composite Longbow</button>')
    expect(html).not.toContain('>Wintershot (Artifact)')
    expect(html).not.toContain('aria-label="Remove Grievous rune"')
  }
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
  const entries = [...catalog.filter(entry => entry !== winterArtifact), artifact]
  const name = `Wintershot (Artifact) (${type})`
  const parsed = namedWeaponAbilities(weaponEntry(entries, name))
  expect(parsed.map(activation => activation.name)).toEqual(['Summary', 'Auroral Shine', 'Rimecrust', 'Signal Flare'])
  expect(parsed[1].paragraphs).toHaveLength(5)
  expect(parsed[2].paragraphs).toHaveLength(5)
  for (const displayOnly of [false, true]) {
    const markup = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [owned(name)] }}
      entries={entries} save={() => {}} displayOnly={displayOnly} />)
    const activations = [...markup.matchAll(/<details>([\s\S]*?)<\/details>/g)].map(match => match[1])
      .filter(text => !text.startsWith('<summary>Summary '))
    expect(activations).toHaveLength(3)
    expect(activations[0]).toContain('once per minute')
    expect(activations[0]).toContain('DC 43 Fortitude')
    expect(activations[0]).toContain('Wintershot can\u2019t use this activation')
    expect(activations[0]).toContain('<p>Failure 6d6 persistent cold damage; lights last 1 minute.</p>')
    expect(activations[0]).toContain('<p>Critical Failure 6d6 persistent cold damage; lights last 10 minutes.</p>')
    expect(activations[2]).toContain('once per hour')
    expect(activations[2]).toContain('Counteract rank 9')
    expect(activations[2]).toContain('+25 modifier (+30')
    expect(activations[1]).toContain('aria-label="Two Actions"')
    expect(activations[1]).toContain('temporarily immune for 24 hours')
    expect(activations[1]).toContain('Escapes (DC 43)')
    expect(activations[1]).toContain('restrained')
    expect(activations.join('')).not.toMatch(/Nethys Note|DC 34|once per 10 minutes|rank 7/)
  }
})

it('reports missing Wintershot activation text instead of silently hiding its abilities', () => {
  const incomplete = { ...winterArtifact, description: 'Base Weapon Composite Shortbow. A +3 major striking composite shortbow.' }
  const markup = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [owned(winter.name)] }}
    entries={catalog.map(entry => entry.id === winterArtifact.id ? incomplete : entry)} save={() => {}} displayOnly />)
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

it('makes named bow versions composite longbows without creating crossbow variants', () => {
  const hunter = { ...winter, name: "Hunter's Bow", id: 'hunter',
    description: 'Base Weapon Shortbow. A +1 magic shortbow.' }
  const crossbow = { ...hunter, name: 'Tidal Crossbow', id: 'crossbow', description: 'Base Weapon Crossbow. A +2 striking crossbow.' }
  const entries = [...catalog, bow('Shortbow', false, false), bow('Longbow', true, false), hunter, crossbow]
  const variant = weaponEntry(entries, "Hunter's Bow (Longbow)")
  expect(variant?.data.named_weapon_base).toBe('Composite Longbow')
  expect(variant?.traits).toContain('Propulsive')
  expect(effectiveWeapon(c, entries, owned("Hunter's Bow (Longbow)"))).toMatchObject({ potency: 1, striking: 0 })
  expect(gearPickerEntries(entries, 'weapon').some(entry => entry.name.startsWith('Tidal Crossbow'))).toBe(false)
})

it('applies Erastil moderate boon to the artifact composite longbow and saved native magic longbows', () => {
  const native = { ...winter, id: 'native-longbow', name: "Hunter's Anthem",
    description: 'Base Weapon Composite Longbow. A +2 greater striking composite longbow.' }
  const entries = [...catalog, native]
  const blessed = { ...c, deity: 'Erastil', divineIntercessions: { Erastil: ['moderate-boon'] } }
  for (const name of ['Wintershot (Artifact)', 'Wintershot (Shortbow)', native.name]) {
    const attack = weaponAttack(blessed, entries, owned(name))
    expect(attack.range).toBe(name === native.name ? 200 : 400)
    expect(attack.traits).toContain('Volley (if beneficial)')
    expect(attack.traits).not.toContain('Volley 30 ft.')
  }
})

it('reports missing fixed rune data in both views instead of silently omitting its effects', () => {
  const entries = catalog.filter(entry => entry.name !== 'Greater Frost')
  for (const displayOnly of [false, true]) {
    const markup = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [owned('Wintershot')] }}
      entries={entries} save={() => {}} displayOnly={displayOnly} />)
    expect(markup).toContain('Named weapon enhancement details unavailable.')
  }
})

const melee = (name: string, damage: string, traits: string[] = [], hands = 1): ContentEntry => ({
  ...catalog[0], id: name, name, traits,
  data: { damage, hands, bulk: 1, weapon_type: 'Melee', weapon_category: 'Martial', weapon_group: 'Sword' },
})
const specific = (name: string, base: string, enchantment: string, rules: string[]): ContentEntry => ({
  ...winter, id: name, name, level: 23, traits: ['Artifact', 'Magical', 'Unique'],
  data: { item_category: 'Artifacts', rarity: 'unique', url: `https://example.test/${encodeURIComponent(name)}` },
  description: [`Base Weapon ${base}. A ${enchantment} ${base.toLowerCase()}.`, ...rules].join('\n\n'),
})
const shadowpiercer = specific('Shadowpiercer', 'Spear', '+4 major striking ghost touch', [
  'Shadowpiercer adds 2d6 precision damage against incorporeal or shadow creatures and ignores their precision immunity and resistance.',
  'While wielding it, gain +2 status to saves against darkness and shadow; allies within 60 feet benefit. Zon-Kuthon worshippers are drained 4 and enfeebled 4 while carrying or wielding it.',
  'Activate\u2014Absorb Shadows (concentrate, healing, manipulate, occult) Frequency once per day; Effect Gain temporary HP equal to four times the effect counteract rank for 1 hour.',
  'Activate\u2014Rebuff Gloom (concentrate, occult) Frequency Not currently drained; Trigger A darkness or shadow effect targets you or an ally within 60 feet; Effect Counteract rank 10, +46; spend a Mythic Point or become drained 2.',
  'Destruction A worshipper of Zon-Kuthon casts rank-10 darkness daily for a month.',
])
const callooh = specific('Callooh Callay', 'Longsword', '+3 major striking vorpal', [
  'Strikes deal 2d6 persistent bleed to Tane and linnorms. Snicker-Snack uses DC 40 and counteracts death-triggered abilities after decapitation.',
  'Activate\u2014One, Two! ; Frequency once per day; Effect Make two Strikes against the same target, then trigger Snicker-Snack if both hit.',
  'Activate\u2014Rest Thee by the Tumtum (concentrate) Frequency once per 10 minutes; Effect Recall Knowledge; on success, Strike or Stride.',
  'Destruction Dissolves after being swallowed by a Tane for a year.',
])
const melothBase = specific("Meloth's Lifedrinker", 'Longsword', '+2 striking', [])
const melothImproved = specific("Meloth's Lifedrinker (Improved)", 'Longsword', '+3 major striking', [])
const fallenStars = specific('Blade of Fallen Stars', 'Gun Sword', '+4 major striking greater frost', [
  'Made from high-grade cold siccatite.',
  'Activate Interact; Effect Unfold a bipod to negate the kickback penalty; reverse it before moving or using melee.',
  'Activate command, Interact; Requirements Exposed to starlight for at least 1 hour; Effect Next ranged Strike adds 6d8 cold and faerie fire in a 5-foot emanation.',
  'Destruction Seven years, seven months, and seven days without light.',
])
const finalStand = specific('Final Stand', 'Rapier', '+3 greater striking', [
  'While wielding Final Stand, attempt a DC 11 flat check when damage would reduce you to 0 HP without killing you. On success, stay at 1 HP and cannot regain HP for the encounter.',
  'When conscious with no perceived nearby enemies, drop to 0 HP and dying 1. Use other ferocity abilities first.',
  'Destruction Surrendering while allies stand increases the flat-check DC by 2; it shatters above DC 20.',
])
const gunMelee = { ...melee('Gun Sword (Melee)', '1d8 slashing', ['Combination', 'Critical Fusion', 'Versatile P'], 2),
  data: { ...melee('', '').data, hands: 2, damage: '1d8 slashing', url: 'https://2e.aonprd.com/Weapons.aspx?ID=218' } }
const gunRanged: ContentEntry = { ...gunMelee, id: 'gun-ranged', name: 'Gun Sword (Ranged)',
  traits: ['Combination', 'Concussive', 'Kickback'],
  data: { ...gunMelee.data, weapon_type: 'Ranged', weapon_group: 'Firearm', damage: '1d10 piercing', range: 30, reload: 1 } }
const namedCatalog: ContentEntry[] = [...catalog, rune('Ghost Touch'), rune('Vorpal'),
  { ...melee('Spear', '1d6 piercing', ['Thrown 20 ft.']),
    data: { ...melee('', '').data, damage: '1d6 piercing', weapon_category: 'Simple', weapon_group: 'Spear', thrown_range: 20 } },
  { ...melee("Dancer's Spear", '1d6 piercing', ['Backswing', 'Finesse', 'Reach', 'Sweep', 'Versatile B'], 2),
    data: { ...melee('', '').data, damage: '1d6 piercing', hands: 2, weapon_group: 'Spear' } },
  melee('Longsword', '1d8 slashing', ['Versatile P']),
  melee('Shortsword', '1d6 piercing', ['Agile', 'Finesse', 'Versatile S']),
  melee('Bastard Sword', '1d8 slashing', ['Two-Hand d12']),
  melee('Elven Curve Blade', '1d8 slashing', ['Elf', 'Finesse', 'Forceful'], 2),
  melee('Rapier', '1d6 piercing', ['Finesse', 'Deadly d8', 'Disarm']),
  gunMelee, gunRanged, shadowpiercer, callooh, fallenStars, finalStand,
]

it.each([false, true])('locks Greater Astral on every Serithtial blade form (%s)', displayOnly => {
  const serithtial = specific('Serithtial', 'Bastard Sword', '+4 major striking holy', [])
  const entries = [...namedCatalog, serithtial, rune('Astral (Greater)'), rune('Grievous')]
  expect(weaponEntry(entries, 'Serithtial')?.data.named_weapon_base).toBe('Longsword')
  expect(namedWeaponBases(weaponEntry(entries, 'Serithtial'))[0]).toBe('Longsword')
  const forms = gearPickerEntries(entries, 'weapon').filter(entry => entry.data.named_weapon_source === serithtial.name)
  expect(forms).toHaveLength(1)
  for (const name of ['Serithtial', 'Serithtial (Longsword)', 'Serithtial (Rapier)']) {
    const weapon = { ...owned(name), runes: ['Flaming'] }
    expect(effectiveWeapon(c, entries, weapon).runes).toEqual(['Holy', 'Astral (Greater)', 'Grievous', 'Flaming'])
    expect(effectiveWeapon(c, entries, { ...weapon, runes: ['Astral (Greater)'] }).runes)
      .toEqual(['Holy', 'Astral (Greater)', 'Grievous'])
    const markup = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [weapon] }} entries={entries}
      save={() => {}} displayOnly={displayOnly} />)
    if (!displayOnly) {
      expect(markup).toContain('>Astral (Greater)</button>')
      expect(markup).not.toContain('aria-label="Remove Astral (Greater) rune"')
    }
    expect(weapon.runes).toEqual(['Flaming'])
  }
})

it('keeps Serithtial blade selection and item abilities in Equipment only', () => {
  const serithtial = specific('Serithtial', 'Bastard Sword', '+4 major striking holy', [
    'Activate\u2014Grace of the Inheritor (divine) Frequency once per day; Effect Restore Hit Points.',
    'Destruction The sword can be destroyed only by its ancient enemy.',
  ])
  serithtial.description = `Serithtial\n\n---\n\nPerception +20; darkvision\n\n---\n\n${serithtial.description}`
  const entries = [...namedCatalog, serithtial]
  const character = { ...c, weapons: [owned('Serithtial')] }
  const render = (displayOnly: boolean) => renderToStaticMarkup(
    <WeaponList c={character} entries={entries} save={() => {}} displayOnly={displayOnly} />)
  const equipment = render(false)
  const offense = render(true)
  expect(equipment).toContain('aria-label="Serithtial weapon type"')
  expect(offense).not.toContain('aria-label="Serithtial weapon type"')
  for (const heading of ['Senses', 'Grace of the Inheritor', 'Destruction']) {
    expect(equipment).toContain(`<summary>${heading} `)
    expect(offense).not.toContain(`<summary>${heading} `)
  }
  expect(equipment).not.toContain('<summary>Summary ')
  expect(offense).toContain('Damage ')
})

it('offers only Soulcutter artifact, labeled with its base weapon', () => {
  const name = 'Soulcutter (Artifact)'
  const item = specific(name, 'Elven Curve Blade', '+3 major striking greater astral holy', [
    'As long as you carry Soulcutter, you gain its potency bonus as an item bonus to all saving throws against mental effects. This bonus increases by 2 against possession effects.',
    'Activate\u2014Soothe Souls (concentrate, healing, manipulate, vitality) Frequency once per hour; Effect Restore the living and damage fiends and undead in a 30-foot emanation.',
    'Activate\u2014Soulcutting Storm (concentrate, manipulate, spirit) Frequency once per hour; Effect Cast a 9th-rank weapon storm as spirit damage.',
    'Activate\u2014Shame Demon (concentrate) Effect Trigger a demon’s sin vulnerability.',
  ])
  const ordinary = specific('Soulcutter', 'Elven Curve Blade', '+2 greater striking astral', [])
  ordinary.traits = ['Magical', 'Unique']
  const entries = [...namedCatalog, ordinary, item, rune('Astral (Greater)'), rune('Grievous')]
  const soulcutters = gearPickerEntries(entries, 'weapon')
    .filter(candidate => String(candidate.data.named_weapon_source).startsWith('Soulcutter'))
  expect(soulcutters).toHaveLength(1)
  const entry = soulcutters[0]
  expect(entry.data.named_weapon_source).toBe(name)
  expect(specificMagicItemName(entry)).toBe('Soulcutter Elven Curve Blade')
  expect(entry).toMatchObject({ name, traits: expect.arrayContaining(['Artifact']),
    data: { named_weapon_base: 'Elven Curve Blade' } })
  expect(effectiveWeapon(c, entries, owned(name))).toMatchObject({
    potency: 3, runes: expect.arrayContaining(['Astral (Greater)', 'Holy', 'Grievous']),
  })
  const abilities = namedWeaponAbilities(entry)
  expect(abilities.map(ability => ability.name)).toEqual(expect.arrayContaining(['Soothe Souls', 'Soulcutting Storm', 'Shame Demon']))
  const character = { ...c, weapons: [owned(name)] }
  const defense = renderToStaticMarkup(<SkillsSection c={character} entries={entries} save={() => {}} part="defense" />)
  expect(defense).toContain('+3 item to saves against mental effects; +5 against possession effects.')
  expect(savingThrowBreakdown(character, entries, 'Will').total).toBe(savingThrowBreakdown(c, entries, 'Will').total)
})

it.each([false, true])('includes full base weapon names in specific weapon titles (%s)', displayOnly => {
  const briar = specific('Briar', 'Bastard Sword', '+3 greater striking cold iron', [])
  const weapons = [{ ...owned('Briar'), id: 'briar' }, owned('Wintershot (Longbow)')]
  const html = renderToStaticMarkup(<WeaponList c={{ ...c, weapons }} entries={[...namedCatalog, briar]}
    save={() => {}} displayOnly={displayOnly} />)
  expect(html).toContain('>Briar Bastard Sword</button>')
  expect(html).toContain('>Wintershot Composite Longbow</button>')
  expect(weapons.map(weapon => weapon.name)).toEqual(['Briar', 'Wintershot (Longbow)'])
})

it('uses the canonical Axe of the Dwarven Lords name and fixed Orichalcum', () => {
  const name = 'Axe of the Dwarven Lords'
  const axe = specific(name, 'Dwarven Waraxe', '+4 major striking', [])
  const entries = [...namedCatalog, melee('Dwarven Waraxe', '1d8 slashing'), axe]
  const weapon = { ...owned(name), material: 'Cold Iron' as const }
  const entry = gearPickerEntries(entries, 'weapon').find(candidate => candidate.name === name)!
  expect(specificMagicItemName(entry)).toBe(name)
  expect(effectiveWeapon(c, entries, weapon).material).toBe('Orichalcum')
  expect(weapon.material).toBe('Cold Iron')
  for (const displayOnly of [false, true]) {
    const html = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [weapon] }} entries={entries} save={() => {}} displayOnly={displayOnly} />)
    expect(html).toContain(`>${name}</button>`)
    expect(html).not.toContain(`${name} Dwarven Waraxe`)
    expect(html).not.toContain('>Orichalcum</button>')
  }
})

it.each([undefined, 'Paired', 'Merged', 'Flame', 'Frost'] as const)(
  'names Coldstar forms and their individual attachment source correctly (%s)', coldstarForm => {
    const pistol: ContentEntry = { ...melee('Dueling Pistol', '1d6 piercing'),
      data: { ...melee('', '').data, damage: '1d6 piercing', hands: 1, weapon_type: 'Ranged',
        weapon_group: 'Firearm', range: 60, reload: 1 } }
    const coldstar = specific('Coldstar Pistols', 'Dueling Pistol', '+3 greater striking', [])
    const bayonet = { ...melee('Bayonet', '1d4 piercing'), traits: ['Attached to Crossbow or Firearm'] }
    const weapon: OwnedWeapon = { ...owned(coldstar.name), coldstarForm, attachedWeapon: 'Bayonet' }
    for (const displayOnly of [false, true]) {
      const html = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [weapon] }}
        entries={[pistol, coldstar, bayonet]} save={() => {}} displayOnly={displayOnly} />)
      const name = !coldstarForm || coldstarForm === 'Paired' ? 'Coldstar Dueling Pistols' : 'Coldstar Dueling Pistol'
      expect(html).toContain(`>${name}</button>`)
      expect(html).toContain('>Bayonet (Attached to Coldstar Dueling Pistol)</button>')
    }
    expect(weapon.name).toBe('Coldstar Pistols')
    expect(weapon.coldstarForm).toBe(coldstarForm)
  },
)

function findControl(node: ReactNode, label: string): ReactElement<Record<string, unknown>> | undefined {
  let found: ReactElement<Record<string, unknown>> | undefined
  Children.forEach(node, child => {
    if (found || !isValidElement<Record<string, unknown>>(child)) return
    found = child.props['aria-label'] === label ? child : findControl(child.props.children as ReactNode, label)
  })
  return found
}

function changeControl(tree: ReactNode, label: string, value: string) {
  const control = findControl(tree, label)
  if (typeof control?.props.onChange !== 'function') throw new Error(`Missing control: ${label}`)
  control.props.onChange({ target: { value, valueAsNumber: value ? Number(value) : NaN } })
}

it.each([false, true])('persists Briar points, rejects invalid inputs, and removes only earned powers on downgrade (%s)', displayOnly => {
  const briar = specific('Briar', 'Bastard Sword', '+3 greater striking cold iron', [
    '1 Sharpness Point Briar gains shifting.',
    '4 Sharpness Points Briar gains major striking.',
    '8 Sharpness Points Briar gains +4 potency.',
    '14 Sharpness Points Briar gains conditional vorpal.',
    '20 Sharpness Points Briar gains vorpal.',
  ])
  const entries = [...namedCatalog, rune('Shifting'), briar]
  let saved = { ...c, weapons: [owned('Briar')] }
  const save = vi.fn((patch: Partial<Character>) => { saved = { ...saved, ...patch } })
  const render = () => WeaponList({ c: saved, entries, save, displayOnly })
  for (const invalid of ['-1', '1.5', '', '9007199254740992']) changeControl(render(), 'Briar Sharpness Points', invalid)
  expect(save).not.toHaveBeenCalled()
  changeControl(render(), 'Briar Sharpness Points', '25')
  saved = JSON.parse(JSON.stringify(saved))
  expect(saved.weapons[0].briarSharpness).toBe(20)
  expect(effectiveWeapon(saved, entries, saved.weapons[0]).runes).toEqual(['Shifting', 'Vorpal', 'Grievous'])
  saved.weapons[0].briarSharpness = 25
  expect(findControl(render(), 'Briar Sharpness Points')?.props).toMatchObject({ value: 20, max: 20 })
  changeControl(render(), 'Briar Sharpness Points', '19')
  expect(saved.weapons[0].briarSharpness).toBe(19)
  changeControl(render(), 'Briar Sharpness Points', '0')
  expect(effectiveWeapon(saved, entries, saved.weapons[0])).toMatchObject({ potency: 3, striking: 2, runes: ['Grievous'] })
  expect(saved.weapons[0]).toMatchObject({ id: 'bow', potency: 0, striking: 0, runes: [] })
})

it.each([false, true])('toggles remastered Briar Oaken Resilience at each earned rank without affecting a familiar (%s)', displayOnly => {
  const previous = getSettings().innateAutoHeighten
  updateSettings({ innateAutoHeighten: false })
  onTestFinished(() => updateSettings({ innateAutoHeighten: previous }))
  const briar = specific('Briar', 'Bastard Sword', '+3 greater striking cold iron', [
    '1 Sharpness Point Briar gains shifting.',
    ...[[4, ''], [8, 'a 4th-level '], [14, 'a 6th-level '], [20, 'an 8th-level ']].flatMap(([points, heightening]) => [
      `${points} Sharpness Points Briar gains powers.`,
      `Activate command; Frequency three times per day; Effect Briar casts ${heightening}barkskin on its partner.`,
    ]),
  ])
  const entries = [...namedCatalog, rune('Shifting'), briar]
  for (const [points, rank] of [[4, 2], [8, 4], [14, 6], [20, 8]]) {
    let saved: Character = { ...c, weapons: [{ ...owned('Briar'), briarSharpness: points }] }
    const render = () => WeaponList({ c: saved, entries, save: patch => { saved = { ...saved, ...patch } }, displayOnly })
    const toggle = (checked: boolean) => {
      const control = findControl(render(), 'Briar Oaken Resilience active')
      if (typeof control?.props.onChange !== 'function') throw new Error('Missing Briar Oaken Resilience toggle')
      control.props.onChange({ target: { checked } })
    }
    expect(oakenResilience(saved, entries)).toBeUndefined()
    const markup = renderToStaticMarkup(render())
    expect(markup).not.toMatch(/barkskin/i)
    expect(markup).toContain(`casts rank ${rank} Oaken Resilience`)
    expect(markup).toContain('Frequency three times per day')
    expect(markup).toContain('aria-label="Single Action"')
    expect(markup).toContain('For 10 minutes')
    toggle(true)
    saved = JSON.parse(JSON.stringify(saved))
    expect(oakenResilience(saved, entries)).toEqual({ rank, resistance: rank, fireWeakness: rank * 3 / 2 })
    expect(resistances(saved, entries)).toEqual([
      { damage: 'Bludgeoning', value: rank, source: 'Oaken Resilience' },
      { damage: 'Piercing', value: rank, source: 'Oaken Resilience' },
    ])
    expect(oakenResilience(saved, entries, 'familiar')).toBeUndefined()
    expect(oakenResilience({ ...saved, weapons: saved.weapons?.map(weapon => ({ ...weapon, stowed: true })) }, entries))
      .toMatchObject({ rank })
    toggle(false)
    expect(oakenResilience(saved, entries)).toBeUndefined()
    if (rank === 8) {
      saved = { ...saved, spells: [{ name: 'Oaken Resilience', rank: 4, cantrip: false }],
        activeSpells: ['Oaken Resilience'], oakenResilienceRank: 4 }
      toggle(true)
      expect(oakenResilience(saved, entries)).toMatchObject({ rank: 8 })
      expect(oakenResilience(saved, entries, 'familiar')).toMatchObject({ rank: 4 })
      toggle(false)
      expect(oakenResilience(saved, entries)).toMatchObject({ rank: 4 })
    }
  }
})

it.each([[9, 5, 4], [20, 10, 10]])('heightens earned Briar spells and their actual resistance at level %i', (level, rank, resistance) => {
  const previous = getSettings().innateAutoHeighten
  updateSettings({ innateAutoHeighten: true })
  onTestFinished(() => updateSettings({ innateAutoHeighten: previous }))
  const briar = specific('Briar', 'Bastard Sword', '+3 greater striking cold iron', [
    '1 Sharpness Point Briar gains shifting.',
    '4 Sharpness Points Briar gains powers.',
    'Activate command; Frequency three times per day; Effect Briar casts barkskin on its partner.',
    '8 Sharpness Points Briar gains powers.',
    '14 Sharpness Points Briar gains powers.',
    '20 Sharpness Points Briar gains powers.',
  ])
  const entries = [...namedCatalog, rune('Shifting'), briar]
  const character: Character = { ...c, level,
    weapons: [{ ...owned('Briar'), briarSharpness: 4, briarOakenResilienceActive: true }] }
  expect(oakenResilience(character, entries)).toEqual({ rank, resistance, fireWeakness: resistance * 3 / 2 })
  const markup = renderToStaticMarkup(<WeaponList c={character} entries={entries} save={() => {}} />)
  expect(markup).toContain(`casts rank ${rank} Oaken Resilience`)
  expect(markup).toContain(`resistance ${resistance} to bludgeoning and piercing damage and weakness ${resistance * 3 / 2} to fire`)
  expect(oakenResilience({ ...character, weapons: [{ ...character.weapons![0], briarSharpness: 0 }] }, entries)).toBeUndefined()
})

it('resolves saved Callooh Callay variants to its only longsword form', () => {
  const weapon: OwnedWeapon = { ...owned('Callooh Callay (Shortsword)'), runes: ['Flaming'], stowed: true }
  let saved = { ...c, weapons: [weapon],
    gearAccessOverrides: [`${callooh.id}:longsword`] }
  expect(namedWeaponBases(weaponEntry(namedCatalog, weapon.name))).toEqual([])
  expect(weaponAttack(saved, namedCatalog, weapon).damage).toBe('4d8+2 slashing')
  const html = renderToStaticMarkup(<WeaponList c={saved} entries={namedCatalog} save={() => {}} />)
  expect(html).not.toContain('aria-label="Callooh Callay weapon type"')
  expect(gearAccess(saved, namedCatalog, weaponEntry(namedCatalog, saved.weapons[0].name)!)?.approved).toBe(true)
})

it("offers only Meloth's improved Lifedrinker as the canonical Longsword", () => {
  const entries = [...namedCatalog, melothBase, melothImproved]
  const choices = gearPickerEntries(entries, 'weapon')
    .filter(entry => entry.data.named_weapon_source === "Meloth's Lifedrinker")
  expect(choices.map(entry => entry.name)).toEqual(["Meloth's Lifedrinker"])
  expect(choices[0].data.named_weapon_base).toBe('Longsword')
  expect(namedWeaponBases(choices[0])).toEqual([])
  expect(weaponEntry(entries, "Meloth's Lifedrinker (Improved)")?.data.named_weapon_source).toBe("Meloth's Lifedrinker")
  expect(specificMagicItemName(choices[0], choices[0].name, true)).toBe("Meloth's Lifedrinker Longsword")
})

it('creates stronger arrowheads with conditional nonstacking bonuses and unchanged daily reaction', () => {
  const carried = { ...c, equipment: HUNTERS_ARROWHEADS.map(entry => ({ name: entry.name, qty: 1 })) }
  expect(hunterArrowheadBonus(carried, HUNTERS_ARROWHEADS)).toEqual({ source: "Hunter's Arrowhead (Major)", value: 3 })
  expect(hunterArrowheadBonus({ ...carried, equipment: carried.equipment.map(item => ({ ...item, qty: 0 })) }, HUNTERS_ARROWHEADS)).toBeUndefined()
  const bow = owned('Wintershot (Longbow)')
  const char = { ...carried, weapons: [bow] }
  const entries = [...namedCatalog, ...HUNTERS_ARROWHEADS]
  expect(weaponAttack(char, entries, bow).attack).toBe(weaponAttack(c, entries, bow).attack)
  for (const displayOnly of [false, true]) {
    const markup = renderToStaticMarkup(<WeaponList c={char} entries={entries} save={() => {}} displayOnly={displayOnly} />)
    expect(markup).not.toContain('Against your Hunt Prey target')
    expect(markup).not.toContain("Hunter&#x27;s Arrowhead (Major) note")
  }
  expect(HUNTERS_ARROWHEADS.map(entry => entry.level)).toEqual([9, 17])
  expect(HUNTERS_ARROWHEADS.every(entry => entry.source === 'homebrew')).toBe(true)
})

it.each([
  ['Shadowpiercer', ['Shadowpiercer'], 'Spear'],
  ['Callooh Callay', ['Callooh Callay'], 'Longsword'],
  ['Blade of Fallen Stars', ['Blade of Fallen Stars (Melee)', 'Blade of Fallen Stars (Ranged)'], 'Gun Sword (Melee)'],
  ['Final Stand', ['Final Stand'], 'Rapier'],
] as const)('offers requested %s variants, resolves saved original names, and preserves their source records', (name, names, base) => {
  const choices = gearPickerEntries(namedCatalog, 'weapon').filter(entry => entry.data.named_weapon_source === name)
  expect(choices.map(entry => entry.name)).toEqual([...names])
  expect(choices.every(isMagicItem)).toBe(true)
  expect(weaponEntry(namedCatalog, name)?.data.named_weapon_base).toBe(base)
  expect(weaponEntry(namedCatalog, name)?.kind).toBe('weapon')
  expect(namedCatalog.find(entry => entry.name === name)?.kind).toBe('item')
  expect(choices.filter(entry => entry.source === 'homebrew').length).toBe(0)
})

it('preserves Wintershot artifact access approvals', () => {
  const choice = gearPickerEntries(namedCatalog, 'weapon').find(entry => entry.name === 'Wintershot (Artifact)')!
  const saved = { ...c, gearAccessOverrides: [winterArtifact.id] }
  expect(gearAccess(saved, namedCatalog, choice)?.approved).toBe(true)
})

it('does not duplicate Grievous when already present in an artifact source or saved rune list', () => {
  const source = { ...shadowpiercer,
    description: shadowpiercer.description.replace('+4 major striking ghost touch', '+4 major striking grievous ghost touch') }
  const entries = [...namedCatalog.filter(entry => entry !== shadowpiercer), source, rune('Grievous')]
  const weapon = { ...owned('Shadowpiercer'), runes: ['Grievous', 'Flaming'] }
  expect(effectiveWeapon(c, entries, weapon).runes).toEqual(['Ghost Touch', 'Grievous', 'Flaming'])
  expect(weapon.runes).toEqual(['Grievous', 'Flaming'])
})

it('resolves saved Shadowpiercer variants to its only spear form', () => {
  for (const name of ["Shadowpiercer (Dancer's Spear)", 'Shadowpiercer (Spear)', 'Shadowpiercer']) {
    const weapon = owned(name)
    expect(effectiveWeapon(c, namedCatalog, weapon)).toMatchObject({ potency: 4, striking: 3, runes: ['Ghost Touch', 'Grievous'] })
    const attack = weaponAttack(c, namedCatalog, weapon)
    expect(attack.damage).toBe('4d6+2 piercing')
    expect(attack.additionalDamage[0].value).toBe('2d6 precision vs. incorporeal or shadow creatures')
    expect(weaponHands(namedCatalog, weapon)).toBe(1)
    expect(attack.thrownRange).toBe(20)
    expect(attack.traits).not.toContain('Reach')
  }
  const enhanced = effectiveWeapon(c, namedCatalog, { ...owned('Shadowpiercer'), striking: 3, runes: ['Flaming'] })
  expect(enhanced.runes).toEqual(['Ghost Touch', 'Grievous', 'Flaming'])
})

it('uses Callooh Callay base dice, finesse and two-hand traits, preserves Vorpal, and applies matching deity boons', () => {
  const longsword = owned('Callooh Callay (Longsword)')
  expect(effectiveWeapon(c, namedCatalog, longsword)).toMatchObject({ potency: 3, striking: 3, runes: ['Vorpal', 'Grievous'] })
  expect(weaponAttack(c, namedCatalog, longsword).damage).toBe('4d8+2 slashing')
  for (const savedName of ['Callooh Callay (Shortsword)', 'Callooh Callay (Bastard Sword)']) {
    expect(weaponAttack(c, namedCatalog, owned(savedName)).damage).toBe('4d8+2 slashing')
  }
  const blessed = { ...c, deity: 'Iomedae', divineIntercessions: { Iomedae: ['major-boon'] } }
  expect(weaponAttack(blessed, namedCatalog, longsword).attack).toBe(weaponAttack(c, namedCatalog, longsword).attack + 2)
  const deity: ContentEntry = { ...winter, id: 'iomedae', name: 'Iomedae', kind: 'deity', data: { favored_weapon: 'Longsword' } }
  expect(isFavoredWeapon(blessed, [...namedCatalog, deity], longsword.name)).toBe(true)
  expect(isFavoredWeapon(blessed, [...namedCatalog, deity], 'Callooh Callay (Bastard Sword)')).toBe(true)
})

it('supports both Blade of Fallen Stars forms and saved unsuffixed names with shared +4 Greater Frost enhancements', () => {
  for (const name of ['Blade of Fallen Stars', 'Blade of Fallen Stars (Melee)', 'Blade of Fallen Stars (Ranged)']) {
    expect(combinationForms(namedCatalog, name)).toHaveLength(2)
    expect(combinationName(namedCatalog, name)).toBe('Blade of Fallen Stars')
    for (const combinationForm of ['Melee', 'Ranged'] as const) {
      const weapon = { ...owned(name), combinationForm }
      expect(effectiveWeapon(c, namedCatalog, weapon)).toMatchObject({ potency: 4, striking: 3, runes: ['Frost (Greater)', 'Grievous'] })
      const attack = weaponAttack(c, namedCatalog, weapon)
      expect(attack.damage).toBe(combinationForm === 'Melee' ? '4d8+2 slashing' : '4d10 piercing')
      expect(attack.range).toBe(combinationForm === 'Melee' ? 0 : 30)
      expect(attack.traits).toContain(combinationForm === 'Melee' ? 'Critical Fusion' : 'Kickback')
    }
  }
})

it('shows one selected Blade of Fallen Stars attack and lets inventory switch its combination form', () => {
  let saved: Character = { ...c, weapons: [owned('Blade of Fallen Stars (Melee)')] }
  const save = (patch: Partial<Character>) => { saved = { ...saved, ...patch } }
  const meleeMarkup = renderToStaticMarkup(<WeaponList c={saved} entries={namedCatalog} save={save} />)
  expect(meleeMarkup).toContain('Melee: Attack')
  expect(meleeMarkup).not.toContain('Ranged: Attack')
  const label = meleeMarkup.match(/aria-label="(Combination form: [^"]+)"/)?.[1]
  expect(label).toBeTruthy()
  changeControl(WeaponList({ c: saved, entries: namedCatalog, save }), label!, 'Ranged')
  expect(saved.weapons?.[0]).toMatchObject({ combinationForm: 'Ranged' })
  const rangedMarkup = renderToStaticMarkup(<WeaponList c={saved} entries={namedCatalog} save={save} />)
  expect(rangedMarkup).toContain('Ranged: Attack')
  expect(rangedMarkup).not.toContain('Melee: Attack')
})

it.each([false, true])('shows named weapon properties, action costs, reactions and destruction rules in both views (displayOnly=%s)', displayOnly => {
  const render = (name: string) => renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [owned(name)] }}
    entries={namedCatalog} save={() => {}} displayOnly={displayOnly} />)
  const shadow = render("Shadowpiercer (Dancer's Spear)")
  expect(shadow).toContain('<summary>Absorb Shadows ')
  expect(shadow).toContain('<summary>Rebuff Gloom ')
  expect(shadow).toContain('aria-label="Reaction"')
  expect(shadow).toContain('+46')
  expect(shadow).toContain('Zon-Kuthon worshippers are drained 4')
  expect(shadow).toContain('2d6 precision vs. incorporeal or shadow creatures')
  const sword = render('Callooh Callay (Shortsword)')
  expect(sword).not.toContain(' + Vorpal')
  expect(sword).toContain('<summary>One, Two! ')
  expect(sword).toContain('<summary>Rest Thee by the Tumtum ')
  expect(sword).toContain('Snicker-Snack uses DC 40')
  expect(sword).toContain('2d6 persistent bleed vs. Tane or linnorms')
  const gun = render('Blade of Fallen Stars')
  expect(gun).toContain('<summary>Deploy bipod ')
  expect(gun).toContain('<summary>Starlight shot ')
  expect(gun).toContain('aria-label="Two Actions"')
  expect(gun).toContain('6d8 cold')
  expect(gun).toContain('high-grade cold siccatite')
  const last = render('Final Stand')
  expect(last).not.toContain('<summary>Summary ')
  expect(last).toContain('DC 11 flat check')
  expect(last).toContain('cannot regain HP')
  expect(last).toContain('<summary>Destruction ')
  expect(last).toContain('shatters above DC 20')
  for (const markup of [shadow, sword, gun, last]) expect(markup).not.toContain('Named weapon enhancement details unavailable.')
  if (!displayOnly) {
    expect(shadow).not.toContain('Potency <b>+4</b>')
    expect(shadow).not.toContain('aria-label="Remove Ghost Touch"')
    expect(sword).not.toContain('aria-label="Remove Vorpal"')
  }
  if (displayOnly) {
    expect(shadow).toContain('>Ghost Touch</button>')
    expect(sword).toContain('>Vorpal</button>')
  }
})

it('shows Shadowpiercer conditional save bonus only while held without adding it to ordinary saves', () => {
  const weapon = owned('Shadowpiercer (Spear)')
  const character = { ...c, weapons: [weapon] }
  const render = (character: Character) => renderToStaticMarkup(<SkillsSection c={character} entries={namedCatalog} save={() => {}} part="defense" />)
  expect(render(character)).toContain('against darkness and shadow effects while wielding Shadowpiercer (+2 status)')
  expect(render({ ...character, weapons: [{ ...weapon, stowed: true }] })).not.toContain('against darkness and shadow effects while wielding Shadowpiercer (+2 status)')
  for (const save of ['Fortitude', 'Reflex', 'Will'] as const)
    expect(savingThrowBreakdown(character, namedCatalog, save).total).toBe(savingThrowBreakdown(c, namedCatalog, save).total)
})

it("implements Clear Cutter's Axe as a +1 striking returning hatchet", () => {
  const hatchet: ContentEntry = { ...bow('Hatchet', false, false), traits: ['Agile', 'Sweep', 'Thrown 10 ft.'],
    data: { damage: '1d6 slashing', range: 0, thrown_range: 10, weapon_type: 'Melee', weapon_category: 'Martial', weapon_group: 'Axe', hands: 1, bulk: 'L' } }
  const item: ContentEntry = { ...winter, id: 'clear-cutter', name: "Clear Cutter's Axe", level: 9, traits: ['Magical', 'Rare'],
    description: 'Base Weapon Hatchet\n\nThis +1 striking returning hatchet has an axe head resembling a roaring lion\u2019s head.',
    data: { item_subcategory: 'Specific Magic Weapons', rarity: 'rare', url: 'https://2e.aonprd.com/Equipment.aspx?ID=3598' } }
  const [entry] = makeNamedWeaponEntries([hatchet, item], [{ name: 'Returning' }])
  expect(entry).toMatchObject({ name: "Clear Cutter's Hatchet", data: { named_weapon_base: 'Hatchet', named_weapon_potency: 1,
    named_weapon_striking: 1, named_weapon_runes: 'Returning', named_weapon_material: 'Orichalcum', named_weapon_rules_missing: false } })
  const character: Character = { ...c, level: 12, className: 'Fighter' }
  const weapon = effectiveWeapon(character, [hatchet, item, ...makeNamedWeaponEntries([hatchet, item], [{ name: 'Returning' }])],
    owned("Clear Cutter's Hatchet"))
  expect(weapon).toMatchObject({ potency: 2, striking: 2 })
  const runes = (level: number) => withNamedWeaponState(entry, owned("Clear Cutter's Hatchet"), level)?.data.named_weapon_runes
  expect([7, 8, 15, 19, 20].map(runes)).toEqual(['Returning;Grievous', 'Returning;Grievous;Flaming', 'Returning;Grievous;Flaming (Greater)', 'Returning;Grievous;Flaming (Greater)', 'Returning;Grievous;Flaming (Greater);Impossible'])
})

it('implements Fungicidal Hatchet with scaling Peachwood, Returning, Grievous and poison damage', () => {
  const hatchet: ContentEntry = { ...bow('Hatchet', false, false), traits: ['Agile', 'Sweep', 'Thrown 10 ft.'],
    data: { damage: '1d6 slashing', range: 0, thrown_range: 10, weapon_type: 'Melee', weapon_category: 'Martial', weapon_group: 'Axe', hands: 1, bulk: 'L' } }
  const item: ContentEntry = { ...winter, id: 'fungicidal', name: 'Fungicidal Hatchet', level: 5, traits: ['Magical', 'Uncommon'],
    description: 'Base Weapon Hatchet\n\nThis +1 striking hatchet deals an additional 1 poison damage.',
    data: { item_subcategory: 'Specific Magic Weapons', rarity: 'uncommon', url: 'https://2e.aonprd.com/Equipment.aspx?ID=5294' } }
  const [entry] = makeNamedWeaponEntries([hatchet, item], [])
  expect(entry.name).toBe('Fungicidal Hatchet')
  const at = (level: number) => withNamedWeaponState(entry, owned('Fungicidal Hatchet'), level)?.data
  expect(at(5)).toMatchObject({ named_weapon_runes: 'Returning;Grievous', named_weapon_material: 'Peachwood (Standard-Grade)' })
  expect(at(18)?.named_weapon_material).toBe('Peachwood (High-Grade)')
  expect(namedWeaponDamage(entry)[0].value).toContain('poison')
})

it('scales Scalding Gauntlets potency, striking and Flaming with level and hides graded duplicates', () => {
  const gauntlet: ContentEntry = { ...bow('Spiked Gauntlet', false, false), traits: ['Agile', 'Free-Hand'],
    data: { damage: '1d4 piercing', range: 0, weapon_type: 'Melee', weapon_category: 'Simple', weapon_group: 'Brawling', hands: 1, bulk: 'L' } }
  const item: ContentEntry = { ...winter, id: 'scalding', name: 'Scalding Gauntlets', level: 11, traits: ['Fire', 'Invested', 'Magical'],
    description: 'Base Weapon Spiked Gauntlet\n\nThese are a pair of +2 striking spiked gauntlets.',
    data: { item_subcategory: 'Specific Magic Weapons', url: 'https://2e.aonprd.com/Equipment.aspx?ID=2608' } }
  const greater: ContentEntry = { ...item, id: 'scalding-greater', name: 'Scalding Gauntlets (Greater)', level: 13,
    description: 'Base Weapon Spiked Gauntlet\n\nThe gauntlets are a +2 greater striking flaming spiked gauntlet.' }
  const plain: ContentEntry = { ...gauntlet, id: 'gauntlet', name: 'Gauntlet', data: { ...gauntlet.data, damage: '1d4 bludgeoning' } }
  const bladed: ContentEntry = { ...gauntlet, id: 'bladed', name: 'Bladed Gauntlet', data: { ...gauntlet.data, damage: '1d4 slashing' } }
  const entries = makeNamedWeaponEntries([gauntlet, plain, bladed, { ...gauntlet, id: 'clawed', name: 'Clawed Gauntlet' }, item, greater], [{ name: 'Flaming' }])
  expect(entries.map(entry => entry.name).filter(name => name.startsWith('Scalding')).sort()).toEqual(['Scalding Gauntlet (Bladed Gauntlet)', 'Scalding Gauntlet (Clawed Gauntlet)',
    'Scalding Gauntlet (Gauntlet)', 'Scalding Gauntlet (Spiked Gauntlet)', 'Scalding Gauntlets'])
  expect(entries.map(entry => entry.name).filter(name => name.startsWith('Freezing')).sort()).toEqual(['Freezing Gauntlet (Bladed Gauntlet)',
    'Freezing Gauntlet (Clawed Gauntlet)', 'Freezing Gauntlet (Gauntlet)', 'Freezing Gauntlet (Spiked Gauntlet)'])
  const shock = entries.find(entry => entry.name === 'Shocking Gauntlet (Clawed Gauntlet)')!
  expect(withNamedWeaponState(shock, owned(shock.name), 18)?.data.named_weapon_runes).toBe('Shock (Greater);Hooked;Grappling;Grievous')
  expect(specificMagicItemName(shock)).toBe('Shocking Clawed Gauntlet')
  expect(entries.find(entry => entry.name === 'Scalding Gauntlet (Gauntlet)')?.data.named_weapon_base).toBe('Gauntlet')
  const at = (level: number) => withNamedWeaponState(entries[1], owned('Scalding Gauntlet'), level)?.data
  expect(at(11)).toMatchObject({ named_weapon_potency: 2, named_weapon_striking: 1,
    named_weapon_runes: 'Flaming;Hooked;Grappling;Grievous', named_weapon_material: 'Orichalcum' })
  expect(at(13)).toMatchObject({ named_weapon_striking: 2, named_weapon_runes: 'Flaming;Hooked;Grappling;Grievous' })
  expect(at(18)).toMatchObject({ named_weapon_potency: 3, named_weapon_runes: 'Flaming (Greater);Hooked;Grappling;Grievous' })
})

it('labels Scalding Gauntlet variants without repeating the base', () => {
  const entry = { data: { named_weapon_source: 'Scalding Gauntlet', named_weapon_base: 'Clawed Gauntlet' } } as unknown as ContentEntry
  expect(specificMagicItemName(entry)).toBe('Scalding Clawed Gauntlet')
  expect(specificMagicItemName({ data: { ...entry.data, named_weapon_base: 'Gauntlet' } } as unknown as ContentEntry)).toBe('Scalding Gauntlet')
})

it('keeps Scalding Clawed Gauntlet equipped without occupying a hand', () => {
  const claw: ContentEntry = { ...bow('Clawed Gauntlet', false, false), traits: ['Agile', 'Parry'],
    data: { weapon_type: 'Melee', weapon_category: 'Martial', hands: 1, damage: '1d4 slashing' } }
  const spiked: ContentEntry = { ...claw, name: 'Spiked Gauntlet', id: 'spiked' }
  const item: ContentEntry = { ...winter, id: 'scalding', name: 'Scalding Gauntlets',
    description: 'Base Weapon Spiked Gauntlet. These are +2 striking spiked gauntlets.',
    data: { item_subcategory: 'Specific Magic Weapons' } }
  const entries = [claw, spiked, item]
  const gauntlet = { ...owned('Scalding Gauntlet (Clawed Gauntlet)'), stowed: true }
  const char = { ...c, weapons: [gauntlet] }
  expect(weaponHands(entries, gauntlet, char)).toBe(0)
  expect(weaponEquipped(char, entries, gauntlet)).toBe(true)
  expect(equippedHands(char, entries)).toBe(0)
  expect(renderToStaticMarkup(<WeaponList c={char} entries={entries} save={() => {}} />))
    .not.toContain('aria-label="Equipped Scalding Clawed Gauntlet"')
})
