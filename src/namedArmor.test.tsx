import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { mapAonHit } from './aon'
import { armorClass, armorEntry, armorSaveBonus, effectiveArmor, gearPickerEntries, ownedArmors, perceptionItemBonus, resistances, savingThrowBreakdown, shieldEntry, shieldMaterialOptions, shieldStats } from './builder'
import { ArmorList } from './GearSection'
import { makeNamedArmorEntries, makeNamedShieldEntry, namedArmorAbilities } from './namedArmor'
import { specificMagicItemName } from './equipmentGroups'
import { NamedArmorAbilities } from './NamedArmorAbilities'
import type { Character, OwnedArmor, OwnedShield } from './types'

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
const bane = item("Slithermaw's Bane", [
  '**Base Armor** [Chain Shirt](/Armor.aspx?ID=6)', '---',
  'This suit of _[+2 greater resilient ](/Equipment.aspx?ID=2804) [elven chain](/Equipment.aspx?ID=2801)_ grants poison resistance 10.',
  '**Activate—Calistria’s Sting** <actions string="Reaction" /> (concentrate, divine) **Frequency** once per day; **Trigger** A creature grapples you; **Effect** 7d6 persistent poison damage; DC 34 basic Fortitude save.',
  '**Activate—Terrain Adaptation** 10 minutes (concentrate, divine) **Frequency** once per day; **Effect** You ignore non-magical difficult terrain in the chosen environment.',
].join('\n\n'), { resistances: 'poison=10', bulk: 0.1 })
const artifact = item("Slithermaw's Bane (Artifact)", [
  '---',
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
const mask = item('Shadowed Scale, the Jungle Secret', [
  '---',
  'When you wear the mask, you are always concealed while in a jungle. It can replace a Magaambyan mask.',
  '**Activate** <actions string="Single Action" /> envision; **Requirements** Your last action was a melee Strike that killed a living creature or destroyed an undead creature; **Effect** Decompose the body into soil.',
  '**Activate** <actions string="Single Action" /> Interact; **Frequency** once per hour; **Requirements** Adjacent to the body of a creature you killed that decomposed into soil; **Effect** Cast summon plant or fungus at half the slain creature’s level, rounded up.',
  '**Destruction** Stomped by the progenitor of all mokele-mbembes.',
].join('\n\n'), { usage: 'worn mask', url: '/Equipment.aspx?ID=1530' })
const entries = [leather, hide, chain, elven, embrace, bane, artifact, fortification, greaterFortification, scale, mask]
const character: Character = {
  id: 'armor-test', systems: ['pf2e'], name: 'Armor test', level: 20,
  abilities: { str: 14, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const owned = (name: string): OwnedArmor => ({ id: name, name, potency: 0, resilient: 0, runes: [], worn: true })
const shield: OwnedShield = { id: 'scale', name: scale.name, hardness: 0, hp: 0, raised: false, damage: 8 }

it('gives Ancestral Embrace built-in major weave runes and its worn Sunweave Perception bonus', () => {
  const c = { ...character, armors: [owned(embrace.name)] }
  expect(effectiveArmor(c, entries, c.armors[0]).runes).toEqual(['Moonweave (Major)', 'Sunweave (Major)'])
  expect(perceptionItemBonus(c, entries)).toBe(3)
  expect(perceptionItemBonus({ ...c, armors: [{ ...c.armors[0], worn: false }] }, entries)).toBe(0)
  const html = renderToStaticMarkup(<ArmorList c={c} entries={entries} save={() => {}} part="armor" />)
  expect(html).toContain('>Ancestral Embrace Leather Armor</button>')
  expect(html).toContain('Moonweave (Major)')
  expect(html).toContain('Sunweave (Major)')
  expect(html).not.toContain('aria-label="Remove Moonweave (Major) rune"')
  expect(html).not.toContain('aria-label="Remove Sunweave (Major) rune"')
  expect(c.armors[0].name).toBe('Ancestral Embrace')
  expect(c.armors[0].runes).toEqual([])
})

it('derives named armor bases, fundamental runes, elven construction, and immutable source metadata', () => {
  const before = JSON.stringify(entries)
  expect(gearPickerEntries(entries, 'armor').filter(entry => entry.data.named_armor).map(entry => entry.name))
    .toEqual([embrace.name, 'Ancestral Embrace Hide Armor', bane.name, artifact.name])
  expect(armorEntry(character, entries, embrace.name)?.data).toMatchObject({
    ac: 1, dex_cap: 4, named_armor_potency: 4, named_armor_resilient: 3, url: embrace.data.url, price: '',
  })
  expect(effectiveArmor(character, entries, owned(embrace.name))).toMatchObject({ potency: 4, resilient: 3 })
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

it('applies passive armor defenses only while worn, including legacy equipment-only saves', () => {
  for (const [name, damage, value, resilient] of [[embrace.name, 'Negative', 25, 3], [bane.name, 'Poison', 10, 2], [artifact.name, 'Poison', 15, 3]] as const) {
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
  expect(ownedArmors(legacy, entries).find(armor => armor.worn)?.name).toBe(embrace.name)
})

it('keeps situational effects manual and exposes source activations in expandable armor, shield, and mask details', () => {
  const c = { ...character, armors: [owned(embrace.name), { ...owned(artifact.name), worn: false }], shield }
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
  expect(namedArmorAbilities(armorEntry(c, entries, embrace.name)).map(ability => ability.actions))
    .toEqual([undefined, 'Free Action', 'Free Action', 'Two Actions', undefined])
  expect(namedArmorAbilities(armorEntry(c, entries, bane.name)).find(ability => ability.name === 'Terrain Adaptation')?.paragraphs.join(' '))
    .toContain('10 minutes')
  const maskHtml = renderToStaticMarkup(<NamedArmorAbilities entry={mask} />)
  expect(maskHtml).toContain('Concealment applies only while wearing the mask in a jungle')
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

it('keeps Ancestral Embrace names fixed, made of Grisantian Hide, with a Hide Armor variant', () => {
  const armors = makeNamedArmorEntries(entries, [fortification, greaterFortification])
  const leatherEmbrace = armors.find(a => a.name === 'Ancestral Embrace')!
  const hideEmbrace = armors.find(a => a.name === 'Ancestral Embrace Hide Armor')!
  expect(leatherEmbrace.data.named_armor_base).toBe('Leather Armor')
  expect(hideEmbrace.data.named_armor_base).toBe('Hide Armor')
  expect(hideEmbrace.data.named_armor_material).toBe('Orichalcum')
  expect(String(hideEmbrace.data.named_armor_runes).split(';')).toContain('Fortification (Greater)')
  expect(String(leatherEmbrace.data.named_armor_runes)).not.toContain('Fortification')
  expect(leatherEmbrace.description).not.toMatch(/brightly colored/i)
  expect(hideEmbrace.description).not.toMatch(/leather armor|brightly colored/i)
  const c = { ...character, armors: [{ ...owned('Ancestral Embrace Hide Armor'), material: 'Grisantian Hide' as const }] }
  const html = renderToStaticMarkup(<ArmorList c={c} entries={entries} save={() => {}} part="armor" />)
  expect(html).toContain('>Ancestral Embrace Hide Armor</button>')
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
