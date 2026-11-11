import { renderToStaticMarkup } from 'react-dom/server'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { expect, it } from 'vitest'
import { ArmorList, HandwrapsGear, WeaponList } from './GearSection'
import type { Character, ContentEntry } from './types'
import { GAUNTLET, HAFT_STRIKER_WEAPON, HANDWRAPS, HARDLIGHT_HANDWRAPS } from './supplemental'

const weapon: ContentEntry = {
  id: 'longsword', systems: ['pf2e'], kind: 'weapon', source: 'official', name: 'Longsword', level: 0,
  traits: [], description: '', data: { weapon_category: 'Martial', damage: '1d8 slashing' }, effects: [], updatedAt: 0,
}
const shifting: ContentEntry = {
  id: 'shifting', systems: ['pf2e'], kind: 'item', source: 'official', name: 'Shifting',
  level: 6, traits: [], description: '', data: { item_subcategory: 'Weapon Property Runes' }, effects: [], updatedAt: 0,
}
const character = (feats: Character['feats'], livingWeapon = false): Character => ({
  id: 'c', systems: ['pf2e'], name: 'Alex', level: 10, className: 'Fighter',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats, equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  weapons: [{ id: 'w', name: 'Longsword', potency: 3, striking: 1, runes: ['Wounding', 'Flaming'], livingWeapon }],
})

it('shows rune levels and sorts existing weapon runes alphabetically', () => {
  const c = character([])
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon, shifting]} save={() => {}} />)

  expect(markup).toContain('<option value="Shifting">Shifting (Level 6)</option>')
  expect(markup.indexOf('Remove Flaming rune')).toBeLessThan(markup.indexOf('Remove Wounding rune'))
  expect(markup).not.toContain('>Stow</button>')
  expect(markup).not.toContain('>Draw</button>')
})

it('adds free Shifting only when Living Weapon is selected on the weapon', () => {
  const feat = { name: 'Living Weapon', type: 'General Feat', level: 1 }
  const enabled = renderToStaticMarkup(<WeaponList c={character([feat], true)} entries={[weapon, shifting]} save={() => {}} />)
  expect(enabled).toContain('aria-label="Living Weapon: grant Shifting rune" checked=""')
  expect(enabled).toContain('title="Granted by Living Weapon"')
  expect(enabled).not.toContain('<option value="Shifting">')

  const disabled = renderToStaticMarkup(<WeaponList c={character([], true)} entries={[weapon, shifting]} save={() => {}} />)
  expect(disabled).not.toContain('Living Weapon: grant Shifting rune')
  expect(disabled).not.toContain('title="Granted by Living Weapon"')
})

it('omits the no-armor helper text', () => {
  const markup = renderToStaticMarkup(<ArmorList c={character([])} entries={[]} save={() => {}} />)
  expect(markup).not.toContain('No armor worn')
})

it('blocks Living Weapon on free-hand weapons even when previously enabled', () => {
  for (const trait of ['Free-Hand', 'free-hand', 'Free Hand']) {
    const c = character([{ name: 'Living Weapon', type: 'Class Feat', level: 1 }], true)
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={[{ ...weapon, traits: [trait] }, shifting]} save={() => {}} />)
    expect(markup).not.toContain('Living Weapon: grant Shifting rune')
    expect(markup).not.toContain('title="Granted by Living Weapon"')
    expect(markup).toContain('<option value="Shifting">')
  }
})

it('allows Living Weapon on ranged weapons while keeping the free-hand exclusion', () => {
  const c = character([{ name: 'Living Weapon', type: 'Class Feat', level: 1 }], true)
  c.weapons![0] = { ...c.weapons![0], name: 'Longbow', runes: [] }
  const bow: ContentEntry = {
    ...weapon, name: 'Longbow',
    data: { weapon_category: 'Martial', weapon_type: 'Ranged', range: 100, damage: '1d8 piercing' },
  }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[bow, shifting]} save={() => {}} />)
  expect(markup).toContain('aria-label="Living Weapon: grant Shifting rune" checked=""')
  expect(markup).toContain('title="Granted by Living Weapon"')
  const freeHand = renderToStaticMarkup(<WeaponList c={c} entries={[{ ...bow, traits: ['Free-Hand'] }, shifting]} save={() => {}} />)
  expect(freeHand).not.toContain('Living Weapon: grant Shifting rune')
  expect(freeHand).not.toContain('title="Granted by Living Weapon"')
})

