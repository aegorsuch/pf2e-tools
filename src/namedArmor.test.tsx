import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { mapAonHit } from './aon'
import { armorClass, armorEntry, armorSaveBonus, effectiveArmor, gearPickerEntries, ownedArmors, perceptionItemBonus, resistances, savingThrowBreakdown, shieldAcBonus, shieldEntry, shieldMaterialOptions, shieldStats, speedBonuses } from './builder'
import { ArmorList } from './GearSection'
import { makeNamedArmorEntries, makeNamedShieldEntry, namedArmorAbilities, SCALE_OF_IGROON_FORTRESS } from './namedArmor'
import { specificMagicItemName } from './equipmentGroups'
import { NamedArmorAbilities } from './NamedArmorAbilities'
import type { Character, ContentEntry, OwnedArmor, OwnedShield } from './types'

const item = (name: string, markdown: string, extra: Record<string, unknown> = {}) => mapAonHit({
  _id: name, _source: { category: 'equipment', name, markdown, level: 20, trait: ['Invested', 'Artifact'], ...extra },
}, 'pf2e')!
const leather = mapAonHit({ _id: 'armor-41', _source: { category: 'armor', name: 'Leather Armor',
  ac: 1, dex_cap: 4, strength: 0, armor_category: 'Light', armor_group: 'Leather', bulk: 1, check_penalty: -1 } }, 'pf2e')!
const hide = mapAonHit({ _id: 'armor-42', _source: { category: 'armor', name: 'Hide Armor',
  ac: 3, dex_cap: 2, strength: 2, armor_category: 'Medium', armor_group: 'Composite', bulk: 2, check_penalty: -2, speed_penalty: -5 } }, 'pf2e')!
const chain = mapAonHit({ _id: 'armor-43', _source: { category: 'armor', name: 'Chain Shirt',
  ac: 2, dex_cap: 3, strength: 1, armor_category: 'Light', armor_group: 'Chain', bulk: 1,
  check_penalty: -1, trait: ['Flexible', 'Noisy'] } }, 'pf2e')!
const elven = item('Elven Chain', "Elven chain is a [chain shirt](/Armor.aspx?ID=6) made of dawnsilver. It has no check penalty. Unlike other chain shirts, elven chain doesn’t have the noisy trait.")
const embrace = item('Ancestral Embrace', [
  '**Base Armor** [Leather Armor](/Armor.aspx?ID=4)', '---',
  'This brightly colored _+4 [major resilient](/Equipment.aspx?ID=279) [leather armor](/Armor.aspx?ID=4)_ grants negative resistance 25 when invested.',
  '**Activate** <actions string="Free Action" /> envision; **Frequency** once per day; **Effect** You gain an additional use of an ancestry feat.',
  '**Activate** <actions string="Free Action" /> envision; **Effect** Reduce legend lore casting time to 1 hour.',
  '**Activate** <actions string="Two Actions" /> command, Interact; **Frequency** once per day; **Effect** The armor casts avatar; Speed 70 feet.',
  '**Destruction** Six generations.',
].join('\n\n'), { resistances: 'negative=25', url: '/Equipment.aspx?ID=1528' })
const hideEmbraceName = 'Ancestral Embrace Hide Armor'
const bane = item("Slithermaw's Bane", [
  '**Base Armor** [Chain Shirt](/Armor.aspx?ID=6)', '---',
  'This suit of _[+2 greater resilient ](/Equipment.aspx?ID=2804) [elven chain](/Equipment.aspx?ID=2801)_ grants poison resistance 10.',
  '**Activate—Calistria’s Sting** <actions string="Reaction" /> (concentrate, divine) **Frequency** once per day; **Trigger** A creature grapples you; **Effect** 7d6 persistent poison damage; DC 34 basic Fortitude save.',
  '**Activate—Terrain Adaptation** 10 minutes (concentrate, divine) **Frequency** once per day; **Effect** You ignore non-magical difficult terrain in the chosen environment.',
].join('\n\n'), { resistances: 'poison=10', bulk: 0.1 })
const artifact = item("Slithermaw's Bane (Artifact)", [
  '**Usage** worn armor', '---',
  '**Perception** +34; precise low-light vision and hearing within 30 feet', '**Will** +34', '---',
  '_Slithermaw’s Bane_ is a suit of _[+3 major resilient ](/Equipment.aspx?ID=2804) [greater fortification](/Equipment.aspx?ID=2789) high-grade [elven chain](/Equipment.aspx?ID=2801)_ that grants poison resistance 15.',
  '**Activate—Calistria’s Sting** <actions string="Reaction" /> (concentrate, poison) **Frequency** once per day; **Effect** 7d6 persistent poison damage.',
  '**Activate—Purge Toxins** <actions string="Two Actions" /> (concentrate) **Frequency** once per minute; **Effect** Counteract rank 9th, +25 modifier (+30 against fiend sources).',
  '**Activate—Adaptation** <actions string="Two Actions" /> (concentrate) **Frequency** once per hour; **Effect** +2 circumstance bonus to saves against environmental hazards from the chosen terrain.',
].join('\n\n'), { resistances: 'poison=15', bulk: 0.1 })
const fortification = item('Fortification', 'This property thickens the armor, increasing its Bulk by 1 and the Strength modifier require to reduce its penalties by 1.',
  { item_subcategory: 'Armor Property Runes' })
