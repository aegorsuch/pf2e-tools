import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { mapAonHit } from './aon'
import { fetchAonHits } from './aonQuery'
import { FeatChoice } from './FeatChoice'
import { EntryDescription } from './EntryDescription'
import { SearchableSelect } from './SearchableSelect'
import { FeatSlots } from './FeatSlots'
import { LanguagesSection } from './LanguagesSection'
import { SpellsSection } from './SpellsSection'
import { canSelectWardenFeat, compareFeatSelections, featDisplayName, grantedWardenSpells, selectedFeatEntry, spellWardenLabel, wardenSpellOptions } from './featChoices'
import { featSelectionPrerequisiteChecker, plannedSlots, activeFeatsNamed, classSpellSlots, eligibleFeats, focusSpells, languageAllowance, migrateAncestralLinguistics, wizardArchetypeSpellbookChoices } from './builder'
import { classSpellcasting, featChoiceOptions, movementSpeeds, ranksAt, researchedSpellResistanceChoices, resistances, senses, weaponAttack } from './builder'
import { grantedFeatSpells, unresolvedFeatSpells } from './featSpells'
import type { Character, ContentEntry } from './types'
import { getSettings, updateSettings } from './settings'
import { PILOTING_INTERFACES } from './supplemental'

const spell = (name: string, tier: string): ContentEntry => ({
  id: name, systems: ['pf2e'], kind: 'spell', source: 'official', name, level: tier === 'Initiate' ? 1 : 2,
  traits: ['Focus', 'Ranger'], description: '', data: { warden_spell_tier: tier }, effects: [], updatedAt: 1,
})
const entries = [spell('Gravity Weapon', 'Initiate'), spell('Heal Companion', 'Initiate'), spell('Animal Feature', 'Advanced')]
const base: Character = {
  id: 'c', systems: ['pf2e'], name: 'Alex', level: 1, className: 'Ranger',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}

it('restricts Beastmaster Warden variants and removes legacy Heal Animal without restricting Ranger Warden choices', () => {
  const previous = getSettings().disableBeastmasterWardenSpells
  const dedication: ContentEntry = { ...spell('Beastmaster Dedication', 'Initiate'), kind: 'feat', level: 2,
    traits: ['Archetype', 'Dedication'], data: { archetype: 'Beastmaster' } }
  const initiate: ContentEntry = { ...dedication, id: 'initiate', name: 'Initiate Warden', level: 1,
    traits: ['Ranger'], data: { archetype: 'Beastmaster', archetype_levels: 'Beastmaster: 4', repeatable: true } }
  const advanced: ContentEntry = { ...initiate, id: 'advanced', name: 'Advanced Warden', level: 4,
    data: { archetype: 'Beastmaster', archetype_levels: 'Beastmaster: 6', prerequisite: initiate.name, repeatable: true } }
  const legacy: ContentEntry = { ...dedication, id: 'legacy', name: 'Heal Animal', level: 4, traits: ['Archetype'] }
  const trance: ContentEntry = { ...legacy, id: 'trance', name: "Beastmaster's Trance", level: 6 }
  const catalog = [dedication, initiate, advanced, legacy, trance, ...entries, spell('Magic Hide', 'Initiate')]
  const c: Character = { ...base, className: 'Champion', level: 20,
    feats: [{ name: dedication.name, type: 'Dedication Feat', level: 2, slot: 'archetype:2:0' }] }
  const slot = { key: 'archetype:20:0', category: 'archetype' as const, level: 20 }
  const before = JSON.stringify(c)
  try {
    updateSettings({ disableBeastmasterWardenSpells: true })
    expect(featChoiceOptions(initiate.name, c, catalog, slot.key)).toEqual(['Heal Companion', 'Magic Hide'])
    expect(featChoiceOptions(initiate.name, c, catalog, 'class:20:0', undefined, 'archetype'))
      .toEqual(['Heal Companion', 'Magic Hide'])
    expect(featChoiceOptions(initiate.name, { ...c, className: 'Ranger' }, catalog, 'class:20:0'))
      .toEqual(['Gravity Weapon', 'Heal Companion', 'Magic Hide'])
    for (const includeUnmetPrerequisites of [false, true]) {
      const offered = eligibleFeats(catalog, c, slot, { includeUnmetPrerequisites })
      expect(offered).toContain(initiate)
      expect(offered).not.toContain(advanced)
      expect(offered).not.toContain(legacy)
      expect(offered).toContain(trance)
    }
    const render = () => renderToStaticMarkup(<FeatSlots c={c} entries={catalog} categories={['archetype']} save={() => {}}
      search={{ 'archetype:20:0:open': '1' }} onSearch={() => {}} />)
    expect(render()).toContain('Initiate Warden (Heal Companion)')
    expect(render()).toContain('Initiate Warden (Magic Hide)')
    expect(render()).not.toContain('Initiate Warden (Gravity Weapon)')
    expect(render()).not.toContain('Heal Animal')
    updateSettings({ disableBeastmasterWardenSpells: false })
    expect(featChoiceOptions(initiate.name, c, catalog, slot.key)).toEqual(['Gravity Weapon', 'Heal Companion', 'Magic Hide'])
    expect(eligibleFeats(catalog, c, slot, { includeUnmetPrerequisites: true })).toContain(advanced)
    expect(render()).toContain('Initiate Warden (Gravity Weapon)')
    expect(JSON.stringify(c)).toBe(before)
  } finally { updateSettings({ disableBeastmasterWardenSpells: previous }) }
})

it('exhausts only allowed Beastmaster Warden choices without consuming them for empty Ranger class slots', () => {
  const previous = getSettings().disableBeastmasterWardenSpells
  const catalog = [...entries, spell('Magic Hide', 'Initiate')]
  const c: Character = { ...base, level: 20, feats: ['Heal Companion', 'Magic Hide'].map((choice, i) => ({
    name: 'Initiate Warden', type: 'Dedication Feat', level: 1, slot: `archetype:4:${i}`, choice,
  })) }
  try {
    updateSettings({ disableBeastmasterWardenSpells: true })
    expect(canSelectWardenFeat('Initiate Warden', c, catalog, 'archetype:6:0', true)).toBe(false)
    expect(canSelectWardenFeat('Initiate Warden', c, catalog, 'class:6:0')).toBe(true)
    const emptyNative = { ...c, feats: [0, 1].map(i => ({
      name: 'Initiate Warden', type: 'Class Feat', level: 1, slot: `class:1:${i}`,
    })) }
    expect(canSelectWardenFeat('Initiate Warden', emptyNative, catalog, 'archetype:6:0', true)).toBe(true)
    updateSettings({ disableBeastmasterWardenSpells: false })
    expect(canSelectWardenFeat('Initiate Warden', c, catalog, 'archetype:6:0', true)).toBe(true)
  } finally { updateSettings({ disableBeastmasterWardenSpells: previous }) }
})

it.each(['feat', 'spell'] as const)('displays Litany against Wrath without renaming its saved %s identity', kind => {
  const entry: ContentEntry = { ...spell('Litany Against Wrath', 'Initiate'), kind }
  const before = JSON.stringify(entry)
  expect(featDisplayName(entry)).toBe('Litany against Wrath')
  const markup = renderToStaticMarkup(<EntryDescription name={entry.name} entry={entry} />)
  expect(markup).toContain('>Litany against Wrath</button>')
  expect(markup).not.toContain('>Litany Against Wrath</button>')
  expect(JSON.stringify(entry)).toBe(before)
})

it('displays Nimble Feet without changing the saved feat identity', () => {
  const entry: ContentEntry = { ...spell('Nimble Hooves', 'Initiate'), kind: 'feat' }
  expect(featDisplayName(entry)).toBe('Nimble Feet')
  expect(featDisplayName(entry, 'Nimble Hooves (variant)')).toBe('Nimble Feet (variant)')
  expect(renderToStaticMarkup(<EntryDescription name={entry.name} entry={entry} />)).toContain('>Nimble Feet</button>')
  expect(entry.name).toBe('Nimble Hooves')
})

it('renames Staff Acrobat feats to spear variants only while the house rule is enabled', () => {
  const previous = getSettings().staffAcrobatSpear
  try {
    updateSettings({ staffAcrobatSpear: true })
    expect(featDisplayName({ ...spell('Bullying Staff', 'Initiate'), kind: 'feat' })).toBe('Bullying Spear')
    expect(featDisplayName({ ...spell('Staff Sweep', 'Initiate'), kind: 'feat' })).toBe('Spear Sweep')
    updateSettings({ staffAcrobatSpear: false })
    expect(featDisplayName({ ...spell('Bullying Staff', 'Initiate'), kind: 'feat' })).toBe('Bullying Staff')
    expect(featDisplayName({ ...spell('Staff Sweep', 'Initiate'), kind: 'feat' })).toBe('Staff Sweep')
  } finally {
    updateSettings({ staffAcrobatSpear: previous })
  }
})

it('shows only the explicit variant row without changing shared rules, other tables, or future previews', () => {
  const entry = mapAonHit({ _id: 'variant-details', _source: { name: 'Variant Details', category: 'feat',
    markdown: 'Shared rules before.\n\n<table><tr><td>**Style**</td><td>**Skill**</td></tr>'
      + '<tr><td>Power</td><td>Athletics</td></tr><tr><td>Focus</td><td>Arcana</td></tr></table>'
      + '\n\nShared restrictions after.\n\n<table><tr><td>Level</td><td>Bonus</td></tr>'
      + '<tr><td>1</td><td>+1</td></tr><tr><td>5</td><td>+2</td></tr></table>',
  } }, 'pf2e')!
  const before = JSON.stringify(entry)
  const character = { ...base, feats: [{ name: entry.name, type: 'Skill Feat', level: 1, choice: 'Power' }] }
  const render = (choice?: string) => renderToStaticMarkup(
    <EntryDescription name={entry.name} entry={entry} character={character} choice={choice} />)
  for (const [choice, detail, excluded] of [['Power', 'Athletics', 'Arcana'], ['Focus', 'Arcana', 'Athletics']]) {
    const markup = render(choice)
    expect(markup).toContain(`${choice}: ${detail}`)
    expect(markup).not.toContain(excluded)
    expect(markup).toContain('Shared rules before.')
    expect(markup).toContain('Shared restrictions after.')
    expect(markup).toContain('Level Bonus 1 +1 5 +2')
  }
  for (const choice of [undefined, 'Unavailable saved option']) {
    expect(render(choice)).toContain('Power Athletics Focus Arcana')
  }
  expect(JSON.stringify(entry)).toBe(before)
})