it('keeps purchased and free Shifting runes out of weapon damage', () => {
  for (const free of [false, true]) {
    const c = character([{ name: 'Living Weapon', type: 'Class Feat', level: 1 }], free)
    c.weapons![0].runes = free ? ['Flaming'] : ['Shifting', 'Flaming']
    const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon, shifting]} save={() => {}} />)
    expect(markup).toContain('<div class="gear-damage">2d8 slashing + Flaming</div>')
    expect(markup).toContain(free ? 'title="Granted by Living Weapon"' : 'aria-label="Remove Shifting rune"')
  }
})

it('shows Impactful force damage without scaling it with striking', () => {
  for (const rune of ['Impactful', 'Impactful (Greater)', 'Greater Impactful']) {
    for (const striking of [1, 3]) {
      const c = character([])
      c.weapons![0] = { ...c.weapons![0], striking, runes: [rune, 'Shifting'] }
      const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon, shifting]} save={() => {}} />)
      expect(markup).toContain(`<div class="gear-damage">${1 + striking}d8 slashing + 1d6 force</div>`)
      expect(markup).toContain(`aria-label="Remove ${rune} rune"`)
    }
  }
})

it('provides graded rune descriptions and AoN links separately from removal', () => {
  const c = character([])
  c.weapons![0].runes = ['Impactful (Greater)']
  const impactful: ContentEntry = {
    ...shifting, id: 'impactful', name: 'Greater Impactful', level: 17,
    description: 'Greater Impactful description from synced content.',
    data: { ...shifting.data, url: 'https://2e.aonprd.com/Equipment.aspx?ID=1062' },
  }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon, impactful]} save={() => {}} />)
  expect(markup).toContain('aria-haspopup="dialog">Impactful (Greater)</button>')
  expect(markup).toContain('aria-label="Remove Impactful (Greater) rune"')
  expect(markup).toContain('<dialog')
  expect(markup).toContain(impactful.description)
  expect(markup).toContain('href="https://2e.aonprd.com/Equipment.aspx?ID=1062"')
  expect(markup).toContain('method="dialog"')
})

it('shows attack and compact damage including rune damage in the weapon summary', () => {
  const c = character([])
  c.level = 20
  c.abilities.str = 18
  c.weapons![0] = { ...c.weapons![0], name: "Dancer's Spear", striking: 3, runes: ['Shifting', 'Impactful (Greater)'] }
  const spear: ContentEntry = { ...weapon, name: "Dancer's Spear", data: { weapon_category: 'Martial', damage: '1d6 piercing' } }
  const fighter: ContentEntry = {
    ...weapon, id: 'fighter', kind: 'class', name: 'Fighter',
    data: { attack_proficiency: 'Legendary in martial weapons' },
  }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[spear, fighter]} save={() => {}} />)
  const summary = /<summary>(.*?)<\/summary>/.exec(markup)?.[1]
  expect(summary).toContain('Attack +35, Damage 4d6+4 P + 1d6 force')
  expect(summary).not.toContain('Shifting')
  expect(markup).toContain('<div class="gear-damage">4d6+4 piercing + 1d6 force</div>')
})

it('keeps Grievous visible as a rune but excludes it from both damage displays', () => {
  const c = character([])
  c.weapons![0].runes = ['Grievous', 'Impactful (Greater)']
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={() => {}} />)
  expect(markup).toContain('<div class="gear-damage">2d8 slashing + 1d6 force</div>')
  expect(markup).toContain('Damage 2d8 S + 1d6 force')
  expect(markup).toContain('aria-label="Remove Grievous rune"')
})