const greaterFortification = { ...fortification, id: 'greater-fortification', name: 'Fortification (Greater)', level: 18 }
const scale = item('Scale of Igroon', [
  '---',
  'A _scale of Igroon_ (Hardness 20, HP 160, BT 80) recovers 4 Hit Points at the start of its wielder’s turn. Shield Block can block acid, cold, electricity, fire, force, sonic, and physical damage.',
  '**Activate** <actions string="Single Action" /> (manipulate) **Requirements** Bright or dim light; **Effect** +4 item bonus to Stealth to Hide and Sneak until your next turn; ends on Shield Block or another activation.',
  '**Activate** <actions string="Single Action" /> (manipulate) **Requirements** Bright light; **Effect** DC 42 Fortitude, blinded.',
  '**Activate** <actions string="Free Action" /> (manipulate) **Trigger** Shield Block prevents energy damage from a line, ray, or direct attack; **Effect** Reflect the energy.',
  '**Destruction** Stomped in absolute darkness.',
].join('\n\n'), { usage: 'held in 1 hand', url: '/Equipment.aspx?ID=2365' })
const fortressShield: ContentEntry = { id: 'fortress-shield', name: 'Fortress Shield', kind: 'shield', source: 'official',
  systems: ['pf2e'], level: 0, traits: [], description: '', data: { ac: 3, bulk: 5, hands: '2', speed_penalty: -10 },
  effects: [], updatedAt: 0 }
