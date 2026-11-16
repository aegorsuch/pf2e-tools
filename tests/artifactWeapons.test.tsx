import { existsSync, readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { mapAonHits } from '../src/aon'
import { artifactItemSkillBonus, effectiveWeapon, gearPickerEntries, giantWeaponClumsy, maxPropertyRunes, resistances, senses, weaponAttack, weaponEntry, weaponHands } from '../src/builder'
import { WeaponList } from '../src/GearSection'
import { namedWeaponAbilities } from '../src/namedWeapons'
import type { Character, OwnedWeapon } from '../src/types'

const snapshot = 'public/data/aon-pf2e.json'
const names = ['Axe of the Dwarven Lords', 'Azlanti Diamond', 'Blackaxe', 'Blade of Fallen Stars',
  'Briar', 'Callooh Callay', 'Cane of the Maelstrom', "Cayden's Tankard", 'Coldstar Pistols',
  'Final Stand', "Freedom's Flame", "Ghosthand's Comet", "Hunter's Dawn", 'Kortos Diamond',
  'Lamentation of the Faithless', "Meloth's Lifedrinker", "Meloth's Lifedrinker (Improved)",
  'Ovinrbaane', 'Phoenix Fighting Fan', 'Ridill', 'Serithtial', 'Shadowpiercer',
  "Sorshen's Sinuous Guisarme", "Spear of the Destroyer's Flame", 'Whisperer of Souls']
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

  it.each(names)('adapts %s with usable fundamentals and complete source properties', name => {
    const choices = gearPickerEntries(entries, 'weapon').filter(entry => entry.data.named_weapon_source === name)
    expect(choices.length, name).toBeGreaterThan(0)
    const attack = weaponAttack(c, entries, own(name))
    expect(attack.entry?.data.named_weapon, name).toBe(true)
    expect(attack.entry?.data.named_weapon_rules_missing, name).toBeFalsy()
    expect(attack.damage, name).toMatch(/^\d+d\d+/)
    const weapon = effectiveWeapon(c, entries, own(name))
    expect(weapon.runes.length).toBeLessThanOrEqual(maxPropertyRunes(weapon.potency, weapon.material))
    expect(namedWeaponAbilities(attack.entry).some(ability => ability.name === 'Properties'), name).toBe(true)
  })

  it.each([0, 1, 3, 4, 7, 8, 13, 14, 19, 20, 25])('isolates Briar tier at %i points without leaking stronger powers', points => {
    const weapon = own('Briar', { briarSharpness: points })
    const attack = weaponAttack(c, entries, weapon)
    const effective = effectiveWeapon(c, entries, weapon)
    const abilities = namedWeaponAbilities(attack.entry)
    const activations = abilities.filter(ability => !['Properties', 'Destruction'].includes(ability.name))
    expect(effective.potency).toBe(points >= 8 ? 4 : 3)
    expect(effective.striking).toBe(points >= 4 ? 3 : 2)
    expect(effective.material).toBe('Cold Iron')
    expect(effective.runes.includes('Shifting')).toBe(points >= 1)
    expect(effective.runes.includes('Vorpal')).toBe(points >= 20)
    expect(attack.traits.includes('Intelligent')).toBe(points >= 4)
    expect(activations).toHaveLength(points >= 20 ? 4 : points >= 14 ? 3 : points >= 8 ? 2 : points >= 4 ? 1 : 0)
    const text = activations.flatMap(ability => ability.paragraphs).join(' ')
    if (points >= 8) expect(text).toContain(points >= 20 ? 'DC 43' : points >= 14 ? 'DC 41' : 'DC 39')
    if (points < 20) expect(text).not.toContain('resurrects its partner')
    if (points < 14) expect(text).not.toContain('breath of life')
    expect(weaponAttack(c, entries, JSON.parse(JSON.stringify(weapon))).damage).toBe(attack.damage)
    expect(effectiveWeapon(c, entries, { ...weapon, briarSharpness: 0 }).runes).toEqual([])
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
      expect(effective.runes).toEqual(coldstarForm === 'Merged' ? ['Flaming (Greater)', 'Frost (Greater)']
        : [coldstarForm === 'Frost' ? 'Frost (Greater)' : 'Flaming (Greater)'])
      expect(attack.traits).toEqual(expect.arrayContaining(['Agile', 'Concealable', 'Concussive', 'Fatal d10']))
      for (const displayOnly of [false, true]) {
        const html = renderToStaticMarkup(<WeaponList c={{ ...c, weapons: [weapon] }} entries={entries} save={() => {}} displayOnly={displayOnly} />)
        expect(html).toContain('aria-label="Coldstar Pistols form"')
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
    const forms = gearPickerEntries(entries, 'weapon').filter(entry => entry.data.named_weapon_source === 'Serithtial')
    expect(forms).toHaveLength(8)
    expect(forms.every(entry => entry.source === 'official')).toBe(true)
    const dagger = weaponAttack(c, entries, own('Serithtial (Dagger)'))
    expect(dagger.damage).toBe('4d4+2 P')
    expect(dagger.traits).toContain('Agile')
    expect(dagger.thrownRange).toBe(10)
    expect(weaponAttack(c, entries, own('Serithtial (Greatsword)')).damage).toBe('4d12+2 S')
    expect(weaponEntry(entries, 'Serithtial')?.data.named_weapon_base).toBe('Bastard Sword')
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

  it('does not grant Improved Meloth powers to the dormant sword or omit shared curse rules', () => {
    const base = weaponAttack(c, entries, own("Meloth's Lifedrinker"))
    const improved = weaponAttack(c, entries, own("Meloth's Lifedrinker (Improved)"))
    expect(base.damage).toBe('1d8+2 S')
    expect(improved.damage).toBe('2d8+2 S')
    expect(namedWeaponAbilities(base.entry).some(ability => ability.name === 'Lifedrink')).toBe(false)
    const rules = namedWeaponAbilities(improved.entry)
    expect(rules.some(ability => ability.name === 'Lifedrink' && ability.actions === 'Reaction')).toBe(true)
    expect(rules.flatMap(ability => ability.paragraphs).join(' ')).toContain('reducing the character')
  })
})
