import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { combinationForms, combinationName, effectiveWeapon, gearPickerEntries, isFavoredWeapon, isMagicItem, oakenResilience, resistances, savingThrowBreakdown, weaponAttack, weaponEntry, weaponHands } from './builder'
import { WeaponList } from './GearSection'
import { mapAonHit } from './aon'
import { namedWeaponAbilities } from './namedWeapons'
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
  const choices = gearPickerEntries(catalog, 'weapon').filter(entry => entry.data.named_weapon)
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
      .filter(text => !text.startsWith('<summary>Summary '))
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
    traits: [...winter.traits, 'Artifact'],
    data: { ...winter.data, item_subcategory: '', item_category: 'Artifacts' },
    description: 'Wintershot is a +3 major striking greater frost holy composite shortbow. Auroral Shine requires DC 43 Fortitude.' }
  const entries = [...catalog, artifact]
  expect(effectiveWeapon(c, entries, owned('Wintershot (Artifact) (Shortbow)')))
    .toMatchObject({ potency: 3, striking: 3, runes: ['Frost (Greater)', 'Holy', 'Grievous'] })
  expect(weaponAttack(c, entries, owned('Wintershot (Artifact) (Longbow)')).damage).toBe('4d8+1 piercing')
  expect(weaponEntry(entries, 'Wintershot (Artifact)')?.level).toBe(20)
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
  const entries = [...catalog, artifact]
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
  melee('Rapier', '1d6 piercing', ['Finesse', 'Deadly d8', 'Disarm']),
  gunMelee, gunRanged, shadowpiercer, callooh, fallenStars, finalStand,
]

it.each([false, true])('includes full base weapon names in specific weapon titles (%s)', displayOnly => {
  const briar = specific('Briar', 'Bastard Sword', '+3 greater striking cold iron', [])
  const weapons = [{ ...owned('Briar'), id: 'briar' }, owned('Wintershot (Longbow)')]
  const html = renderToStaticMarkup(<WeaponList c={{ ...c, weapons }} entries={[...namedCatalog, briar]}
    save={() => {}} displayOnly={displayOnly} />)
  expect(html).toContain('>Briar Bastard Sword</button>')
  expect(html).toContain('>Wintershot Composite Longbow</button>')
  expect(weapons.map(weapon => weapon.name)).toEqual(['Briar', 'Wintershot (Longbow)'])
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
  expect(saved.weapons[0].briarSharpness).toBe(25)
  expect(effectiveWeapon(saved, entries, saved.weapons[0]).runes).toEqual(['Shifting', 'Vorpal', 'Grievous'])
  changeControl(render(), 'Briar Sharpness Points', '0')
  expect(effectiveWeapon(saved, entries, saved.weapons[0])).toMatchObject({ potency: 3, striking: 2, runes: ['Grievous'] })
  expect(saved.weapons[0]).toMatchObject({ id: 'bow', potency: 0, striking: 0, runes: [] })
})