const mask = item('Shadowed Scale, the Jungle Secret', [
  '---',
  'When you wear the mask, you are always concealed while in a jungle. It can replace a Magaambyan mask.',
  '**Activate** <actions string="Single Action" /> envision; **Requirements** Your last action was a melee Strike that killed a living creature or destroyed an undead creature; **Effect** Decompose the body into soil.',
  '**Activate** <actions string="Single Action" /> Interact; **Frequency** once per hour; **Requirements** Adjacent to the body of a creature you killed that decomposed into soil; **Effect** Cast summon plant or fungus at half the slain creature’s level, rounded up.',
  '**Destruction** Stomped by the progenitor of all mokele-mbembes.',
].join('\n\n'), { usage: 'worn mask', url: '/Equipment.aspx?ID=1530' })
const entries = [leather, hide, chain, elven, embrace, bane, artifact, fortification, greaterFortification, scale, fortressShield, mask]
const character: Character = {
  id: 'armor-test', systems: ['pf2e'], name: 'Armor test', level: 20,
  abilities: { str: 14, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const owned = (name: string): OwnedArmor => ({ id: name, name, potency: 0, resilient: 0, runes: [], worn: true })
const shield: OwnedShield = { id: 'scale', name: scale.name, hardness: 0, hp: 0, raised: false, damage: 8 }

it('gives Ancestral Embrace built-in major weave runes and its worn Sunweave Perception bonus', () => {
  const c = { ...character, armors: [owned(hideEmbraceName)] }
  expect(effectiveArmor(c, entries, c.armors[0]).runes).toEqual(['Moonweave (Major)', 'Sunweave (Major)'])
  expect(perceptionItemBonus(c, entries)).toBe(3)
  expect(perceptionItemBonus({ ...c, armors: [{ ...c.armors[0], worn: false }] }, entries)).toBe(0)
  const html = renderToStaticMarkup(<ArmorList c={c} entries={entries} save={() => {}} part="armor" />)
  expect(html).toContain('>Ancestral Embrace Hide Armor</button>')
  expect(html).toContain('major resilient hide armor grants negative resistance 25')
  expect(html).not.toContain('<summary>Summary')
  expect(html).toContain('<summary>Activation')
  expect(html).toContain('Moonweave (Major)')
  expect(html).toContain('Sunweave (Major)')
  expect(html).not.toContain('aria-label="Remove Moonweave (Major) rune"')
  expect(html).not.toContain('aria-label="Remove Sunweave (Major) rune"')
  expect(c.armors[0].name).toBe(hideEmbraceName)
  expect(c.armors[0].runes).toEqual([])
})

it('shows ordinary armor descriptions without a Summary toggle', () => {
  const described = { ...leather, description: 'Flexible leather armor.' }
  const c = { ...character, armors: [owned(described.name)] }
  const html = renderToStaticMarkup(<ArmorList c={c} entries={[described]} save={() => {}} part="armor" />)
  expect(html).toContain('<small>Flexible leather armor.</small>')
  expect(html).not.toContain('<summary>Summary</summary>')
})

it('derives named armor bases, fundamental runes, elven construction, and immutable source metadata', () => {
  const before = JSON.stringify(entries)
  expect(gearPickerEntries(entries, 'armor').filter(entry => entry.data.named_armor).map(entry => entry.name))
    .toEqual([hideEmbraceName, bane.name, artifact.name])
  expect(armorEntry(character, entries, hideEmbraceName)?.data).toMatchObject({
    ac: 3, dex_cap: 2, named_armor_potency: 4, named_armor_resilient: 3,
    named_armor_rune_limit: 3, url: embrace.data.url, price: '',
  })

  expect(effectiveArmor(character, entries, owned(hideEmbraceName))).toMatchObject({ potency: 4, resilient: 3 })
  expect(effectiveArmor(character, entries, owned(bane.name))).toMatchObject({ potency: 2, resilient: 2 })
  const upgraded = { ...owned(artifact.name), potency: 4, runes: ['Shadow', 'Fortification (Greater)'] }
  expect(effectiveArmor(character, entries, upgraded)).toMatchObject({
    potency: 4, resilient: 3, runes: ['Fortification (Greater)', 'Shadow'],
  })
  const generated = armorEntry(character, entries, artifact.name)!
  expect(generated.data).toMatchObject({ ac: 2, dex_cap: 3, check_penalty: 0, strength: 2, bulk: 1.1 })
  expect(generated.traits).toContain('Flexible')
  expect(generated.traits).not.toContain('Noisy')
  expect(JSON.stringify(entries)).toBe(before)
  expect(upgraded.runes).toEqual(['Shadow', 'Fortification (Greater)'])
})

it('builds a Fortress Shield variant that retains Scale of Igroon effects and adds its profile', () => {
  const variant = makeNamedShieldEntry(entries, SCALE_OF_IGROON_FORTRESS)!
  expect(variant).toMatchObject({ name: SCALE_OF_IGROON_FORTRESS, kind: 'shield',
    data: { ac: 3, bulk: 5, speed_penalty: -10, hardness: 20, hp: 160, bt: 80, named_shield_fortress: true } })
  expect(variant.description).toContain('Fortress Shield profile')
  const shield: OwnedShield = { id: variant.id, name: variant.name, hardness: 20, hp: 160, damage: 0,
    equipped: true, raised: true, takingCover: true }
  const c = { ...character, shield }
  expect(shieldAcBonus(c, entries)).toBe(4)
  expect(shieldAcBonus({ ...c, shield: { ...shield, raised: false } }, entries)).toBe(3)
  expect(speedBonuses(c, entries)).toContainEqual({ source: 'Fortress Shield', feet: -10 })
  const markup = renderToStaticMarkup(<ArmorList c={c} entries={entries} save={() => {}} part="shield" />)
  expect(markup).toContain('aria-label="Taking Cover behind Fortress Shield"')
  expect(markup).toContain('Take Cover (+1 AC)')
})

it('automatically applies Great Shield Mastery while eligible shields are raised', () => {
  const feat = { name: 'Great Shield Mastery', type: 'Class Feat', level: 20 }
  const tower: ContentEntry = { ...fortressShield, id: 'tower', name: 'Tower Shield', data: { ac: 2 } }
  const other: ContentEntry = { ...tower, id: 'other', name: 'Custom Cover Shield',
    description: 'Take Cover behind this shield to gain a +5 circumstance bonus to AC.' }
  const ordinary: ContentEntry = { ...tower, id: 'ordinary', name: 'Steel Shield' }
  const allEntries = [...entries, tower, other, ordinary]
  for (const [name, base, cover] of [[tower.name, 2, 4], [fortressShield.name, 3, 4],
    [SCALE_OF_IGROON_FORTRESS, 3, 4], [other.name, 2, 5], [ordinary.name, 2, 2]] as const) {
    const shield: OwnedShield = { id: name, name, hardness: 6, hp: 24, damage: 0, equipped: true, raised: true }
    const c = { ...character, shield, feats: [feat] }
    expect(shieldAcBonus(c, allEntries)).toBe(cover)
    expect(shieldAcBonus({ ...c, shield: { ...shield, raised: false } }, allEntries)).toBe(base)
    expect(shieldAcBonus({ ...c, feats: [] }, allEntries)).toBe(base)
    expect(shieldAcBonus({ ...c, level: 19 }, allEntries)).toBe(base)
    expect(armorClass(c, allEntries) - armorClass({ ...c, shield: { ...shield, raised: false } }, allEntries)).toBe(cover)
  }
  const c = { ...character, shield: { ...shield, name: SCALE_OF_IGROON_FORTRESS, raised: true }, feats: [feat] }
  expect(renderToStaticMarkup(<ArmorList c={c} entries={allEntries} save={() => {}} part="shield" />))
    .not.toContain('aria-label="Taking Cover behind Fortress Shield"')
})

it('applies passive armor defenses only while worn, including legacy equipment-only saves', () => {
  for (const [name, damage, value, resilient] of [[hideEmbraceName, 'Negative', 25, 3], [bane.name, 'Poison', 10, 2], [artifact.name, 'Poison', 15, 3]] as const) {
    const c = { ...character, armors: [owned(name)], equipment: [{ name, qty: 1 }] }
    expect(resistances(c, entries)).toEqual([{ damage, value, source: name }])
    expect(resistances({ ...c, armors: [{ ...owned(name), worn: false }] }, entries)).toEqual([])
    expect(armorSaveBonus(c, entries)).toBe(resilient)
    expect(savingThrowBreakdown(c, entries, 'Fortitude').parts.find(part => part.label.includes('resilient'))?.value).toBe(resilient)
    const legacy = { ...character, equipment: [{ name, qty: 1 }] }
    expect(ownedArmors(legacy, entries)[0]).toMatchObject({ name, worn: true, resilient })
    expect(resistances(legacy, entries)).toEqual([{ damage, value, source: name }])
    expect(armorClass(legacy, entries)).toBe(armorClass(c, entries))
  }
  const legacy = { ...character, equipment: [{ name: bane.name, qty: 1 }, { name: embrace.name, qty: 1 }] }
  expect(ownedArmors(legacy, entries).find(armor => armor.worn)?.name).toBe(hideEmbraceName)
})

it('keeps situational effects manual and exposes source activations in expandable armor, shield, and mask details', () => {
  const c = { ...character, armors: [owned(hideEmbraceName), { ...owned(artifact.name), worn: false }], shield }
  const html = renderToStaticMarkup(<ArmorList c={c} entries={entries} save={() => {}} />)
  expect(html).toContain('Potency <b>+4</b>')
  expect(html).toContain('Built into Slithermaw')
  expect(html).toContain('High-grade dawnsilver elven chain')
  expect(html).toContain('<summary>Calistria’s Sting ')
  expect(html).toContain('<summary>Purge Toxins ')
  expect(html).toContain('Counteract rank 9th')
  expect(html).not.toContain('additional +1 item bonus only on saves versus poison')
  expect(html).not.toContain('tracked manually')
  expect(html).toContain('Hardness 20; Hit Points 160; Broken Threshold 80')
  expect(html).toContain('Recover 4 HP (start of wielder’s turn)')
  expect(namedArmorAbilities(armorEntry(c, entries, hideEmbraceName)).map(ability => ability.actions))
    .toEqual([undefined, 'Free Action', 'Free Action', 'Two Actions', undefined])
  expect(namedArmorAbilities(armorEntry(c, entries, bane.name)).find(ability => ability.name === 'Terrain Adaptation')?.paragraphs.join(' '))
    .toContain('10 minutes')
  const maskHtml = renderToStaticMarkup(<NamedArmorAbilities entry={mask} />)
  expect(maskHtml).not.toContain('Concealment applies only while wearing the mask in a jungle, not everywhere')
  expect(maskHtml).toContain('once per hour')
  expect(maskHtml).toContain('rounded up')
  expect(maskHtml).toContain('aria-label="Single Action"')
  expect(gearPickerEntries(entries, 'armor').some(entry => entry.name === mask.name)).toBe(false)
  expect(gearPickerEntries(entries, 'shield').some(entry => entry.name === scale.name)).toBe(true)
})

it('uses source shield durability and preserves saved base stats without material or rune upgrades', () => {
  expect(shieldStats(shield, character, entries)).toMatchObject({ hardness: 20, hp: 160 })
  expect(shieldStats({ ...shield, hardness: 25, hp: 200 }, character, entries)).toMatchObject({ hardness: 25, hp: 200 })
  expect(shieldStats({ ...shield, material: { name: 'Custom material', hardness: 50, hp: 500 },
    reinforcingRune: 'Supreme' }, character, entries)).toMatchObject({ hardness: 20, hp: 160 })
  expect(shieldMaterialOptions(entries, shield, character.systems)).toEqual([])
  expect(shieldEntry(entries, scale.name)?.data.url).toBe(scale.data.url)
  expect(armorSaveBonus({ ...character, shield }, entries)).toBe(0)
  expect(resistances({ ...character, shield, equipment: [{ name: mask.name, qty: 1 }] }, entries)).toEqual([])
  expect(makeNamedArmorEntries([embrace], [])).toEqual([])
  expect(makeNamedArmorEntries([chain, artifact], [{ name: 'Fortification (Greater)' }])).toEqual([])
  expect(makeNamedArmorEntries([chain, elven, artifact], [{ name: 'Fortification' }])[0].data.named_armor_runes)
    .toBe('Fortification (Greater)')
  expect(makeNamedShieldEntry([{ ...scale, description: 'Unavailable rules.' }], scale.name)).toBeUndefined()
})

it('keeps only artifact Ancestral Embrace Hide Armor with a three-property-rune cap', () => {
  const armors = makeNamedArmorEntries(entries, [fortification, greaterFortification])
  expect(armors.filter(a => a.name.includes('Ancestral Embrace')).map(a => a.name)).toEqual([hideEmbraceName])
  const hideEmbrace = armors.find(a => a.name === hideEmbraceName)!
  expect(hideEmbrace.data.named_armor_base).toBe('Hide Armor')
  expect(hideEmbrace.data.named_armor_material).toBe('Orichalcum')
  expect(hideEmbrace.traits).toContain('Artifact')
  expect(String(hideEmbrace.data.named_armor_runes).split(';')).toEqual([
    'Moonweave (Major)', 'Sunweave (Major)',
  ])
  expect(hideEmbrace.description).not.toMatch(/brightly colored/i)
  expect(hideEmbrace.description).not.toMatch(/leather armor|brightly colored/i)
  const c = { ...character, armors: [{ ...owned(hideEmbraceName), material: 'Grisantian Hide' as const }] }
  const html = renderToStaticMarkup(<ArmorList c={c} entries={entries} save={() => {}} part="armor" />)
  expect(html).toContain(`>${hideEmbraceName}</button>`)
  expect(html).toContain('aria-label="Add property rune"')
  expect(effectiveArmor(c, entries, { ...c.armors[0], runes: ['Shadow', 'Acid Resistant'] }).runes)
    .toEqual(['Moonweave (Major)', 'Sunweave (Major)', 'Shadow'])
})

it("labels Slithermaw's Bane as an Elven Chain Shirt", () => {
  const generated = armorEntry(character, entries, bane.name)!
  expect(specificMagicItemName(generated)).toBe("Slithermaw's Bane Elven Chain Shirt")
})

it("gives Slithermaw's Bane the major weave runes and Orichalcum", () => {
  const generated = armorEntry(character, entries, bane.name)!
  expect(String(generated.data.named_armor_runes).split(';')).toEqual(expect.arrayContaining(['Moonweave (Major)', 'Sunweave (Major)']))
  expect(generated.data.named_armor_material).toBe('Orichalcum')
})

it("orders Slithermaw's Bane artifact sections as senses, summary, then alphabetized activations", () => {
  const abilities = namedArmorAbilities({ ...artifact, data: { ...artifact.data, named_armor: true } })
  expect(abilities.map(ability => ability.name)).toEqual(['Senses', 'Summary', 'Adaptation', "Calistria’s Sting", 'Purge Toxins'])
  expect(abilities[0].paragraphs).toEqual(['Perception +34; precise low-light vision and hearing within 30 feet', 'Will +34'])
})