it('keeps table footnotes only with the choices they actually restrict', () => {
  const entry = mapAonHit({ _id: 'crafting-options', _source: { name: 'Crafting Options', category: 'feat',
    markdown: '<row><table><tr><td>**Specialty**</td><td>**Items**</td></tr>'
      + '<tr><td>Alchemy*</td><td>Alchemical items</td></tr>'
      + '<tr><td>Stonemasonry</td><td>Stone goods and structures</td></tr></table>'
      + '<br /> * Requires [Alchemical Crafting](/Feats.aspx?ID=1) to Craft.</row>\n\nShared rules.',
  } }, 'pf2e')!
  const render = (choice: string) => renderToStaticMarkup(<EntryDescription name={entry.name} entry={entry} choice={choice} />)
  expect(render('Alchemy')).toContain('Alchemy: Alchemical items. Requires Alchemical Crafting to Craft.')
  expect(render('Stonemasonry')).toContain('Stonemasonry: Stone goods and structures')
  expect(render('Stonemasonry')).not.toContain('Alchemical Crafting')
  expect(render('Stonemasonry')).toContain('Shared rules.')
  expect(entry.description).toContain('Requires Alchemical Crafting')
})

it.each([false, true])('uses singular Tenacious Endurance wording only with the one-companion rule enabled (%s)', enabled => {
  const previous = getSettings().singleAnimalCompanion
  const description = "You encourage your companion to refuse to yield, against even the mightiest of foes. When one of your animal companions is reduced to 0 Hit Points, if it isn't wounded, it can remain standing with 1 Hit Point and become wounded 1."
  const feat: ContentEntry = { ...entries[0], kind: 'feat', name: 'Tenacious Endurance', description }
  try {
    updateSettings({ singleAnimalCompanion: enabled })
    const render = (entry = feat) => renderToStaticMarkup(<EntryDescription name={entry.name} entry={entry} />)
    const markup = render()
    expect(markup).toContain(enabled ? 'When your animal companion is reduced to 0 Hit Points'
      : 'When one of your animal companions is reduced to 0 Hit Points')
    if (enabled) expect(markup).not.toContain('one of your animal companions')
    expect(markup).toContain('remain standing with 1 Hit Point and become wounded 1')
    expect(render({ ...feat, name: 'Other Feat' })).toContain('one of your animal companions')
    expect(feat.description).toBe(description)
  } finally { updateSettings({ singleAnimalCompanion: previous }) }
})

it.each([false, true])('uses singular Heightened Instincts wording only with the one-companion rule enabled (%s)', enabled => {
  const previous = getSettings().singleAnimalCompanion
  const description = "You've worked to sharpen your companions' instincts to supernatural levels. When one of your companions rolls a success on a saving throw, it gets a critical success instead."
  const feat: ContentEntry = { ...entries[0], kind: 'feat', name: 'Heightened Instincts', description }
  try {
    updateSettings({ singleAnimalCompanion: enabled })
    const markup = renderToStaticMarkup(<EntryDescription name={feat.name} entry={feat} />)
    expect(markup).toContain(enabled ? 'When your companion rolls a success' : 'When one of your companions rolls a success')
    expect(markup).toContain(enabled ? 'your companion&#x27;s instincts' : 'your companions&#x27; instincts')
    expect(markup).toContain('on a saving throw, it gets a critical success instead.')
    expect(feat.description).toBe(description)
  } finally { updateSettings({ singleAnimalCompanion: previous }) }
})

it.each(['Elf Atavism', 'Elven Atavism'])('adds a separate Elf heritage selection for %s without replacing primary heritage', name => {
  const heritage = (name: string, ancestry: string): ContentEntry => ({ ...entries[0], id: name, name,
    kind: 'heritage', traits: [], data: { ancestry } })
  const catalog = [heritage('Cavern Elf', 'Elf'), heritage('Arctic Elf', 'Elf'), heritage('Pioneer Human', 'Human'),
    heritage('Aiuvarin', 'Elf'), { ...heritage('Missing Elf', 'Elf'), deleted: true }]
  let c: Character = { ...base, ancestry: 'Human', heritage: 'Aiuvarin',
    feats: [{ name, type: 'Ancestry Feat', level: 1 }] }
  const tree = () => FeatChoice({ c, entries: catalog, index: 0, save: patch => { c = JSON.parse(JSON.stringify({ ...c, ...patch })) } })
  expect(featChoiceOptions(name, c, catalog, '', 0)).toEqual(['Arctic Elf', 'Cavern Elf'])
  expect(renderToStaticMarkup(tree())).toContain(`aria-label="${name} heritage"`)
  findSelect(tree()).onChange({ target: { value: 'Cavern Elf' } })
  expect(c.feats[0].choice).toBe('Cavern Elf')
  expect(c.heritage).toBe('Aiuvarin')
  expect(renderToStaticMarkup(tree())).toContain('Heritage details')
  findSelect(tree()).onChange({ target: { value: 'Pioneer Human' } })
  expect(c.feats[0].choice).toBe('Cavern Elf')
  c = { ...c, feats: [{ ...c.feats[0], choice: 'Missing Elf' }] }
  expect(renderToStaticMarkup(tree())).toContain('<option disabled="" value="Missing Elf" selected="">Missing Elf</option>')
})

it('applies only the active Atavism heritage benefits while retaining primary heritage benefits', () => {
  const heritage = (name: string, data: ContentEntry['data'] = {}): ContentEntry =>
    ({ ...entries[0], id: name, name, kind: 'heritage', traits: [], data })
  const catalog = [heritage('Aiuvarin', { vision: 'Low-light Vision' }), heritage('Cavern Elf'),
    heritage('Arctic Elf', { resistances: 'cold=half' }), heritage('Desert Elf', { resistances: 'fire=half' }),
    heritage('Aquatic Elf'), heritage('Seer Elf')]
  let c: Character = { ...base, ancestry: 'Human', heritage: 'Aiuvarin', level: 9,
    feats: [{ name: 'Elf Atavism', type: 'Ancestry Feat', level: 1, choice: 'Cavern Elf' }] }
  expect(senses(c, catalog)).toEqual(expect.arrayContaining([
    { value: 'Darkvision', source: 'Cavern Elf' }, { value: 'Low-light Vision', source: 'Aiuvarin' },
  ]))
  c = { ...c, feats: [{ ...c.feats[0], choice: 'Arctic Elf' }] }
  expect(resistances(c, catalog)).toContainEqual({ damage: 'Cold', value: 4, source: 'Arctic Elf' })
  expect(senses(c, catalog).some(sense => sense.value === 'Darkvision')).toBe(false)
  c = { ...c, feats: [{ ...c.feats[0], choice: 'Desert Elf' }] }
  expect(resistances(c, catalog)).toContainEqual({ damage: 'Fire', value: 4, source: 'Desert Elf' })
  c = { ...c, feats: [{ ...c.feats[0], choice: 'Aquatic Elf' }] }
  expect(movementSpeeds(c, catalog)).toContainEqual({ name: 'Swim', feet: 30, source: 'Aquatic Elf' })
  c = { ...c, feats: [{ ...c.feats[0], choice: 'Seer Elf' }] }
  const detect: ContentEntry = { ...entries[0], name: 'Detect Magic', level: 1, traits: ['Cantrip'] }
  expect(grantedFeatSpells(c, [...catalog, detect])).toMatchObject([{
    entry: detect, source: 'Seer Elf', rank: 5, rule: { kind: 'innate', tradition: 'arcane', frequency: 'at will' },
  }])
  expect(unresolvedFeatSpells(c, catalog)).toMatchObject([{ name: 'Detect Magic', source: { name: 'Seer Elf' } }])
  const future = { ...c, feats: [{ ...c.feats[0], takenLevel: 10 }] }
  expect(grantedFeatSpells(future, [...catalog, detect])).toEqual([])
  expect(unresolvedFeatSpells(future, catalog)).toEqual([])
  expect(grantedFeatSpells({ ...c, feats: [] }, [...catalog, detect])).toEqual([])
  expect(c.heritage).toBe('Aiuvarin')
})

it('preserves full heritage rules instead of truncated catalog summaries', () => {
  const heritage = mapAonHit({ _id: 'heritage-242', _source: { category: 'heritage', name: 'Seer Elf',
    summary: 'You have an inborn ability...', markdown: 'Full heritage rules.\n\nYou gain a +1 circumstance bonus to Identify Magic.' } }, 'pf2e')
  expect(heritage?.description).toBe('Full heritage rules.\n\nYou gain a +1 circumstance bonus to Identify Magic.')
})