it('locks the feat-granted Haft Striker weapon while retaining manual removal without the feat', () => {
  const c = character([{ name: 'Haft Striker Stance', type: 'Class Feat', level: 2 }])
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon, HAFT_STRIKER_WEAPON]} save={() => {}} />)
  expect(markup).toContain('<strong>Haft Striker Stance</strong>')
  expect(markup).not.toContain('aria-label="Remove Haft Striker Stance"')
  const manual = { ...c, feats: [], weapons: [{ id: 'manual', name: HAFT_STRIKER_WEAPON.name, potency: 0, striking: 0, runes: [] }] }
  expect(renderToStaticMarkup(<WeaponList c={manual} entries={[HAFT_STRIKER_WEAPON]} save={() => {}} />))
    .toContain('aria-label="Remove Haft Striker Stance"')
})

it('locks full plate gauntlets and keeps their saved configuration when other weapons change while armor is unworn', () => {
  let c: Character = {
    ...character([]),
    armors: [{ id: 'plate', name: 'Full Plate', potency: 0, resilient: 0, runes: [], worn: true }],
  }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={save} />)
  expect(markup).toContain('<strong>Gauntlet</strong>')
  expect(markup).not.toContain('aria-label="Remove Gauntlet"')
  const gauntlet = { id: GAUNTLET.id, name: 'Gauntlet', potency: 2, striking: 1, runes: ['Flaming'] }
  c = { ...c, weapons: [...c.weapons!, gauntlet], armors: c.armors!.map((armor) => ({ ...armor, worn: false })) }
  expect(renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={save} />)).not.toContain('<strong>Gauntlet</strong>')
  const remove = findElement(WeaponList({ c, entries: [weapon], save }), (element) => element.props['aria-label'] === 'Remove Longsword')
  if (!remove) throw new Error('Missing weapon removal')
  ;(remove.props.onClick as () => void)()
  expect(c.weapons).toContainEqual(gauntlet)
})

function findElement(node: ReactNode, matches: (element: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> | undefined {
  let found: ReactElement<Record<string, unknown>> | undefined
  Children.forEach(node, (child) => {
    if (found || !isValidElement<Record<string, unknown>>(child)) return
    found = matches(child) ? child : findElement(child.props.children as ReactNode, matches)
  })
  return found
}

it('configures shared handwraps without copying inherited runes into stored attacks', () => {
  let c = character([])
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => HandwrapsGear({ c, entries: [weapon], save })
  const weapons = () => WeaponList({ c, entries: [weapon], save })
  const add = findElement(tree(), (element) => element.type === 'button' && Children.toArray(element.props.children as ReactNode).join('') === `Add ${HANDWRAPS.name}`)
  if (!add) throw new Error('Missing Add Handwraps button')
  ;(add.props.onClick as () => void)()
  const card = findElement(tree(), (element) => element.type === 'details' && element.props['aria-label'] === HANDWRAPS.name)
  if (!card) throw new Error('Missing handwrap card')
  const potency = findElement(card, (element) => element.props.label === 'Potency')
  if (!potency) throw new Error('Missing shared potency control')
  ;(potency.props.onChange as (value: number) => void)(2)
  expect(c.handwraps).toEqual({ potency: 2, striking: 0, runes: [] })
  const sword = findElement(weapons(), (element) => element.type === 'details' && element.props['aria-label'] === 'Longsword')
  const striking = findElement(sword, (element) => element.props.label === 'Striking')
  if (!striking) throw new Error('Missing sword striking control')
  ;(striking.props.onChange as (value: number) => void)(2)
  expect(c.weapons?.find((attack) => attack.name === 'Fist')).toMatchObject({ potency: 0, striking: 0, runes: [] })
  expect(c.handwraps).toEqual({ potency: 2, striking: 0, runes: [] })
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[weapon]} save={save} />)
  expect(markup).toContain(`inherited from ${HANDWRAPS.name}`)
  expect(markup).toContain('<strong>Fist</strong> <small>Attack +14, Damage 1d4 B')
  expect(markup).not.toContain(`aria-label="${HANDWRAPS.name}"`)
  expect(markup).not.toContain(`Add ${HANDWRAPS.name}`)
  expect(renderToStaticMarkup(<HandwrapsGear c={c} entries={[weapon]} save={save} />)).toContain(`aria-label="${HANDWRAPS.name}"`)
})

