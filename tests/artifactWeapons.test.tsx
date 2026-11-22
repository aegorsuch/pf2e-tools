import { existsSync, readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { mapAonHits } from '../src/aon'
import { artifactItemSkillBonus, effectiveWeapon, gearPickerEntries, giantWeaponClumsy, maxPropertyRunes, resistances, senses, shieldEntry, shieldStats, weaponAttack, weaponEntry, weaponHands } from '../src/builder'
import { WeaponList } from '../src/GearSection'
import { namedWeaponAbilities, namedWeaponBases, namedWeaponEnhancements } from '../src/namedWeapons'
import type { Character, OwnedWeapon } from '../src/types'

const snapshot = 'public/data/aon-pf2e.json'
const names = ['Axe of the Dwarven Lords', 'Azlanti Diamond', 'Blackaxe', 'Blade of Fallen Stars',
  'Briar', 'Callooh Callay', 'Cane of the Maelstrom', "Cayden's Tankard", 'Coldstar Pistols',
  'Final Stand', "Freedom's Flame", "Ghosthand's Comet", "Hunter's Dawn", 'Kortos Diamond',
  'Lamentation of the Faithless', "Meloth's Lifedrinker (Improved)",
  'Ovinrbaane', 'Phoenix Fighting Fan', 'Ridill', 'Serithtial', 'Shadowpiercer',
  'Soulcutter (Artifact)', "Sorshen's Sinuous Guisarme", "Spear of the Destroyer's Flame", 'Whisperer of Souls']
const c: Character = {
  id: 'test', name: 'Artifact checks', systems: ['pf2e'], className: 'Fighter', level: 1,
  abilities: { str: 14, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const own = (name: string, patch: Partial<OwnedWeapon> = {}): OwnedWeapon => ({
  id: 'artifact', name, potency: 0, striking: 0, runes: [], ...patch,
})

describe.skipIf(!existsSync(snapshot))('canonical AoN artifact weapon integration', () => {
  const hits: Parameters<typeof mapAonHits>[0] = existsSync(snapshot) ? JSON.parse(readFileSync(snapshot, 'utf8')) : []
  const entries = mapAonHits(hits, 'pf2e')

  it('reuses catalog indexes for repeated artifact weapon lookups', () => {
    const weapons = ['Briar', 'Serithtial', 'Coldstar Pistols'].map(name => own(name))
    for (const weapon of weapons) weaponEntry(entries, weapon.name)
    const scan = vi.spyOn(entries, 'filter')
    try {
      for (let i = 0; i < 12; i++) weaponEntry(entries, weapons[i % weapons.length].name)
      expect(scan).not.toHaveBeenCalled()
    } finally {
      scan.mockRestore()
    }
  })

  it('reuses artifact shield metadata across durability and description lookups', () => {
    const shield = { id: 'scale', name: 'Scale of Igroon', hardness: 20, hp: 160, damage: 0, raised: false }
    shieldEntry(entries, shield.name)
    shieldStats(shield, c, entries)
    const scan = vi.spyOn(entries, 'find')
    try {
      for (let i = 0; i < 6; i++) {
        shieldEntry(entries, shield.name)
        shieldStats(shield, c, entries)
      }
      expect(scan).not.toHaveBeenCalled()
    } finally {
      scan.mockRestore()
    }
  })

  it.each(names)('adapts %s with usable fundamentals and complete source properties', name => {
    const sourceName = name === "Meloth's Lifedrinker (Improved)" ? "Meloth's Lifedrinker" : name
    const choices = gearPickerEntries(entries, 'weapon').filter(entry => entry.data.named_weapon_source === sourceName)
    expect(choices.length, name).toBeGreaterThan(0)
    const attack = weaponAttack(c, entries, own(name))
    expect(attack.entry?.data.named_weapon, name).toBe(true)
    expect(attack.entry?.data.named_weapon_rules_missing, name).toBeFalsy()
    expect(attack.damage, name).toMatch(/^\d+d\d+/)
    const weapon = effectiveWeapon(c, entries, own(name))
    expect(weapon.runes.filter(rune => rune === 'Grievous')).toHaveLength(1)
    expect(weapon.runes.length).toBeLessThanOrEqual(Math.max(maxPropertyRunes(weapon.potency, weapon.material),
      namedWeaponEnhancements(attack.entry)?.runes.length ?? 0))
    expect(namedWeaponAbilities(attack.entry).some(ability => ability.name === 'Summary'), name).toBe(true)
  })

  it.each([0, 1, 3, 4, 7, 8, 13, 14, 19, 20, 25])('isolates Briar tier at %i points without leaking stronger powers', points => {
    const weapon = own('Briar', { briarSharpness: points })
    const attack = weaponAttack(c, entries, weapon)
    const effective = effectiveWeapon(c, entries, weapon)
    const abilities = namedWeaponAbilities(attack.entry)
    const activations = abilities.filter(ability => !['Senses', 'Summary', 'Destruction'].includes(ability.name))
    expect(effective.potency).toBe(points >= 8 ? 4 : 3)
    expect(effective.striking).toBe(points >= 4 ? 3 : 2)
    expect(effective.material).toBe('Cold Iron')
    expect(effective.runes.includes('Shifting')).toBe(points >= 1)
    expect(effective.runes.includes('Vorpal')).toBe(points >= 20)
    expect(attack.traits.includes('Intelligent')).toBe(points >= 4)
    expect(activations).toHaveLength(points >= 20 ? 4 : points >= 14 ? 3 : points >= 8 ? 2 : points >= 4 ? 1 : 0)
    const text = activations.flatMap(ability => ability.paragraphs).join(' ')
    expect(text).not.toMatch(/barkskin/i)
    if (points >= 4) {
      const rank = points >= 20 ? 8 : points >= 14 ? 6 : points >= 8 ? 4 : 2
      expect(activations[0].name).toBe('Oaken Resilience')
      expect(text).toContain(`casts rank ${rank} Oaken Resilience`)
      expect(text).toContain(`resistance ${rank} to bludgeoning and piercing damage`)
      expect(text).toContain(`weakness ${rank * 3 / 2} to fire`)
    }
    if (points >= 8) expect(text).toContain(points >= 20 ? 'DC 43' : points >= 14 ? 'DC 41' : 'DC 39')
    if (points < 20) expect(text).not.toContain('resurrects its partner')
    if (points < 14) expect(text).not.toContain('breath of life')
    expect(weaponAttack(c, entries, JSON.parse(JSON.stringify(weapon))).damage).toBe(attack.damage)
    expect(effectiveWeapon(c, entries, { ...weapon, briarSharpness: 0 }).runes).toEqual(['Grievous'])
  })

  it('switches Coldstar paired, single and merged forms, retaining magic and upgrades across reload', () => {
    for (const coldstarForm of ['Paired', 'Flame', 'Frost', 'Merged'] as const) {
      const weapon = own('Coldstar Pistols', { coldstarForm })
      const reloaded: OwnedWeapon = JSON.parse(JSON.stringify(weapon))
      const effective = effectiveWeapon(c, entries, reloaded)
      const attack = weaponAttack(c, entries, reloaded)
      expect(effective.potency).toBe(coldstarForm === 'Merged' ? 4 : 3)
      expect(attack.damage).toBe(coldstarForm === 'Merged' ? '4d6 P' : '3d6 P')
      expect(attack.range).toBe(coldstarForm === 'Merged' ? 120 : 60)
      expect(weaponHands(entries, reloaded)).toBe(coldstarForm === 'Paired' ? 2 : 1)
      expect(effective.runes).toEqual([...(coldstarForm === 'Merged' ? ['Flaming (Greater)', 'Frost (Greater)']
        : [coldstarForm === 'Frost' ? 'Frost (Greater)' : 'Flaming (Greater)']), 'Grievous'])
      expect(attack.traits).toEqual(expect.arrayContaining(['Agile', 'Concealable', 'Concussive', 'Fatal d10']))
      for (const displayOnly of [false, true]) {
        const html = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [weapon] }} entries={entries} save={() => {}} displayOnly={displayOnly} />)
        expect(html).toContain('aria-label="Coldstar Pistols form"')
        expect(html).toContain(`>Coldstar Dueling Pistol${coldstarForm === 'Paired' ? 's' : ''}</button>`)
        expect(html.includes('Flame pistol:')).toBe(coldstarForm === 'Paired')
        expect(html.includes('Frost pistol:')).toBe(coldstarForm === 'Paired')
        expect(html).not.toContain(' loaded')
      }
    }
    const weapon = own('Coldstar Pistols', { coldstarForm: 'Merged', runes: ['Holy'] })
    expect(effectiveWeapon(c, entries, weapon).runes).toContain('Holy')
    expect(weapon.runes).toEqual(['Holy'])
  })

  it('keeps Serithtial legal shapes official and uses each shape rather than bastard-sword statistics', () => {
    const picker = gearPickerEntries(entries, 'weapon').filter(entry => entry.data.named_weapon_source === 'Serithtial')
    expect(picker).toHaveLength(1)
    expect(picker[0].data.named_weapon_base).toBe('Longsword')
    const forms = namedWeaponBases(weaponEntry(entries, 'Serithtial')).map(base => `Serithtial (${base})`)
    expect(forms).toHaveLength(8)
    expect(forms.every(name => weaponEntry(entries, name)?.source === 'official')).toBe(true)
    for (const name of ['Serithtial', ...forms]) {
      expect(effectiveWeapon(c, entries, own(name, { material: 'Cold Iron' })).material).toBe('Orichalcum')
    }
    for (const displayOnly of [false, true]) {
      const html = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [own('Serithtial (Dagger)')] }}
        entries={entries} save={() => {}} displayOnly={displayOnly} />)
      if (!displayOnly) {
        expect(html).toContain('Orichalcum')
        expect(html).toContain('Built into Serithtial')
      }
      expect(html).not.toContain('aria-label="Remove Orichalcum material"')
      expect(html).not.toContain('Add material...')
    }
    const dagger = weaponAttack(c, entries, own('Serithtial (Dagger)'))
    expect(dagger.damage).toBe('4d4+2 P')
    expect(dagger.traits).toContain('Agile')
    expect(dagger.thrownRange).toBe(10)
    expect(weaponAttack(c, entries, own('Serithtial (Greatsword)')).damage).toBe('4d12+2 S')
    expect(weaponEntry(entries, 'Serithtial')?.data.named_weapon_base).toBe('Longsword')
  })

  it('uses five dice for Ghosthand and mythic striking, with no inherited fake base traits', () => {
    const ghost = weaponAttack(c, entries, own("Ghosthand's Comet"))
    expect(ghost.damage).toBe('5d8 force')
    expect(ghost.range).toBe(300)
    expect(ghost.traits).not.toContain('Versatile P')
    const guisarme = weaponAttack(c, entries, own("Sorshen's Sinuous Guisarme"))
    expect(guisarme.damage).toBe('5d10+2 S')
    expect(guisarme.traits).toContain('Twin')
    expect(effectiveWeapon(c, entries, own("Sorshen's Sinuous Guisarme")).striking).toBe(4)
  })

  it('applies carried passives, conditional giant benefits, and Azlanti progression without modifying source items', () => {
    const spear = own("Spear of the Destroyer's Flame", { stowed: true })
    expect(resistances({ ...c, weapons: [spear] }, entries)).toContainEqual({ damage: 'Fire', value: 20, source: spear.name })
    const axe = own('Axe of the Dwarven Lords')
    expect(weaponHands(entries, axe)).toBe(2)
    expect(weaponAttack(c, entries, axe).thrownRange).toBe(30)
    expect(senses({ ...c, ancestry: 'Dwarf', weapons: [axe] }, entries))
      .toContainEqual({ value: 'Greater Darkvision', source: axe.name })
    expect(senses({ ...c, ancestry: 'Dwarf', weapons: [{ ...axe, stowed: true }] }, entries)
      .some(sense => sense.source === axe.name)).toBe(false)
    const ridill = own('Ridill')
    const giant: Character = { ...c, className: 'Barbarian', subclass: 'Giant', raging: true, weapons: [ridill] }
    expect(weaponAttack(giant, entries, ridill).rageDamage).toBe(6)
    expect(giantWeaponClumsy(giant, entries)).toBe(1)
    expect(effectiveWeapon(giant, entries, ridill).material).toBe('Adamantine')
    for (const [level, value] of [[1, 1], [9, 2], [17, 3]]) {
      const character = { ...c, level, weapons: [own('Azlanti Diamond', { azlantiBond: 2 })] }
      expect(artifactItemSkillBonus(character, entries, 'Arcana')).toEqual({ source: 'Azlanti Diamond', value })
      expect(artifactItemSkillBonus(character, entries, 'Occultism')).toBeUndefined()
      expect(weaponAttack(character, entries, character.weapons[0]).entry?.level).toBe(Math.max(8, level))
      expect(effectiveWeapon(character, entries, character.weapons[0])).toMatchObject({ potency: 3, striking: 3 })
    }
    expect(weaponAttack(c, entries, own("Hunter's Dawn (Javelin)")).range).toBe(60)
    expect(weaponAttack(c, entries, own("Hunter's Dawn (Dart)")).range).toBe(40)
  })

  it('uses only improved Meloth Lifedrinker and preserves its shared curse rules', () => {
    const base = weaponAttack(c, entries, own("Meloth's Lifedrinker"))
    const improved = weaponAttack(c, entries, own("Meloth's Lifedrinker (Improved)"))
    expect(base.damage).toBe('2d8+2 S')
    expect(improved.damage).toBe('2d8+2 S')
    expect(namedWeaponAbilities(base.entry).some(ability => ability.name === 'Lifedrink')).toBe(true)
    const rules = namedWeaponAbilities(improved.entry)
    expect(rules.some(ability => ability.name === 'Lifedrink' && ability.actions === 'Reaction')).toBe(true)
    expect(rules.flatMap(ability => ability.paragraphs).join(' ')).toContain('reducing the character')
  })
})