it.each(['Ferocity', 'Superstition', 'Warmask'])('displays %s without Orc only for active adopted-Orc characters', name => {
  const adopted = { name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Orc' }
  const c: Character = { ...base, ancestry: 'Human', feats: [adopted] }
  const render = (character: Character) => renderToStaticMarkup(<EntryDescription character={character} name={`Orc ${name}`} />)
  expect(render(c)).toContain(`aria-haspopup="dialog">${name}</button>`)
  const kinship = { name: 'Orc Kinship', type: 'Ancestry Feat', level: 1, takenLevel: 5 }
  const chain: Character = { ...c, level: 5, feats: [
    { name: 'Social Chameleon', type: 'Ancestry Feat', level: 5 },
    { ...adopted, choice: 'Dwarf', takenLevel: 5 }, kinship,
  ] }
  expect(render(JSON.parse(JSON.stringify(chain)))).toContain(`aria-haspopup="dialog">${name}</button>`)
  for (const inactive of [
    { ...chain, level: 4 },
    { ...chain, feats: chain.feats.slice(0, -1) },
    { ...chain, systems: ['sf2e'] as Character['systems'] },
    ...['Orc', 'Dromaar', 'Half-Orc'].map(ancestry => ({ ...chain, ancestry })),
  ]) expect(render(inactive)).toContain(`aria-haspopup="dialog">Orc ${name}</button>`)
  for (const character of [
    { ...c, feats: [] },
    { ...c, feats: [{ ...adopted, takenLevel: 2 }] },
    ...['Orc', 'Dromaar', 'Half-Orc'].map(ancestry => ({ ...c, ancestry })),
    { ...c, feats: [{ ...adopted, choice: 'Dwarf' }] },
  ]) expect(render(character)).toContain(`aria-haspopup="dialog">Orc ${name}</button>`)
  expect(c.feats).toEqual([adopted])
  expect(chain.feats[2]).toEqual(kinship)
})

it('skips ancestry resolution for missing and unambiguous feat sources without ignoring saved source IDs', () => {
  const ancestry = vi.fn(() => 'Human')
  const c: Character = { ...base, get ancestry() { return ancestry() } }
  const source: ContentEntry = { ...entries[0], kind: 'feat', name: 'Initiate Warden' }
  const catalog = [source]
  expect(selectedFeatEntry(c, catalog, source.name)).toBe(source)
  expect(selectedFeatEntry(c, catalog, 'Missing feat')).toBeUndefined()
  expect(selectedFeatEntry({ ...base, systems: ['sf2e'] }, catalog, source.name)).toBeUndefined()
  expect(selectedFeatEntry(c, catalog, source.name, 'missing-source')).toBeUndefined()
  c.feats = [{ name: source.name, type: 'Class Feat', level: 1, sourceId: 'missing-source' }]
  expect(selectedFeatEntry(c, catalog, source.name)).toBeUndefined()
  expect(selectedFeatEntry(c, catalog, source.name, source.id)).toBe(source)
  expect(ancestry).not.toHaveBeenCalled()
})

it('indexes repeatable choice metadata once and refreshes it with the catalog', () => {
  const repeatable = vi.fn(() => false)
  const source: ContentEntry = { ...entries[0], kind: 'feat', name: 'Custom Feat', spellGrants: undefined,
    data: { get repeatable() { return repeatable() } } }
  const catalog = [source]
  const c: Character = { ...base, feats: [{ name: source.name, type: 'Class Feat', level: 1 }] }
  expect(FeatChoice({ c, entries: catalog, index: 0, save: () => {} })).toBeNull()
  expect(FeatChoice({ c: { ...c, updatedAt: 1 }, entries: catalog, index: 0, save: () => {} })).toBeNull()
  expect(repeatable).toHaveBeenCalledTimes(1)
  expect(renderToStaticMarkup(<FeatChoice c={c} entries={[{ ...source, data: { repeatable: true } }]} index={0} save={() => {}} />))
    .toContain('Custom Feat choice')
})

it('does not show a generic choice field for Additional Follower', () => {
  const feat: ContentEntry = { ...entries[0], kind: 'feat', name: 'Additional Follower',
    spellGrants: undefined, data: { repeatable: true } }
  const c: Character = { ...base, systems: ['pf2e'], feats: [{ name: feat.name, type: 'Archetype Feat', level: 4, choice: 'saved' }] }
  expect(FeatChoice({ c, entries: [feat], index: 0, save: () => { throw new Error('Unexpected save') } })).toBeNull()
  expect(c.feats[0].choice).toBe('saved')
})

it('saves and restores a valid feat spell choice without accepting another tradition', () => {
  const source: ContentEntry = {
    ...entries[0], id: 'magic', kind: 'feat', name: 'Otherworldly Magic', traits: [], data: {},
    spellGrants: [{ kind: 'innate', spells: [], choice: 'cantrip', tradition: 'Arcane', frequency: 'at will', heightened: true }],
  }
  const catalog: ContentEntry[] = [source,
    { ...entries[0], id: 'light', name: 'Light', traits: ['Cantrip'], data: { tradition: 'Arcane' } },
    { ...entries[0], id: 'primal', name: 'Primal Cantrip', traits: ['Cantrip'], data: { tradition: 'Primal' } }]
  let c: Character = { ...base, feats: [{ name: source.name, type: 'Ancestry Feat', level: 1 }] }
  const tree = () => FeatChoice({ c, entries: catalog, index: 0, save: patch => { c = { ...c, ...patch } } })
  findSelect(tree())!.onChange({ target: { value: 'Primal Cantrip' } })
  expect(c.feats[0].choice).toBeUndefined()
  findSelect(tree())!.onChange({ target: { value: 'Light' } })
  c = JSON.parse(JSON.stringify(c))
  expect(c.feats[0].choice).toBe('Light')
  expect(renderToStaticMarkup(tree())).toContain('<option selected="">Light</option>')
})

it('lets an existing Scrapper choose a calculated skill variant and flags variants invalidated by changed training', () => {
  let c: Character = { ...base, level: 5, ancestry: 'Human',
    feats: [{ name: 'Technomagical Scrapper', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0' }] }
  const tree = () => FeatChoice({ c, entries: [], index: 0, save: patch => { c = { ...c, ...patch } } })
  findSelect(tree())!.onChange({ target: { value: 'Arcana to Expert' } })
  expect(c.feats[0].choice).toBeUndefined()
  findSelect(tree())!.onChange({ target: { value: 'Arcana to Trained' } })
  expect(ranksAt(c, [])).toMatchObject({ Crafting: 1, Arcana: 1 })
  c = { ...c, skillPicks: ['Arcana'] }
  expect(renderToStaticMarkup(tree())).toContain('Saved skill variant is unavailable')
  findSelect(tree())!.onChange({ target: { value: 'Nature to Trained' } })
  expect(ranksAt(c, [])).toMatchObject({ Crafting: 1, Arcana: 1, Nature: 1 })
  expect(renderToStaticMarkup(tree())).not.toContain('Saved skill variant is unavailable')
})

type SelectHandler = { onChange: (event: { target: { value: string } }) => void }
function findSelects(node: ReactNode): SelectHandler[] {
  const found: SelectHandler[] = []
  Children.forEach(node, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    if (child.type === 'select' || child.type === SearchableSelect) found.push({ onChange: child.props.onChange as SelectHandler['onChange'] })
    else found.push(...findSelects(child.props.children as ReactNode))
  })
  return found
}

function findSelect(node: ReactNode) { return findSelects(node)[0] }

it('adds a regular language slot and migrates an existing Ancestral Linguistics choice', () => {
  const c: Character = { ...base, level: 5, ancestry: 'Elf', languages: ['Dwarven'],
    feats: [{ name: 'Ancestral Linguistics', type: 'Ancestry Feat', level: 5, slot: 'ancestry:5:0', choice: 'Draconic' }] }
  expect(languageAllowance(c, []).slots).toBe(2)
  expect(languageAllowance({ ...c, level: 4 }, []).slots).toBe(1)
  expect(migrateAncestralLinguistics({ ...c, level: 4 })).toBeUndefined()
  const migration = migrateAncestralLinguistics(c)!
  expect(migration.languages).toEqual(['Dwarven', 'Draconic'])
  expect(migration.feats?.[0].choice).toBeUndefined()
  expect(migrateAncestralLinguistics({ ...c, languages: ['draconic'] })?.languages).toHaveLength(1)
  expect(migrateAncestralLinguistics({ ...c, ...migration })).toBeUndefined()
  const markup = renderToStaticMarkup(<LanguagesSection c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('Draconic')
  expect(markup).not.toContain('daily language')
  expect(FeatChoice({ c, entries: [], save: () => {}, index: 0 })).toBeNull()
})

it("restricts Officer's Education language slots to common languages without trapping existing picks", () => {
  const c: Character = { ...base, level: 8, languages: ['Aklo'],
    feats: [{ name: "Officer's Education", type: 'Class Feat', level: 8, slot: 'class:8:0' }] }
  const markup = renderToStaticMarkup(<LanguagesSection c={c} entries={[]} save={() => {}} />)
  expect(markup).toMatch(/<input type="checkbox" checked="".*?\/> Aklo/)
  expect(markup).toMatch(/<input type="checkbox" disabled="".*?\/> Aquan/)
  expect(markup).toMatch(/<input type="checkbox"\/> Draconic/)
  expect(markup).toContain('<legend>Regional Languages</legend>')
  expect(markup).toContain('<th scope="col">Speakers</th>')
  expect(markup).toContain('<th scope="col">Regions</th>')
  expect(markup).toContain('Broken Lands, Eye of Dread, Saga Lands')
  expect(markup).toMatch(/<input type="checkbox" disabled="".*?\/> Hallit/)
  const overfilled = renderToStaticMarkup(<LanguagesSection c={{ ...c, languages: ['Aklo', 'Aquan'] }} entries={[]} save={() => {}} />)
  expect(overfilled).toMatch(/<input type="checkbox" checked="".*?\/> Aquan/)
  expect(FeatChoice({ c, entries: [], save: () => {}, index: 0 })).toBeNull()
})

it('shows Starfinder speakers and allows common regional languages in common-only slots', () => {
  const c: Character = { ...base, systems: ['sf2e'], level: 8, languages: ['Aklo'],
    feats: [{ name: "Officer's Education", type: 'Class Feat', level: 8, slot: 'class:8:0' }] }
  const markup = renderToStaticMarkup(<LanguagesSection c={c} entries={[]} save={() => {}} />)
  expect(markup).toContain('Akiton (shobhads, ysoki)')
  expect(markup).toMatch(/<legend>Regional Languages<\/legend>[\s\S]*?\/> Akitonian/)
  expect(markup).toContain('Kasathas, inhabitants of Kasath or the Idari')
  expect(markup).toMatch(/<input type="checkbox"\/> Akitonian/)
  expect(markup).toMatch(/<input type="checkbox" disabled="".*?\/> Orcish/)
  expect(markup).toContain('>Undead</td>')
  const chosen = renderToStaticMarkup(<LanguagesSection c={{ ...c, languages: ['Akitonian'] }} entries={[]} save={() => {}} />)
  expect(chosen).toMatch(/<input type="checkbox"\/> Orcish/)
})

it('persists researched traditions and offers only the broadest available combinations', () => {
  let c: Character = { ...base, level: 13, rankOverrides: { Arcana: 2, Nature: 1, Occultism: 1, Religion: 0 },
    feats: [{ name: 'Researched Spell Resistance', type: 'Ancestry Feat', level: 13, slot: 'ancestry:13:0' }] }
  const options = () => featChoiceOptions('Researched Spell Resistance', c, [], 'ancestry:13:0')!
  expect(options()).toEqual(['Arcane, Occult', 'Arcane, Primal'])
  expect(FeatChoice({ c, entries: [], index: 0, save: () => {} })).toBeNull()
  c = { ...c, rankOverrides: { ...c.rankOverrides, Arcana: 3 } }
  expect(options()).toEqual(['Arcane, Occult', 'Arcane, Primal'])
  c.feats[0].choice = 'Arcane, Primal'
  c = JSON.parse(JSON.stringify(c))
  expect(c.feats[0].choice).toBe('Arcane, Primal')
  expect(researchedSpellResistanceChoices(c, [], c.feats[0]).traditions).toEqual(['Arcane', 'Primal'])
  c = { ...c, rankOverrides: { ...c.rankOverrides, Nature: 3 } }
  expect(options()).toEqual(['Arcane, Occult, Primal'])
  c = { ...c, rankOverrides: { ...c.rankOverrides, Occultism: 3, Religion: 1 } }
  c.feats[0].choice = 'Arcane, Primal, Occult, Divine'
  expect(researchedSpellResistanceChoices(c, [], c.feats[0]).traditions).toEqual(['Arcane', 'Primal', 'Occult', 'Divine'])
  const variants = options()
  expect(variants).toEqual(['Arcane, Divine, Occult, Primal'])
  expect(new Set(variants.map(choice => choice.split(', ').sort().join(', '))).size).toBe(variants.length)
  for (const choice of variants) {
    expect(researchedSpellResistanceChoices(c, [], { ...c.feats[0], choice }).traditions).toEqual(choice.split(', '))
  }
  expect(variants.every(choice => choice === choice.split(', ').sort().join(', '))).toBe(true)
  expect(researchedSpellResistanceChoices(c, [], { ...c.feats[0], choice: 'Divine, Occult' }).traditions)
    .toEqual(['Divine', 'Occult'])
  c = { ...c, rankOverrides: { Arcana: 2, Nature: 2, Occultism: 2, Religion: 2 } }
  expect(options()).toContain('Arcane, Divine, Occult, Primal')
  expect(researchedSpellResistanceChoices(c, [], { ...c.feats[0], choice: 'Arcane, Divine, Occult, Primal' }).traditions)
    .toEqual(['Arcane', 'Divine', 'Occult', 'Primal'])
  c = { ...c, rankOverrides: { Arcana: 2, Nature: 1, Occultism: 1, Religion: 0 } }
  expect(researchedSpellResistanceChoices(c, [], c.feats[0]).traditions).toEqual(['Arcane', 'Primal'])
  expect(options()).toEqual(['Arcane, Occult', 'Arcane, Primal'])
  c = { ...c, rankOverrides: { Arcana: 1 } }
  expect(options()).toEqual([])
})

it.each([
  ['Adopted Ancestry', 'Human', 'ancestry'],
  ['Skill Training', 'Stealth', 'skill'],
  ['Weapon Proficiency', 'Falcata', 'advanced weapon'],
])('saves and restores the mechanical %s choice without changing its slot', (name, choice, label) => {
  const data: ContentEntry[] = [
    { ...entries[0], id: 'human', kind: 'ancestry', name: 'Human', data: {}, traits: [] },
    { ...entries[0], id: 'falcata', kind: 'weapon', name: 'Falcata', data: { weapon_category: 'Advanced', damage: '1d8 slashing' }, traits: [] },
    { ...entries[0], id: 'ranger', kind: 'class', name: 'Ranger', data: { attack_proficiency: 'Trained in martial weapons' }, traits: [] },
  ]
  let c: Character = { ...base, level: 3, ancestry: 'Elf', feats: [
    { name, type: 'General Feat', level: 1, slot: 'general:3:0' },
  ] }
  const tree = () => FeatChoice({ c, entries: data, index: 0, save: (patch) => { c = { ...c, ...patch } } })
  expect(renderToStaticMarkup(tree())).toContain(`aria-label="${name} ${label}"`)
  findSelect(tree())!.onChange({ target: { value: choice } })
  c = JSON.parse(JSON.stringify(c))
  expect(c.feats[0]).toMatchObject({ name, choice, slot: 'general:3:0' })
  expect(renderToStaticMarkup(tree())).toContain(`<option selected="">${choice}</option>`)
  if (name === 'Skill Training') expect(ranksAt(c, data).Stealth).toBe(1)
  if (name === 'Weapon Proficiency') {
    expect(weaponAttack(c, data, { id: 'w', name: choice, potency: 0, striking: 0, runes: [] }).rank).toBe(1)
  }
  findSelect(tree())!.onChange({ target: { value: 'Not an available choice' } })
  expect(c.feats[0].choice).toBe(choice)
  findSelect(tree())!.onChange({ target: { value: '' } })
  expect(c.feats[0].choice).toBeUndefined()
})

it('preserves unavailable saved feat choices and hides meaningless proficiency and language choice inputs', () => {
  const c: Character = { ...base, feats: [{ name: 'Adopted Ancestry', type: 'General Feat', level: 1, choice: 'Dwarf' }] }
  const markup = renderToStaticMarkup(<FeatChoice c={c} entries={[]} save={() => {}} index={0} />)
  expect(markup).toContain('<option disabled="" value="Dwarf" selected="">Dwarf</option>')
  expect(markup).not.toContain('physiological requirements need GM approval')
  for (const name of ['Armor Proficiency', 'Ancestral Paragon', 'Multilingual']) {
    const feat = { ...entries[0], name, kind: 'feat' as const, data: { repeatable: true } }
    expect(FeatChoice({ c: { ...base, feats: [{ name, type: 'General Feat', level: 1 }] }, entries: [feat], save: () => {}, index: 0 })).toBeNull()
  }
  const wizard: ContentEntry = { ...entries[0], kind: 'class', name: 'Wizard', data: { attack_proficiency: 'Trained in simple weapons' } }
  expect(FeatChoice({
    c: { ...base, className: 'Wizard', feats: [{ name: 'Weapon Proficiency', type: 'General Feat', level: 1 }] },
    entries: [wizard], save: () => {}, index: 0,
  })).toBeNull()
})

it('saves a named Additional Lore choice and applies its official scaling after reload', () => {
  let c: Character = { ...base, level: 7, feats: [{ name: 'Additional Lore', type: 'Skill Feat', level: 1, slot: 'skill:2:0' }] }
  const tree = FeatChoice({ c, entries: [], index: 0, save: (patch) => { c = { ...c, ...patch } } })
  let blur: ((event: { target: { value: string } }) => void) | undefined
  const walk = (node: ReactNode) => Children.forEach(node, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return
    if (child.type === 'input') blur = child.props.onBlur as typeof blur
    else walk(child.props.children as ReactNode)
  })
  walk(tree)
  expect(blur).toBeDefined()
  blur!({ target: { value: '  Sailing Lore  ' } })
  c = JSON.parse(JSON.stringify(c))
  expect(c.feats[0]).toMatchObject({ choice: 'Sailing Lore', slot: 'skill:2:0' })
  expect(ranksAt(c, [])['Sailing Lore']).toBe(3)
})

it('imports repeatability from feat special rules without guessing from summaries', () => {
  const hit = { _id: 'feat-4862', _source: {
    name: 'Initiate Warden', category: 'feat', summary: 'You gain a spell.',
    markdown: '**Special** You can take this feat multiple times, choosing a different initial warden spell each time.',
  } }
  expect(mapAonHit(hit, 'pf2e')?.data.repeatable).toBe(true)
  expect(mapAonHit({ ...hit, _source: { ...hit._source, markdown: '**Special** You can take this ancestry feat multiple times.' } }, 'pf2e')?.data.repeatable).toBe(true)
  expect(mapAonHit({ ...hit, _source: { ...hit._source, markdown: '**Special** You can take this feat twice, gaining its benefits each time.' } }, 'pf2e')?.data.repeatable).toBe(true)
  expect(mapAonHit({ ...hit, _source: { ...hit._source, markdown: '', summary: 'You can take this feat multiple times.' } }, 'pf2e')?.data.repeatable).toBe(false)
  expect(mapAonHit({ _source: { category: 'spell', name: 'Gravity Weapon', warden_spell_tier: 'Initiate' } }, 'pf2e')?.data.warden_spell_tier).toBe('Initiate')
})

it('imports archetype-specific levels for additional class feats', () => {
  const mapped = mapAonHit({ _id: 'launch', _source: {
    name: 'Galloping Launch', category: 'feat', level: 4, trait: ['Ranger'], archetype: ['Cavalier'],
    markdown: '**Archetype** [Cavalier](/Archetypes.aspx?ID=244) (Level 6)\n\nFeat rules.',
  } }, 'pf2e')
  expect(mapped?.level).toBe(4)
  expect(mapped?.data.archetype_levels).toBe('Cavalier:6')
  expect(mapped?.data.archetype).toBe('Cavalier')
})

it('retains full feat, spell, trait, and rune descriptions through snapshot fetching and mapping', async () => {
  const markdown = '**Full rules**\n\n' + 'Long rules paragraph. '.repeat(100) + '\n\nFinal rule must remain.'
  const fetchFn: typeof fetch = async (_url, init) => {
    const request = JSON.parse(String(init?.body)) as { query: { bool: { filter: { term: { category: string } }[] } } }
    const category = request.query.bool.filter[0].term.category
    return new Response(JSON.stringify({ hits: { hits: [{
      _id: category,
      _source: { category, name: category, markdown, summary: 'Short summary.', item_subcategory: 'Weapon Property Runes' },
    }] } }), { status: 200 })
  }
  const hits = await fetchAonHits('pf2e', fetchFn)
  for (const category of ['feat', 'spell', 'trait', 'equipment']) {
    const hit = hits.find((h) => h._id === category)!
    expect(hit._source?.markdown).toBe(markdown)
    const description = mapAonHit(hit, 'pf2e')?.description
    expect(description).toContain('Long rules paragraph. '.repeat(100).trim())
    expect(description).toContain('Final rule must remain.')
    expect(description).not.toContain('Short summary.')
  }
  expect(mapAonHit({ _source: { category: 'feat', name: 'Fallback', summary: 'Available summary.' } }, 'pf2e')?.description)
    .toBe('Available summary.')
})

it('requests selected legacy Champion oaths alongside remastered Pathfinder feats', async () => {
  const queries: Record<string, unknown> = {}
  const fetchFn: typeof fetch = async (_url, init) => {
    const request = JSON.parse(String(init?.body)) as { query: { bool: { filter: { term: { category: string } }[] } } }
    queries[request.query.bool.filter[0].term.category] = request.query
    return new Response(JSON.stringify({ hits: { hits: [] } }), { status: 200 })
  }
  await fetchAonHits('pf2e', fetchFn)
  expect(queries.feat).toMatchObject({ bool: { filter: [{ term: { category: 'feat' } }], must_not: expect.arrayContaining([
    { bool: { filter: [{ exists: { field: 'remaster_id' } }], must_not: [{ ids: { values: ['feat-219', 'feat-220', 'feat-1669'] } }] } },
  ]) } })
  expect(queries.spell).toEqual({ bool: { filter: [{ term: { category: 'spell' } }], must_not: [{ exists: { field: 'remaster_id' } }] } })
  expect(mapAonHit({ _id: 'feat-219', _source: { category: 'feat', name: 'Dragonslayer Oath', url: '/Feats.aspx?ID=219' } }, 'pf2e')?.data.url)
    .toBe('https://2e.aonprd.com/Feats.aspx?ID=219&NoRedirect=1')
  expect(mapAonHit({ _id: 'feat-1669', _source: { category: 'feat', name: 'Esoteric Oath', url: '/Feats.aspx?ID=1669' } }, 'pf2e')?.data.url)
    .toBe('https://2e.aonprd.com/Feats.aspx?ID=1669&NoRedirect=1')
  expect(mapAonHit({ _id: 'feat-220', _source: { category: 'feat', name: 'Fiendsbane Oath', url: '/Feats.aspx?ID=220' } }, 'pf2e')?.data.url)
    .toBe('https://2e.aonprd.com/Feats.aspx?ID=220&NoRedirect=1')
  await fetchAonHits('sf2e', fetchFn)
  expect(queries.feat).toEqual({ bool: { filter: [{ term: { category: 'feat' } }], must_not: [{ exists: { field: 'remaster_id' } }] } })
})

it('retains whether deity sanctification is required when snapshotting rules', async () => {
  const fetchFn: typeof fetch = async (_url, init) => {
    const request = JSON.parse(String(init?.body)) as { query: { bool: { filter: { term: { category: string } }[] } } }
    const category = request.query.bool.filter[0].term.category
    const hits = category === 'deity' ? [
      { _id: 'required', _source: { category, name: 'Required', sanctification: ['holy'], markdown: '**Divine Sanctification**  must choose holy' } },
      { _id: 'optional', _source: { category, name: 'Optional', sanctification: ['holy'], markdown: '**Divine Sanctification**  can choose holy' } },
    ] : []
    return new Response(JSON.stringify({ hits: { hits } }), { status: 200 })
  }
  const hits = await fetchAonHits('pf2e', fetchFn)
  expect(mapAonHit(hits.find((hit) => hit._id === 'required')!, 'pf2e')?.data.sanctification_required).toBe(true)
  expect(mapAonHit(hits.find((hit) => hit._id === 'optional')!, 'pf2e')?.data.sanctification_required).toBe(false)
})

it('offers only deity domains, rejects other choices, and preserves unavailable saved domains', () => {
  let c: Character = { ...base, className: 'Champion', deity: 'Test Deity',
    feats: [{ name: "Deity's Domain", type: 'Class Feat', level: 1 }] }
  const deity: ContentEntry = { ...entries[0], kind: 'deity', name: 'Test Deity', data: { domain_primary: 'Zeal, Might', domain_alternate: 'Fire' } }
  const other: ContentEntry = { ...deity, id: 'other', name: 'Other Deity', data: { domain_primary: 'Fire, Death' } }
  const props = () => ({ c, entries: [deity, other], save: (patch: Partial<Character>) => { c = { ...c, ...patch } }, index: 0 })
  const markup = renderToStaticMarkup(<FeatChoice {...props()} />)
  expect(markup).not.toContain('>Fire</option>')
  expect(markup).not.toContain('>Death</option>')
  expect(markup).toContain('<option>Might</option>')
  expect(markup).toContain('<option>Zeal</option>')
  const select = findSelect(FeatChoice(props()))
  if (!select) throw new Error('Missing domain picker')
  select.onChange({ target: { value: 'Fire' } })
  expect(c.feats[0].choice).toBeUndefined()
  select.onChange({ target: { value: 'Zeal' } })
  expect(c.feats[0].choice).toBe('Zeal')
  c = { ...c, deity: 'Other Deity' }
  const changed = renderToStaticMarkup(<FeatChoice {...props()} />)
  expect(changed).toContain('<option disabled="" value="Zeal" selected="">Zeal (unavailable)</option>')
  expect(changed).toContain('Saved domain is unavailable')
  expect(c.feats[0].choice).toBe('Zeal')
  findSelect(FeatChoice(props()))!.onChange({ target: { value: 'Fire' } })
  expect(c.feats[0].choice).toBe('Fire')
})

it('selects distinct warden spells per feat and derives grants from current choices', () => {
  let c: Character = { ...base, feats: [
    { name: 'Initiate Warden', type: 'Class Feat', level: 1, slot: 'class:1:0' },
    { name: 'Initiate Warden', type: 'Class Feat', level: 1, slot: 'class:1:1' },
  ] }
  const props = () => ({ c, entries, save: (patch: Partial<Character>) => { c = { ...c, ...patch } } })
  const first = findSelect(FeatChoice({ ...props(), index: 0 }))
  if (!first) throw new Error('Missing first spell selection')
  first.onChange({ target: { value: 'Gravity Weapon' } })
  expect(grantedWardenSpells(c, entries).map((s) => s.name)).toEqual(['Gravity Weapon'])
  const markup = renderToStaticMarkup(<FeatChoice {...props()} index={1} />)
  expect(markup).toContain('Heal Companion')
  expect(markup).not.toContain('Gravity Weapon')
  expect(markup).not.toContain('Animal Feature')
  const second = findSelect(FeatChoice({ ...props(), index: 1 }))
  if (!second) throw new Error('Missing second spell selection')
  second.onChange({ target: { value: 'Heal Companion' } })
  expect(grantedWardenSpells(c, entries).map((s) => s.name)).toEqual(['Gravity Weapon', 'Heal Companion'])
  c = { ...c, feats: c.feats.slice(1) }
  expect(grantedWardenSpells(c, entries).map((s) => s.name)).toEqual(['Heal Companion'])
})

it('hides another Warden feat when all distinct spells are chosen', () => {
  const allSpells = Array.from({ length: 3 }, (_, i) => spell(`Initiate ${i}`, 'Initiate'))
  const initiate: ContentEntry = {
    id: 'initiate', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Initiate Warden', level: 1,
    traits: ['Ranger'], description: '', data: { repeatable: true }, effects: [], updatedAt: 1,
  }
  const choices = allSpells.map((s, i) => ({
    name: 'Initiate Warden', type: 'Class Feat', level: 1, slot: `class:1:${i}`, choice: s.name,
  }))
  const c: Character = { ...base, feats: choices }
  expect(canSelectWardenFeat('Initiate Warden', c, [...allSpells, initiate])).toBe(false)
  expect(eligibleFeats([initiate], c, { key: 'class:1:3', category: 'class', level: 1 })).toEqual([])
  const almostFull = { ...c, feats: choices.slice(0, -1) }
  expect(eligibleFeats([initiate, ...allSpells], almostFull, { key: 'class:1:3', category: 'class', level: 1 }))
    .toContainEqual(initiate)
})

it('places Warden spell choices before add and remove slot controls', () => {
  const c: Character = {
    ...base,
    feats: [
      { name: 'Initiate Warden', type: 'Class Feat', level: 1, slot: 'class:1:0', choice: 'Gravity Weapon' },
      { name: 'Initiate Warden', type: 'Class Feat', level: 1, slot: 'class:1:1', choice: 'Heal Companion' },
    ],
    extraSlots: [{ category: 'class', level: 1, count: 1 }],
  }
  const feat: ContentEntry = {
    id: 'initiate', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Initiate Warden', level: 1,
    traits: ['Ranger'], description: '', data: { repeatable: true }, effects: [], updatedAt: 1,
  }
  const rows = [...renderToStaticMarkup(<FeatSlots c={c} entries={[feat, ...entries]} save={() => {}} categories={['class']} bare />)
    .matchAll(/<li class="feat-slot-row[^"]*">([\s\S]*?)<\/li>/g)].map((match) => match[1])
  const addRow = rows.find((row) => row.includes('aria-label="Add L01 Class feat slot"'))
  const removeRow = rows.find((row) => row.includes('aria-label="Remove L01 Class extra feat slot 1"'))
  expect(addRow).toBeDefined()
  expect(removeRow).toBeDefined()
  expect(addRow!.indexOf('class="feat-choice"')).toBeLessThan(addRow!.indexOf('aria-label="Add L01 Class feat slot"'))
  expect(removeRow!.indexOf('class="feat-choice"')).toBeLessThan(removeRow!.indexOf('aria-label="Remove L01 Class extra feat slot 1"'))
})

it('shows feat grants once without deleting independently added spells', () => {
  const c: Character = { ...base, feats: [{ name: 'Initiate Warden', type: 'Class Feat', level: 1, choice: 'Gravity Weapon' }],
    spells: [{ name: 'Gravity Weapon', rank: 1, cantrip: false, entryId: 'Gravity Weapon' }] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('<strong>Spells</strong><span>1 spells</span>')
  expect(markup).toContain('Gravity Weapon')
  expect(markup).toContain('<b>Focus Spells</b>')
  expect(markup).not.toContain('Warden feat')
  expect((markup.match(/aria-haspopup="dialog">Gravity Weapon<\/button>/g) ?? [])).toHaveLength(1)
  expect(grantedWardenSpells({ ...c, feats: [] }, entries)).toEqual([])
  expect(c.spells).toHaveLength(1)
})

it('shows action icons beside selected spells', () => {
  const c: Character = { ...base, spells: [{ name: 'Gravity Weapon', rank: 1, cantrip: false, entryId: 'Gravity Weapon' }] }
  const spellEntries = entries.map((entry) => entry.name === 'Gravity Weapon'
    ? { ...entry, data: { ...entry.data, actions: 'Single Action' } } : entry)
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={spellEntries} save={() => {}} />)
  expect(markup).toContain('aria-label="Single Action"')
})

it('allows Gravity Weapon activation as soon as the warden spell is learned', () => {
  const c: Character = { ...base, level: 1,
    feats: [{ name: 'Initiate Warden', type: 'Class Feat', level: 1, choice: 'Gravity Weapon' }] }
  const render = (character: Character) => renderToStaticMarkup(<SpellsSection c={character} entries={entries} save={() => {}} />)
  expect(render(c)).toContain('aria-label="Gravity Weapon active"')
  expect(render({ ...c, activeSpells: ['Gravity Weapon'] })).toContain('aria-label="Gravity Weapon active" checked=""')
  expect(render({ ...c, feats: [] })).not.toContain('aria-label="Gravity Weapon active"')
})

it('preserves selected Animal Feature effects and tracks Gravity Weapon but not instantaneous spells', () => {
  const c: Character = {
    ...base, level: 8, activeSpells: ['Animal Feature'], feats: [
      { name: 'Advanced Warden', type: 'Class Feat', level: 4, choice: 'Animal Feature' },
      { name: 'Initiate Warden', type: 'Class Feat', level: 1, choice: 'Gravity Weapon' },
      { name: 'Initiate Warden', type: 'Class Feat', level: 1, choice: 'Heal Companion' },
    ],
  }
  const spells = entries.map((entry) => entry.name === 'Gravity Weapon' ? { ...entry, data: { ...entry.data, duration: 60 } } : entry)
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={spells} save={() => {}} />)
  expect(markup).toContain('aria-label="Animal Feature: Claws" checked=""')
  expect(markup).toContain('aria-label="Gravity Weapon active"')
  expect(markup).not.toContain('aria-label="Heal Companion active"')
  expect(renderToStaticMarkup(<SpellsSection c={{ ...c, activeSpells: [] }} entries={spells} save={() => {}} />))
    .not.toContain('aria-label="Animal Feature: Claws" checked=""')
})

it('keeps Warden tier labels for feat choices but combines their spell listings', () => {
  expect(spellWardenLabel('Initiate')).toBe('Initiate Warden')
  expect(spellWardenLabel('Advanced')).toBe('Advanced Warden')
  expect(spellWardenLabel('Master')).toBe('Master Warden')
  expect(spellWardenLabel('Peerless')).toBe('Peerless Warden')
  expect(spellWardenLabel(undefined)).toBeUndefined()
  const c: Character = { ...base, spells: [{ name: 'Gravity Weapon', rank: 1, cantrip: false, entryId: 'Gravity Weapon' }] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={entries} save={() => {}} />)
  expect(markup).toContain('<b>Focus Spells</b>')
  expect(markup).not.toContain('<h5>Initiate Warden</h5>')
  expect(markup).not.toContain('<h5>Rank 1</h5>')
})

it('heightens Implant Data duration to one year and then unlimited', () => {
  const implant: ContentEntry = { ...spell('Implant Data', ''), data: { duration_text: '1 day' }, traits: ['Cantrip'], level: 1,
    description: 'You reprogram a device.\n\nHeightened (3rd) The duration is one year.\n\nHeightened (6th) The duration is unlimited.' }
  const render = (level: number) => renderToStaticMarkup(<SpellsSection c={{ ...base, level, spells: [{ name: implant.name, rank: 1, cantrip: true, entryId: implant.id }] }}
    entries={[implant]} save={() => {}} />)
  expect(render(1)).toContain('1 day')
  expect(render(10)).toContain('One year')
  expect(render(12)).toContain('Unlimited')
})

it('raises Beastmaster Trance range and duration when heightened', () => {
  const trance: ContentEntry = { ...spell('Beastmaster Trance', ''), data: { range_text: '1 mile', duration_text: 'sustained up to 1 minute' },
    traits: ['Focus'], level: 3,
    description: 'You enter a trance.\n\nHeightened (6th) Increase the range to 100 miles and the duration of sustained up to 10 minutes. The target can hear you.\n\nHeightened (8th) Increase the range to planetary and the duration of sustained up to 1 hour.' }
  const render = (level: number) => renderToStaticMarkup(<SpellsSection c={{ ...base, level, spells: [{ name: trance.name, rank: 3, cantrip: false, entryId: trance.id }] }}
    entries={[trance]} save={() => {}} />)
  expect(render(9)).toContain('<small>Range</small>1 mile')
  expect(render(11)).toContain('<small>Range</small>100 miles')
  expect(render(11)).toContain('Sustained up to 10 minutes')
  expect(render(13)).toContain('<small>Range</small>100 miles')
  expect(render(15)).toContain('<small>Range</small>Planetary')
  expect(render(15)).toContain('Sustained up to 1 hour')
})

it('targets only your animal companion with Beastmaster Trance under the single companion rule', () => {
  const previous = getSettings().singleAnimalCompanion
  const trance: ContentEntry = { ...spell('Beastmaster Trance', ''), level: 3,
    data: { targets: '1 of your animal companions' }, traits: ['Focus'] }
  const c: Character = { ...base, level: 10, spells: [{ name: trance.name, rank: 3, cantrip: false, entryId: trance.id }] }
  const render = () => renderToStaticMarkup(<SpellsSection c={c} entries={[trance]} save={() => {}} />)
  const before = JSON.stringify({ c, trance })
  try {
    updateSettings({ singleAnimalCompanion: true })
    expect(render()).toContain('<small>Area/Targets</small>Your animal companion')
    updateSettings({ singleAnimalCompanion: false })
    expect(render()).toContain('<small>Area/Targets</small>1 of your animal companions')
    expect(JSON.stringify({ c, trance })).toBe(before)
  } finally { updateSettings({ singleAnimalCompanion: previous }) }
})

it('combines all Warden tiers without changing ordinary spell rank groups', () => {
  const spells = [
    spell('Gluttonous Growth', 'Peerless'),
    spell('Gravity Weapon', 'Initiate'),
    spell('Animal Feature', 'Advanced'),
    spell('Ephemeral Tracking', 'Master'),
    { ...spell('Ordinary Spell', ''), data: {}, traits: [], level: 5 },
  ]
  const c: Character = { ...base, spells: spells.map((s) => ({ name: s.name, rank: 5, cantrip: false, entryId: s.id })) }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={spells} save={() => {}} />)
  expect(markup).not.toContain('Focus Spells Rank')
  expect(markup).not.toMatch(/<h5>(?:Initiate|Advanced|Master|Peerless) Warden<\/h5>/)
  const focus = markup.slice(markup.indexOf('<b>Focus Spells</b>'))
  for (const spell of spells.slice(0, -1)) expect(focus).toContain(`aria-haspopup="dialog">${spell.name}</button>`)
  expect(markup).toContain('<h5>Rank 5</h5>')
  expect(markup).not.toContain('(Peerless Warden)')
})

it('derives caster status, traditions and spell proficiency from class features', () => {
  const classes: ContentEntry[] = [
    { id: 'ranger', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Ranger', level: 1, traits: [], description: '', data: {}, effects: [], updatedAt: 1 },
    { id: 'wizard', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Wizard', level: 1, traits: [], description: '', data: { tradition: 'Arcane' }, effects: [], updatedAt: 1 },
    { id: 'witch', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Witch', level: 1, traits: [], description: '', data: { tradition: 'Arcane, Divine, Occult, Primal' }, effects: [], updatedAt: 1 },
    { id: 'patron-winter', systems: ['pf2e'], kind: 'subclass', source: 'official', name: 'Winter', level: 1, traits: [], description: '', data: { class: 'Witch', tradition: 'Primal' }, effects: [], updatedAt: 1 },
    { id: 'expert', systems: ['pf2e'], kind: 'classFeature', source: 'official', name: 'Expert Spellcaster', level: 7, traits: [], description: '', data: { class: 'Wizard' }, effects: [], updatedAt: 1 },
    { id: 'master', systems: ['pf2e'], kind: 'classFeature', source: 'official', name: 'Master Spellcaster', level: 15, traits: [], description: '', data: { class: 'Wizard' }, effects: [], updatedAt: 1 },
    { id: 'ranger-expert', systems: ['pf2e'], kind: 'classFeature', source: 'official', name: 'Ranger Expertise', level: 9, traits: [], description: 'Your proficiency rank for your ranger class DC increases to expert.', data: { class: 'Ranger' }, effects: [], updatedAt: 1 },
  ]
  expect(classSpellcasting({ ...base, className: 'Ranger' }, classes)).toEqual({ traditions: [], rank: 1, ability: 'wis' })
  expect(classSpellcasting({ ...base, className: 'Ranger', level: 9 }, classes)).toEqual({ traditions: [], rank: 2, ability: 'wis' })
  expect(classSpellcasting({ ...base, className: 'Wizard', level: 1 }, classes)).toEqual({ traditions: ['Arcane'], rank: 1, ability: 'int' })
  expect(classSpellcasting({ ...base, className: 'Wizard', level: 8 }, classes)).toEqual({ traditions: ['Arcane'], rank: 2, ability: 'int' })
  expect(classSpellcasting({ ...base, className: 'Wizard', level: 15 }, classes)).toEqual({ traditions: ['Arcane'], rank: 3, ability: 'int' })
  expect(classSpellcasting({ ...base, className: 'Witch' }, classes)?.traditions).toEqual(['Arcane', 'Divine', 'Occult', 'Primal'])
  expect(classSpellcasting({ ...base, className: 'Witch', subclass: 'Winter' }, classes)?.traditions).toEqual(['Primal'])
})

it('offers Cleric feats for Basic and Advanced Dogma and counts the choice as taken', () => {
  const clericFeat = (name: string, level: number): ContentEntry => ({
    id: name, systems: ['pf2e'], kind: 'feat', source: 'official', name, level, traits: ['Cleric'],
    description: '', data: {}, effects: [], updatedAt: 1,
  })
  const catalog = [clericFeat('Deadly Simplicity', 1), clericFeat('Domain Initiate', 1), clericFeat('Channel Smite', 4)]
  const c: Character = { ...base, className: 'Fighter', level: 8, feats: [
    { name: 'Cleric Dedication', type: 'Archetype Feat', level: 2, slot: 'archetype:2:0' },
    { name: 'Basic Dogma', type: 'Archetype Feat', level: 4, slot: 'archetype:4:0', choice: 'Deadly Simplicity' }] }
  expect(featChoiceOptions('Advanced Dogma', c, catalog, 'archetype:8:0')).toEqual(['Channel Smite', 'Domain Initiate'])
  expect(activeFeatsNamed(c, 'Deadly Simplicity')).toHaveLength(1)
})

it('allows archetype feats before a later planned Dedication', () => {
  const dedication: ContentEntry = { id: 'cleric-dedication', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Cleric Dedication',
    level: 2, traits: ['Archetype', 'Dedication'], description: '', data: { archetype: 'Cleric' }, effects: [], updatedAt: 1 }
  const dogma: ContentEntry = { ...dedication, id: 'basic-dogma', name: 'Basic Dogma', level: 4, traits: ['Archetype'],
    data: { archetype: 'Cleric', prerequisite: 'Cleric Dedication' } }
  const c: Character = { ...base, className: 'Fighter', level: 10,
    feats: [{ name: 'Cleric Dedication', type: 'Archetype Feat', level: 10, slot: 'archetype:10:0' }] }
  const slot = plannedSlots(c, [dedication, dogma]).find(candidate => candidate.key === 'archetype:4:0')!
  expect(featSelectionPrerequisiteChecker(c, [dedication, dogma], slot)(dogma).missing).toEqual([])
})

it('gives Spellshot Wizard spellcasting its slots, book choices, and arcana feat selections', () => {
  const dedication = { name: 'Spellshot Dedication', type: 'Archetype Feat', level: 2, slot: 'archetype:2:0' }
  const basic = { name: 'Basic Wizard Spellcasting', type: 'Archetype Feat', level: 4, slot: 'archetype:4:0' }
  const breadth = { name: 'Arcane Breadth', type: 'Archetype Feat', level: 8, slot: 'archetype:8:0' }
  const c: Character = { ...base, className: 'Gunslinger', level: 8, feats: [dedication, basic, breadth] }
  expect(classSpellcasting(c, [])).toEqual({ traditions: ['Arcane'], rank: 1, ability: 'int' })
  expect(classSpellSlots(c)).toEqual({ 0: 2, 1: 2, 2: 1, 3: 1 })
  expect(wizardArchetypeSpellbookChoices(c)).toHaveLength(8)

  const wizardFeat = (name: string, level: number): ContentEntry => ({
    id: name, systems: ['pf2e'], kind: 'feat', source: 'official', name, level, traits: ['Wizard'],
    description: '', data: {}, effects: [], updatedAt: 1,
  })
  const catalog = [wizardFeat('Reach Spell', 1), wizardFeat('Counterspell', 2), wizardFeat('Cantrip Expansion', 2),
    wizardFeat('Advanced Counterspell', 4), wizardFeat('Impossible Counterspell', 8)]
  expect(featChoiceOptions('Basic Arcana', c, catalog, 'archetype:4:1'))
    .toEqual(['Cantrip Expansion', 'Counterspell', 'Reach Spell'])
  const cantripExpansion: Character = { ...c, feats: [...c.feats,
    { name: 'Basic Arcana', type: 'Archetype Feat', level: 4, slot: 'archetype:4:1', choice: 'Cantrip Expansion' }] }
  expect(classSpellSlots(cantripExpansion)).toEqual({ 0: 4, 1: 2, 2: 1, 3: 1 })
  expect(wizardArchetypeSpellbookChoices(cantripExpansion).filter(slot => slot.rank === 0)).toHaveLength(4)
  const withArcana: Character = { ...c, level: 16, feats: [...c.feats,
    { name: 'Basic Arcana', type: 'Archetype Feat', level: 4, slot: 'archetype:4:1', choice: 'Reach Spell' }] }
  expect(featChoiceOptions('Advanced Arcana', withArcana, catalog, 'archetype:16:0'))
    .toEqual(['Advanced Counterspell', 'Cantrip Expansion', 'Counterspell', 'Impossible Counterspell'])
  expect(activeFeatsNamed(withArcana, 'Reach Spell')).toHaveLength(1)
  const expert = { ...withArcana, feats: [...withArcana.feats,
    { name: 'Expert Wizard Spellcasting', type: 'Archetype Feat', level: 12, slot: 'archetype:12:0' }] }
  expect(classSpellcasting(expert, [])).toEqual({ traditions: ['Arcane'], rank: 2, ability: 'int' })
  expect(classSpellSlots(expert)).toEqual({ 0: 2, 1: 2, 2: 2, 3: 2, 4: 2, 5: 1, 6: 1 })
  expect(wizardArchetypeSpellbookChoices(expert)).toHaveLength(14)
})

it('grants Arcane School Spell focus spell selected by its school variant', () => {
  const school = mapAonHit({ _id: 'school', _source: {
    category: 'arcane-school', name: 'Abjuration',
    markdown: 'You learn the [protective ward](/Spells.aspx?ID=534) school spell.',
  } }, 'pf2e')!
  const c: Character = { ...base, className: 'Gunslinger', level: 4,
    feats: [{ name: 'Arcane School Spell', type: 'Archetype Feat', level: 4, choice: school.name }] }
  expect(featChoiceOptions('Arcane School Spell', c, [school], 'archetype:4:0')).toEqual(['Abjuration'])
  expect(focusSpells(c, [school]).spells).toEqual([{ name: 'Protective Ward', source: 'Abjuration school' }])
})

it('adds Spellshot Wizard spellbook selections to Class Spells', () => {
  const spell: ContentEntry = { id: 'mystic-armor', systems: ['pf2e'], kind: 'spell', source: 'official',
    name: 'Mystic Armor', level: 1, traits: [], description: '', data: { tradition: 'Arcane' }, effects: [], updatedAt: 1 }
  const c: Character = { ...base, className: 'Gunslinger', level: 4, feats: [
    { name: 'Spellshot Dedication', type: 'Archetype Feat', level: 2, slot: 'archetype:2:0' },
    { name: 'Basic Wizard Spellcasting', type: 'Archetype Feat', level: 4, slot: 'archetype:4:0' },
  ], spells: [{ name: spell.name, rank: 1, cantrip: false, entryId: spell.id, bookSlot: 'wizard:1:0' }] }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[spell]} save={() => {}} />)
  const book = markup.slice(markup.indexOf('class="entry-dialog dirge-dialog"'))
  expect(markup).toContain('Wizard Spellbook')
  expect(markup).toContain('aria-label="Open Wizard rank 1"')
  expect(markup).not.toContain('Wizard rank 1 spell 1')
  expect(book).toContain('Mystic Armor')
  expect(markup).toContain('Spell Rank 1')
})

it('shows spell DC proficiency but no spell slots for focus-only casters', () => {
  const ranger: Character = {
    ...base,
    spellcasting: { ability: 'wis', tradition: '', rank: 1, slots: { 1: 2 } },
    feats: [{ name: 'Gravity Weapon', type: 'Class Feat', level: 1, slot: 'class:1:0' }],
  }
  const classes: ContentEntry[] = [
    { id: 'ranger', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Ranger', level: 1, traits: [], description: '', data: {}, effects: [], updatedAt: 1 },
    { id: 'gravity-feat', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Gravity Weapon', level: 1, traits: [], description: '', data: { grants_focus_spells: 'Gravity Weapon' }, effects: [], updatedAt: 1 },
    { ...spell('Gravity Weapon', 'Initiate'), description: 'Focus spell description.' },
  ]
  const markup = renderToStaticMarkup(<SpellsSection c={ranger} entries={classes} save={() => {}} />)
  expect(markup).not.toContain('Casting ability: Wisdom')
  expect(markup).toContain('<small>Wisdom</small>')
  expect(markup).toContain('DC 13 <small>(Attack +3)</small>')
  expect(markup).toContain('Spellcasting proficiency: Trained')
  expect(markup).toContain('Gravity Weapon')
  expect(markup).toContain('aria-haspopup="dialog">Gravity Weapon</button>')
  expect(markup).toContain('<p>Focus spell description.</p>')
  expect(markup).not.toContain('Filter spells by tradition')
  expect(markup).not.toContain('Spell slots:')
})

it('retains spell slots for slotted casters such as Druids', () => {
  const c: Character = {
    ...base, className: 'Druid',
    spellcasting: { ability: 'wis', tradition: 'Primal', rank: 1, slots: { 1: 2 } },
  }
  const druid: ContentEntry = {
    id: 'druid', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Druid', level: 1,
    traits: [], description: '', data: { tradition: 'Primal' }, effects: [], updatedAt: 1,
  }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[druid]} save={() => {}} />)
  expect(markup).toContain('aria-label="Spell Rank 1 slot 2"')
  expect(markup).toContain('aria-label="Cantrip slot 5"')
  expect(markup).not.toContain('Spell slots:')
})

it('opens prepared Druid spells in description dialogs without duplicating common spellbook entries', () => {
  const c: Character = {
    ...base, className: 'Druid',
    spells: [{ name: 'Heal', rank: 1, cantrip: false, entryId: 'heal' }],
    spellcasting: { ability: 'wis', tradition: 'Primal', rank: 1, slots: {}, prepared: { '1:0': 'heal' } },
  }
  const heal: ContentEntry = {
    ...spell('Heal', ''), id: 'heal', traits: [], description: 'Healing spell description.',
    data: { tradition: 'Primal', url: 'https://2e.aonprd.com/' },
  }
  const druid: ContentEntry = {
    ...heal, id: 'druid', kind: 'class', name: 'Druid', description: '', data: { tradition: 'Primal' },
  }
  const markup = renderToStaticMarkup(<SpellsSection c={c} entries={[druid, heal]} save={() => {}} />)
  expect(markup).toContain('aria-haspopup="dialog">Heal</button>')
  expect(markup.match(/<p>Healing spell description.<\/p>/g)).toHaveLength(1)
  expect(markup).not.toContain('aria-label="Remove Heal"')
  expect(markup).toContain('href="https://2e.aonprd.com/"')
})

it('keeps companion and granted general-feat choices out of feat rows', () => {
  for (const name of ['Incredible Companion', 'Specialized Companion', 'Incredible Mount', 'Specialized Mount',
    'Incredible Beastmaster Companion', 'Specialized Beastmaster Companion', 'General Training', 'Advanced General Training']) {
    const c = { ...base, feats: [{ name, type: 'Class Feat', level: 1 }] }
    const entry: ContentEntry = {
      id: name, systems: ['pf2e'], kind: 'feat', source: 'official', name, level: 1,
      traits: [], description: '', data: { repeatable: true }, effects: [], updatedAt: 1,
    }
    expect(renderToStaticMarkup(<FeatChoice c={c} entries={[entry]} save={() => {}} index={0} />)).toBe('')
  }
})

it('offers Finely Tuned only for distinct common augmentations with daily activations', () => {
  const finelyTuned = { name: 'Finely Tuned', type: 'Class Feat', level: 6, slot: 'class:6:0' }
  const common: ContentEntry = { id: 'hypernerves', systems: ['sf2e'], kind: 'item', source: 'official', name: 'Hypernerves',
    level: 1, traits: [], description: '', data: { item_category: 'Augmentations',
      item_activation_action_ids: '182-engange-hypernerves' }, effects: [], updatedAt: 0 }
  const cloakingSkin: ContentEntry = { ...common, id: 'cloaking-skin', name: 'Cloaking Skin (Advanced)',
    data: { item_category: 'Augmentations', item_activation_action_ids: '175-cloak' } }
  const speedSuspension: ContentEntry = { ...common, id: 'speed-suspension', name: 'Speed Suspension',
    data: { item_category: 'Augmentations' } }
  const artificialImmortalizer: ContentEntry = { ...common, id: 'artificial-immortalizer', name: 'Artificial Immortalizer',
    level: 17, traits: ['Apex'], data: { item_category: 'Augmentations', item_activation_action_ids: '179-life-buffer' } }
  const nonDaily: ContentEntry = { ...common, id: 'non-daily', name: 'Non-daily implant',
    data: { item_category: 'Augmentations', item_activation_action_ids: '473-animated-limb' } }
  const uncommon: ContentEntry = { ...common, id: 'uncommon', name: 'Uncommon implant', traits: ['Uncommon'] }
  let c: Character = { ...base, systems: ['sf2e'], level: 8, feats: [finelyTuned],
    augmentations: [
      { id: 'one', entryId: common.id, name: common.name, slot: 'standard' },
      { id: 'two', entryId: cloakingSkin.id, name: cloakingSkin.name, slot: 'standard' },
      { id: 'three', entryId: speedSuspension.id, name: speedSuspension.name, slot: 'standard' },
      { id: 'four', entryId: nonDaily.id, name: nonDaily.name, slot: 'standard' },
      { id: 'five', entryId: uncommon.id, name: uncommon.name, slot: 'standard' },
      { id: 'six', entryId: artificialImmortalizer.id, name: artificialImmortalizer.name, slot: 'standard' },
    ] }
  const catalog = [common, cloakingSkin, speedSuspension, artificialImmortalizer, nonDaily, uncommon]
  const tree = (index = 0) => FeatChoice({
    c, entries: catalog, index, save: patch => { c = { ...c, ...patch } },
  })
  expect(featChoiceOptions('Finely Tuned', c, catalog, finelyTuned.slot, 0))
    .toEqual(['Artificial Immortalizer', 'Cloaking Skin (Advanced)', 'Hypernerves'])
  expect(renderToStaticMarkup(tree())).toContain('Hypernerves')
  findSelect(tree())!.onChange({ target: { value: 'Hypernerves' } })
  expect(c.feats[0].choice).toBe('Hypernerves')

  c = { ...c, feats: [...c.feats, { ...finelyTuned, slot: 'class:6:1' }] }
  expect(featChoiceOptions('Finely Tuned', c, catalog, 'class:6:1', 1))
    .toEqual(['Artificial Immortalizer', 'Cloaking Skin (Advanced)'])
  expect(renderToStaticMarkup(tree(1))).toContain('Cloaking Skin (Advanced)')
})

it('offers Presence Intensifier for Finely Tuned only under its daily house rule', () => {
  const previous = getSettings().presenceIntensifierDaily
  try {
    const item: ContentEntry = { id: 'presence', systems: ['sf2e'], kind: 'item', source: 'official',
      name: 'Presence Intensifier', level: 17, traits: ['Apex'], description: '',
      data: { item_category: 'Augmentations', item_activation_action_ids: '184-irresistible-idea' }, effects: [], updatedAt: 0 }
    const feat = { name: 'Finely Tuned', type: 'Archetype Feat', level: 6, slot: 'archetype:6:0' }
    const c: Character = { ...base, systems: ['sf2e'], level: 17, feats: [feat],
      augmentations: [{ id: 'installed', entryId: item.id, name: item.name, slot: 'apex' }] }
    updateSettings({ presenceIntensifierDaily: true })
    expect(featChoiceOptions(feat.name, c, [item], feat.slot, 0)).toEqual([item.name])
    updateSettings({ presenceIntensifierDaily: false })
    expect(featChoiceOptions(feat.name, c, [item], feat.slot, 0)).toEqual([])
  } finally {
    updateSettings({ presenceIntensifierDaily: previous })
  }
})

it.each(PILOTING_INTERFACES)('offers installed $name for Finely Tuned', augmentation => {
  const feat = { name: 'Finely Tuned', type: 'Archetype Feat', level: 6, slot: 'archetype:6:0' }
  const c: Character = { ...base, systems: ['sf2e'], level: 17, feats: [feat],
    augmentations: [{ id: 'installed', entryId: augmentation.id, name: augmentation.name, slot: 'standard' }] }
  expect(featChoiceOptions(feat.name, c, [augmentation], feat.slot, 0)).toEqual([augmentation.name])
  expect(featChoiceOptions(feat.name, { ...c, augmentations: [] }, [augmentation], feat.slot, 0)).toEqual([])
})

it('hides manual casting configuration for noncasters and collapses the spell section', () => {
  const noncaster = { ...base, className: 'Fighter', spellcasting: { ability: 'wis' as const, tradition: '', rank: 1, slots: {} } }
  const classes: ContentEntry[] = [{
    id: 'fighter', systems: ['pf2e'], kind: 'class', source: 'official', name: 'Fighter', level: 1,
    traits: [], description: '', data: {}, effects: [], updatedAt: 1,
  }]
  const markup = renderToStaticMarkup(<SpellsSection c={noncaster} entries={classes} save={() => {}} />)
  expect(markup).toContain('<details class="character-section">')
  expect(markup).toContain('<strong>Spells</strong><span>0 spells</span>')
  expect(markup).not.toContain('Casting ability')
  expect(markup).not.toContain('Spell slots:')
  expect(markup).not.toContain('Spellcasting Trained')
})

it('alphabetizes repeated feat selections by choice, leaving unchosen copies last', () => {
  const selections = [
    { name: 'Initiate Warden', choice: 'Heal Companion' },
    { name: 'Initiate Warden' },
    { name: 'Initiate Warden', choice: 'Gravity Weapon' },
  ]
  expect(selections.sort(compareFeatSelections).map((f) => f.choice)).toEqual(['Gravity Weapon', 'Heal Companion', undefined])
})

it('allows a text choice for other repeatable feats without granting an unrelated spell', () => {
  let c: Character = { ...base, feats: [{ name: 'Weapon Specialization Tweak', type: 'Class Feat', level: 2 }] }
  const feat: ContentEntry = {
    id: 'order', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Weapon Specialization Tweak', level: 2,
    traits: ['Druid'], description: '', data: { repeatable: true }, effects: [], updatedAt: 1,
  }
  const tree = FeatChoice({ c, entries: [feat], index: 0, save: (patch) => { c = { ...c, ...patch } } })
  expect(renderToStaticMarkup(tree)).toContain('Weapon Specialization Tweak choice')
  if (!isValidElement<{ children: ReactNode }>(tree)) throw new Error('Missing choice field')
  const field = Children.toArray(tree.props.children).find((child) => isValidElement(child) && child.type === 'input')
  if (!isValidElement<{ onBlur: (event: { target: { value: string } }) => void }>(field)) throw new Error('Missing choice input')
  field.props.onBlur({ target: { value: 'Leaf' } })
  expect(c.feats[0].choice).toBe('Leaf')
  expect(grantedWardenSpells(c, [feat])).toEqual([])
})

it('offers Snare Hopping with the Initiate Warden spells', () => {
  const snare: ContentEntry = { ...spell('Snare Hopping', 'Initiate'), data: {} }
  const options = wardenSpellOptions({ name: 'Initiate Warden', type: 'Class Feat', level: 1 }, [...entries, snare])
  expect(options.map((o) => o.name)).toEqual(['Gravity Weapon', 'Heal Companion', 'Snare Hopping'])
  expect(wardenSpellOptions({ name: 'Advanced Warden', type: 'Class Feat', level: 4 }, [...entries, snare]).map((o) => o.name)).toEqual(['Animal Feature'])
})

it('keeps cached Warden choices scoped to tier, system, and current catalog', () => {
  const catalog: ContentEntry[] = [...entries, { ...spell('Other System', 'Initiate'), systems: ['sf2e'] }]
  const initiate = { name: 'Initiate Warden' }
  const advanced = { name: 'Advanced Warden' }
  expect(wardenSpellOptions(initiate, catalog).map(spell => spell.name)).toEqual(['Gravity Weapon', 'Heal Companion'])
  expect(wardenSpellOptions(advanced, catalog).map(spell => spell.name)).toEqual(['Animal Feature'])
  const updated = catalog.map(spell => spell.name === 'Gravity Weapon' ? { ...spell, data: { warden_spell_tier: 'Advanced' } } : spell)
  expect(wardenSpellOptions(initiate, updated).map(spell => spell.name)).toEqual(['Heal Companion'])
  expect(wardenSpellOptions(advanced, updated).map(spell => spell.name)).toEqual(['Animal Feature', 'Gravity Weapon'])
})

it('offers only summon spells from the caster tradition as Rites of Convocation variants', () => {
  const summon = (name: string, tradition: string): ContentEntry => ({ ...spell(name, 'Initiate'), traits: [], data: { tradition } })
  const klass: ContentEntry = { ...spell('Witch', 'Initiate'), kind: 'class', data: { tradition: 'Occult' } }
  const spells = [summon('Summon Entity', 'Occult'), summon('Summon Animal', 'Primal'), summon('Summon Lesser Servitor', 'Divine, Occult'),
    summon('Heal', 'Occult'), klass]
  const witch: Character = { ...base, className: 'Witch' }
  expect(featChoiceOptions('Rites of Convocation', witch, spells, 'class:4')).toEqual(['Summon Entity', 'Summon Lesser Servitor'])
})