it('shows only compatible inherited runes on buff attacks and no removal controls on those attacks', () => {
  const c: Character = {
    ...character([{ name: 'Advanced Warden', type: 'Class Feat', level: 4, choice: 'Animal Feature' }]),
    weapons: [], activeSpells: ['Animal Feature'], handwraps: { potency: 2, striking: 1, runes: ['Wounding', 'Impactful (Greater)'] },
  }
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('<strong>Claws</strong> <small>Attack +14, Damage 2d6 S + 1d6 force, Wounding')
  expect(markup).toContain('<strong>Jaws</strong> <small>Attack +14, Damage 2d8 P + 1d6 force, Wounding')
  expect(markup).not.toContain('Claws (Animal Feature)')
  expect(markup).not.toContain('Jaws (Animal Feature)')
  expect(markup).not.toContain('aria-label="Remove Claws"')
  expect(markup).not.toContain('aria-label="Remove Jaws"')
  expect(markup).not.toContain('aria-label="Remove Wounding rune"')
  expect(renderToStaticMarkup(<HandwrapsGear c={c} entries={[]} save={() => {}} />).match(/aria-label="Remove Wounding rune"/g)).toHaveLength(1)
  expect(markup).not.toContain('Granted by Living Weapon')
  expect(markup).toContain(`title="Inherited from ${HANDWRAPS.name}"`)
})

it('never offers direct unarmed rune, potency, or striking controls, including without handwraps', () => {
  const c: Character = {
    ...character([]),
    weapons: [{ id: 'legacy-fist', name: 'Fist', potency: 3, striking: 3, runes: ['Flaming'] }],
  }
  const tree = WeaponList({ c, entries: [], save: () => {} })
  const fist = findElement(tree, (element) => element.type === 'details' && element.props['aria-label'] === 'Fist')
  expect(fist).toBeDefined()
  expect(findElement(fist, (element) => element.props.label === 'Potency' || element.props.label === 'Striking')).toBeUndefined()
  const markup = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('through handwraps in Gear')
  expect(markup).not.toContain('aria-label="Add property rune"')
  expect(markup).not.toContain('aria-label="Remove Flaming rune"')
  expect(markup).not.toContain('Flaming')
  expect(markup).toContain('Damage 1d4 B')
})

it('adds and configures hardlight handwraps in Gear with grade-based capacity and read-only inherited attack runes', () => {
  let c: Character = { ...character([]), systems: ['pf2e', 'sf2e'], weapons: [] }
  const save = (patch: Partial<Character>) => { c = { ...c, ...patch } }
  const tree = () => HandwrapsGear({ c, entries: [], save })
  const add = findElement(tree(), (element) => element.type === 'button'
    && Children.toArray(element.props.children as ReactNode).join('') === `Add ${HARDLIGHT_HANDWRAPS.name}`)
  if (!add) throw new Error('Missing Add Hardlight Handwraps button')
  ;(add.props.onClick as () => void)()
  const selectGrade = (value: string) => {
    const grade = findElement(tree(), (element) => element.props['aria-label'] === 'Hardlight handwraps grade')
    if (!grade) throw new Error('Missing Hardlight grade selector')
    ;(grade.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } })
  }
  selectGrade('Advanced')
  expect(c.handwraps).toMatchObject({ kind: 'hardlight', grade: 'Advanced', potency: 1, striking: 1 })
  c = { ...c, handwraps: { ...c.handwraps!, runes: ['Flaming', 'Impactful'] } }
  const attack = renderToStaticMarkup(<WeaponList c={c} entries={[]} save={save} />)
  expect(attack).toContain('inherited from Hardlight Handwraps')
  expect(attack).toContain('Damage 2d4 B')
  expect(attack).not.toContain('aria-label="Remove Flaming rune"')
  expect(attack).not.toContain('aria-label="Add property rune"')
  expect(renderToStaticMarkup(<HandwrapsGear c={c} entries={[]} save={save} />)).toContain('aria-label="Remove Flaming rune"')
  selectGrade('Commercial')
  expect(c.handwraps?.runes).toEqual(['Flaming'])
  const remove = findElement(tree(), (element) => element.props['aria-label'] === 'Remove Hardlight Handwraps')
  if (!remove) throw new Error('Missing Hardlight removal')
  ;(remove.props.onClick as () => void)()
  expect(c.handwraps).toBeUndefined()
})