it.each([false, true])('toggles remastered Briar Oaken Resilience at each earned rank without affecting a familiar (%s)', displayOnly => {
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

it('changes named weapon types without losing upgrades or saved artifact access', () => {
  const weapon: OwnedWeapon = { ...owned('Callooh Callay'), runes: ['Flaming'], stowed: true }
  let saved = { ...c, weapons: [weapon],
    gearAccessOverrides: [`${callooh.id}:longsword`] }
  const save = (patch: Partial<Character>) => { saved = { ...saved, ...patch } }
  changeControl(WeaponList({ c: saved, entries: namedCatalog, save }), 'Callooh Callay weapon type', 'Shortsword')
  expect(saved.weapons[0]).toMatchObject({ id: 'bow', name: 'Callooh Callay (Shortsword)', runes: ['Flaming'], stowed: true })
  expect(gearAccess(saved, namedCatalog, weaponEntry(namedCatalog, saved.weapons[0].name)!)?.approved).toBe(true)
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
    expect(markup).toContain('Against your Hunt Prey target')
    expect(markup).toContain('replaces, rather than stacks with, weapon potency')
    expect(markup).toContain('+2 circumstance')
    expect(markup).toContain('Once per day')
  }
  expect(HUNTERS_ARROWHEADS.map(entry => entry.level)).toEqual([9, 17])
  expect(HUNTERS_ARROWHEADS.every(entry => entry.source === 'homebrew')).toBe(true)
})

it.each([
  ['Shadowpiercer', ["Shadowpiercer (Dancer's Spear)", 'Shadowpiercer (Spear)'], 'Spear'],
  ['Callooh Callay', ['Callooh Callay (Longsword)', 'Callooh Callay (Shortsword)', 'Callooh Callay (Bastard Sword)'], 'Longsword'],
  ['Blade of Fallen Stars', ['Blade of Fallen Stars (Melee)', 'Blade of Fallen Stars (Ranged)'], 'Gun Sword (Melee)'],
  ['Final Stand', ['Final Stand'], 'Rapier'],
] as const)('offers requested %s variants, resolves saved original names, and preserves their source records', (name, names, base) => {
  const choices = gearPickerEntries(namedCatalog, 'weapon').filter(entry => entry.data.named_weapon_source === name)
  expect(choices.map(entry => entry.name)).toEqual([...names])
  expect(choices.every(isMagicItem)).toBe(true)
  expect(weaponEntry(namedCatalog, name)?.data.named_weapon_base).toBe(base)
  expect(weaponEntry(namedCatalog, name)?.kind).toBe('weapon')
  expect(namedCatalog.find(entry => entry.name === name)?.kind).toBe('item')
  expect(choices.filter(entry => entry.source === 'homebrew').length).toBe(name === 'Shadowpiercer' ? 1 : name === 'Callooh Callay' ? 2 : 0)
})

it('preserves existing Wintershot variant IDs and saved access approvals', () => {
  const choice = gearPickerEntries(namedCatalog, 'weapon').find(entry => entry.name === 'Wintershot (Longbow)')!
  const saved = { ...c, gearAccessOverrides: [`${winter.id}:longbow`] }
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

it('gives both Shadowpiercer bases +4 major striking and Ghost Touch with base-specific hands, range, and traits', () => {
  for (const name of ["Shadowpiercer (Dancer's Spear)", 'Shadowpiercer (Spear)', 'Shadowpiercer']) {
    const weapon = owned(name)
    expect(effectiveWeapon(c, namedCatalog, weapon)).toMatchObject({ potency: 4, striking: 3, runes: ['Ghost Touch', 'Grievous'] })
    const attack = weaponAttack(c, namedCatalog, weapon)
    expect(attack.damage).toBe('4d6+2 piercing')
    expect(attack.additionalDamage[0].value).toBe('2d6 precision vs. incorporeal or shadow creatures')
    expect(weaponHands(namedCatalog, weapon)).toBe(name.includes("Dancer's") ? 2 : 1)
    expect(attack.thrownRange).toBe(name.includes("Dancer's") ? 0 : 20)
    expect(attack.traits.includes('Reach')).toBe(name.includes("Dancer's"))
  }
  const enhanced = effectiveWeapon(c, namedCatalog, { ...owned('Shadowpiercer'), striking: 3, runes: ['Flaming'] })
  expect(enhanced.runes).toEqual(['Ghost Touch', 'Grievous', 'Flaming'])
})

it('uses Callooh Callay base dice, finesse and two-hand traits, preserves Vorpal, and applies matching deity boons', () => {
  const longsword = owned('Callooh Callay (Longsword)')
  expect(effectiveWeapon(c, namedCatalog, longsword)).toMatchObject({ potency: 3, striking: 3, runes: ['Vorpal', 'Grievous'] })
  expect(weaponAttack(c, namedCatalog, longsword).damage).toBe('4d8+2 slashing')
  expect(weaponAttack(c, namedCatalog, owned('Callooh Callay (Shortsword)')).traits).toContain('Finesse')
  const bastard = { ...owned('Callooh Callay (Bastard Sword)'), handsHeld: 2 as const }
  expect(weaponAttack(c, namedCatalog, bastard).damage).toBe('4d12+2 slashing')
  expect(weaponAttack({ ...c, deity: 'Gorum', divineIntercessions: { Gorum: ['moderate-boon'] } }, namedCatalog, bastard).traits)
    .toContain('Forceful')
  const blessed = { ...c, deity: 'Iomedae', divineIntercessions: { Iomedae: ['major-boon'] } }
  expect(weaponAttack(blessed, namedCatalog, longsword).attack).toBe(weaponAttack(c, namedCatalog, longsword).attack + 2)
  const deity: ContentEntry = { ...winter, id: 'iomedae', name: 'Iomedae', kind: 'deity', data: { favored_weapon: 'Longsword' } }
  expect(isFavoredWeapon(blessed, [...namedCatalog, deity], longsword.name)).toBe(true)
  expect(isFavoredWeapon(blessed, [...namedCatalog, deity], bastard.name)).toBe(false)
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
  expect(last).toContain('<summary>Summary ')
  expect(last).toContain('DC 11 flat check')
  expect(last).toContain('cannot regain HP')
  expect(last).toContain('<summary>Destruction ')
  expect(last).toContain('shatters above DC 20')
  for (const markup of [shadow, sword, gun, last]) expect(markup).not.toContain('Named weapon enhancement details unavailable.')
  if (!displayOnly) {
    expect(shadow).toContain('Potency <b>+4</b>')
    expect(shadow).not.toContain('aria-label="Remove Ghost Touch"')
    expect(sword).not.toContain('aria-label="Remove Vorpal"')
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
