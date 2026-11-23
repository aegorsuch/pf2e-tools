import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import { Info, SourceNote } from './Info'
import { EntryDescription } from './EntryDescription'
import { ADVANCED_TYPES, companionItemName, beastmasterSpecializationKey, companionAdvancement, companionAdvancementFor, companionStats, constructCompanionAdvancement, CONSTRUCT_COMPANION_ENTRY,
  CONSTRUCT_COMPANION_NAME, hasConstructInnovation, minionFerocity, specializationOptions } from './companions'
import { ABILITY_LABEL, ABILITIES, activeFeatsNamed, armorClassBreakdown, classSpellSlots, classSpellcasting, featTakenLevel, isMagicHideActive, knowsSpell, languageAllowance, languageGroups, magicHideChange, migrateAncestralLinguistics, oakenResilience, ranksAt, savingThrowBreakdown, signed, spellDCText, type SectionProps, type TotalBreakdown } from './builder'
import { adoptedAncestryText, isCompanionAdvancement, isCompanionSpecialization, selectedFeatEntry } from './featChoices'
import { CompanionSpellOptions } from './SpellsSection'
import { ActionIcon } from './ActionIcon'
import { DamageRoll } from './SpellDamage'
import { newId } from './db'
import { getSettings } from './settings'
import { SearchableSelect } from './SearchableSelect'
import { bardingOptions, equippedBarding, isCompanionEquipmentItem } from './companions'
import { confirmRemoval } from './confirmRemoval'
import { activeCaypinAlly, activeLashuntaAlly, activeShirrenAlly } from './featSpells'
import { activeSummonedFiend, type SummonedFiend } from './summonedFiends'
import { DroneFeatures } from './DroneFeatures'
import { FOLLOWER_STAGES, FOLLOWER_TYPES, followerStage, followerStats } from './followers'
import { FAMILIAR_RESISTANCE_TYPES, FAMILIAR_SKILLS, familiarAbilityCapacity, familiarAbilityEffects, familiarAbilityEntries,
  familiarAbilityEntry, familiarAbilityUnavailableReason, familiarSelection, isFamiliarAbilityRepeatable, minionMovementSpeeds } from './familiarAbilities'
import type { Character, CompanionEquipment, CompanionEquipmentSlot, ContentEntry } from './types'

const RANK_LETTER = ['U', 'T', 'E', 'M', 'L']
const COMPANION_EQUIPMENT_SLOTS: CompanionEquipmentSlot[] = ['Barding', 'Collar', 'Other', 'Saddle', 'Shoes']
const PET_ABILITIES = ['Amphibious', 'Burrower', 'Climber', 'Darkvision', 'Echolocation', 'Fast Movement', 'Flier', 'Manual Dexterity', 'Scent', 'Tough']
const ADEPT_NOVICE_ENERGY = ['Acid', 'Cold', 'Electricity', 'Fire', 'Mental', 'Poison', 'Void']
const ADEPT_VETERAN_ENERGY = ['Force', 'Sonic', 'Spirit', 'Vitality']
const followerCount = (c: Character) => c.systems.includes('pf2e') && activeFeatsNamed(c, 'Captain Dedication').length
  ? Math.min(4, 1 + activeFeatsNamed(c, 'Additional Follower').length) : 0
const followerTitle = (c: Character, index: number) => {
  const follower = c.followers?.[index]
  const ancestry = activeFeatsNamed(c, 'Leader of All').length ? follower?.ancestry ?? 'Human' : 'Human'
  return `${ancestry} ${follower?.type ?? 'Follower'}`
}
const PET_ABILITY_NOTES: Record<string, string> = {
  Amphibious: 'Breathes air and water; land and swim Speeds equal highest land or swim Speed.',
  Burrower: 'Burrow Speed 5 feet; can dig Tiny holes.',
  Climber: 'Climb Speed 25 feet.',
  Darkvision: 'Darkvision.',
  Echolocation: 'Precise hearing within 20 feet.',
  Flier: 'Fly Speed 25 feet.',
  'Manual Dexterity': 'Can use up to two limbs as hands for manipulate actions.',
  Scent: 'Imprecise scent within 30 feet.',
}

const SUMMONED_CREATURES = {
  Emganat: {
    level: 3, traits: ['Medium', 'Kucharn'],
    abilities: [2, 4, 1, 0, 0, -2], hp: 38, ac: 18, saves: [8, 11, 7],
    perception: 9, senses: 'Darkvision, motion sense (imprecise) 30 feet', skills: ['Athletics +9', 'Stealth +11'],
    speed: '20 feet, burrow 30 feet', languages: 'Shirren; telepathy 100 feet', resistances: 'acid 5',
    attacks: [{ name: 'Claws', traits: 'agile', bonus: 11, damage: '1d8+4 piercing' },
      { name: 'Acidic Mouth Cannon', traits: 'acid, range increment 15 feet', bonus: 13, damage: '1d8 acid plus 1d4 persistent acid' }],
    specials: [
      { name: 'Colony Mind', description: 'Telepathic communication with allies with colony mind within 30 feet; successful saves against mental effects become critical successes while in range of an ally with colony mind.' },
      { name: 'Burrowing Reveal', actions: 'Reaction', description: 'Before initiative, when a creature enters motion sense range while burrowed, Burrow to emerge before rolling initiative.' },
      { name: 'Coordinated Digestion', description: 'A mouth cannon hit increases existing persistent acid damage dice by one step, up to d8.' },
    ],
    url: 'https://2e.aonsrd.com/creatures/93-emganat',
  },
  Caypin: {
    level: 6, traits: ['Large', 'Amphibious', 'Beast'],
    abilities: [5, 3, 4, -3, -1, -1], hp: 100, ac: 24, saves: [17, 14, 11],
    perception: 14, senses: 'Darkvision', skills: ['Acrobatics +13', 'Athletics +15', 'Stealth +13'],
    speed: '40 feet, swim 30 feet',
    attacks: [{ name: 'Claw', traits: 'agile', bonus: 16, damage: '2d6+8 slashing' },
      { name: 'Jaws', traits: '', bonus: 16, damage: '2d8+8 piercing' }],
    specials: [
      { name: 'Appendage Cluster', description: 'Up to two detached Small minions; each has 30 HP, Speed 20 feet, swim 15 feet, darkvision, and the caypin’s AC, saves, and skills. Jaws +14, 2d4+3 piercing. They share its senses and die if it dies or they move over 100 feet away. Losing both clusters blinds the caypin until one regrows in 3 days.' },
      { name: 'Aquatic Ambush', actions: 'Single Action', description: 'Aquatic Ambush 40 feet.' },
      { name: 'Cluster Onslaught', actions: 'Single Action', description: 'The cluster Tumbles Through using Acrobatics; success deals 3d8 piercing, and critical success also deals 4 persistent bleed.' },
      { name: 'Detach Cluster', actions: 'Single Action', description: 'Detach a cluster into an adjacent square. With both detached, the caypin cannot use its jaws or detach another. An adjacent cluster can reattach with an Interact action.' },
    ],
    url: 'https://2e.aonsrd.com/creatures/183-caypin',
  },
  Squox: {
    level: -1, traits: ['Tiny', 'Animal'],
    abilities: [0, 3, 0, -4, 0, 1], hp: 7, ac: 14, saves: [2, 7, 2],
    perception: 6, senses: 'Low-light vision, scent (imprecise) 30 feet',
    skills: ['Acrobatics +6', 'Stealth +6', 'Thievery +6'], speed: '25 feet, climb 20 feet',
    attacks: [{ name: 'Jaws', traits: 'agile, finesse', bonus: 6, damage: '1d4 piercing' }],
    specials: [{ name: 'Squox Tricks', description: 'Use Acrobatics to Disarm or Trip with its tail without a free hand. Against off-guard targets, it can attempt either against creatures up to two sizes larger and gains a +2 circumstance bonus.' }],
    url: 'https://2e.aonsrd.com/creatures/98-squox',
  },
  Shotalashu: {
    level: 2, traits: ['Large', 'Beast'],
    abilities: [2, 4, 2, -3, 3, 2], hp: 35, ac: 18, saves: [8, 10, 11],
    perception: 9, senses: 'Darkvision', skills: ['Acrobatics +8', 'Athletics +8', 'Stealth +8', 'Survival +7'],
    speed: '40 feet', languages: 'Understands Elven and Lashunta; cannot speak',
    attacks: [{ name: 'Claws', traits: 'agile, finesse', bonus: 10, damage: '1d6+2 slashing plus 1d4 mental' }],
    specials: [
      { name: 'Empathic Communication', description: 'Understands simple commands and communicates emotions telepathically to creatures touching it or its linked partner at any distance.' },
      { name: 'Telepathic Link', description: 'A rider bonds after one week and a DC 21 Occultism check; telepathic capabilities grant +4 circumstance. The link lasts until either dies. The survivor is stupefied 2 for 24 hours and cannot form a new link for at least a month.' },
      { name: 'Jungle Stride', description: 'Ignores difficult terrain caused by vegetation.' },
      { name: 'Telepathic Pounce', actions: 'Two Actions', description: 'One creature within 30 feet attempts a DC 18 Will save. Critical success: no effect. Success: –5-foot status penalty to Speed for 1 round. Failure: –10-foot status penalty to Speed for 1 round; the shotalashu can Leap. Critical failure: off-guard and immobilized for 1 round; the shotalashu can Leap.' },
    ],
    url: 'https://app.demiplane.com/nexus/starfinder2e/creatures/shotalashu',
  },
} satisfies Record<string, {
  level: number; traits: string[]; abilities: number[]; hp: number; ac: number; saves: number[]
  perception: number; senses: string; skills: string[]; speed: string; languages?: string; resistances?: string
  attacks: { name: string; traits: string; bonus: number; damage: string }[]
  specials: { name: string; actions?: string; description: string }[]; url: string
}>

function SummonedCreature({ name, displayName = name }: { name: keyof typeof SUMMONED_CREATURES; displayName?: string }) {
  const creature: (typeof SUMMONED_CREATURES)[keyof typeof SUMMONED_CREATURES] & { languages?: string; resistances?: string } = SUMMONED_CREATURES[name]
  return <details className="character-subsection" open>
    <summary><h4>Summoned {displayName}</h4></summary>
    <div className="gear-traits"><span>Level {creature.level}</span>{creature.traits.map(trait => <span key={trait}>{trait}</span>)}</div>
    <div className="gear-stats">{ABILITIES.map((ability, index) =>
      <span key={ability}><small>{ABILITY_LABEL[ability]}</small>{signed(creature.abilities[index])}</span>)}</div>
    <section className="companion-actions"><h5>Attacks</h5>
      {creature.attacks.map(attack => <div key={attack.name} className="companion-action">
        <div className="companion-action-title"><ActionIcon actions="Single Action" /><b>{attack.name}</b>
          {attack.traits && <small>({attack.traits})</small>}<span>{signed(attack.bonus)}</span><span>— {attack.damage}</span></div>
      </div>)}
    </section>
    <section className="companion-actions"><h5>Defenses</h5><div className="gear-stats">
      <span><small>Hit Points</small><b>{creature.hp}</b></span><span><small>Armor Class</small><b>{creature.ac}</b></span>
      {['Fortitude', 'Reflex', 'Will'].map((save, index) => <span key={save}><small>{save}</small>{signed(creature.saves[index])}</span>)}
    </div>{creature.resistances && <div>Resistances {creature.resistances}</div>}</section>
    <section className="companion-actions"><h5>Senses</h5><div><small>Perception</small> <b>{signed(creature.perception)}</b> · {creature.senses}</div></section>
    <section className="companion-actions"><h5>Skills</h5>{creature.skills.map(skill => <div key={skill}>{skill}</div>)}</section>
    <section className="companion-actions"><h5>Speed</h5><div>{creature.speed}</div></section>
    {creature.languages && <section className="companion-actions"><h5>Languages</h5><div>{creature.languages}</div></section>}
    <section className="companion-actions"><h5>Special</h5>{creature.specials.map(special =>
      <div key={special.name} className="companion-action">
        <div className="companion-action-title">{'actions' in special && special.actions && <ActionIcon actions={special.actions} />}<b>{special.name}</b></div>
        <p className="companion-action-description">{special.description}</p>
      </div>)}</section>
    <a href={creature.url} target="_blank" rel="noreferrer">{name} abilities and statistics</a>
  </details>
}

export function SummonedFiendCard({ fiend, save }: { fiend: SummonedFiend; save: SectionProps['save'] }) {
  const bonus = (value: number | null | undefined) => value == null ? '—' : signed(value)
  return <details className="character-subsection" open>
    <summary><h4>Summoned {fiend.name}</h4></summary>
    <div className="gear-traits"><span>Level {fiend.level}</span>{fiend.traits.map(trait => <span key={trait}>{trait}</span>)}</div>
    <div className="gear-stats">{ABILITIES.map((ability, index) =>
      <span key={ability}><small>{ABILITY_LABEL[ability]}</small>{bonus(fiend.abilities[index])}</span>)}</div>
    <section className="companion-actions"><h5>Attacks</h5>{fiend.attacks.map((attack, index) =>
      <div key={index} className="companion-action"><ActionIcon actions="Single Action" /> {attack}</div>)}</section>
    <section className="companion-actions"><h5>Defenses</h5><div className="gear-stats">
      <span><small>Hit Points</small><b>{fiend.hp ?? '—'}</b></span><span><small>Armor Class</small><b>{fiend.ac ?? '—'}</b></span>
      {['Fortitude', 'Reflex', 'Will'].map((name, index) => <span key={name}><small>{name}</small>{bonus(fiend.saves[index])}</span>)}
    </div>{fiend.resistances && <div>Resistances {fiend.resistances}</div>}
      {fiend.weaknesses && <div>Weaknesses {fiend.weaknesses}</div>}</section>
    <section className="companion-actions"><h5>Senses</h5><div><small>Perception</small> <b>{bonus(fiend.perception)}</b> · {fiend.senses}</div></section>
    <section className="companion-actions"><h5>Skills</h5><div>{fiend.skills}</div></section>
    <section className="companion-actions"><h5>Speed</h5><div>{fiend.speed}</div></section>
    <a href={fiend.url} target="_blank" rel="noreferrer">{fiend.name} abilities and statistics</a>
    <button type="button" aria-label={`Dismiss summoned ${fiend.name}`} onClick={() => confirmRemoval(`summoned ${fiend.name}`, () => save({ summonedFiend: undefined }))}>Dismiss</button>
  </details>
}

const companionEntryCache = new WeakMap<ContentEntry[], Map<boolean, ContentEntry[]>>()
const companionTypeCache = new WeakMap<ContentEntry[], ContentEntry[]>()

function companionEntriesFor(entries: ContentEntry[], needsConstructEntry: boolean) {
  let variants = companionEntryCache.get(entries)
  if (!variants) companionEntryCache.set(entries, variants = new Map())
  let result = variants.get(needsConstructEntry)
  if (!result) {
    result = needsConstructEntry && !entries.some(entry => entry.id === CONSTRUCT_COMPANION_ENTRY.id)
      ? [...entries, CONSTRUCT_COMPANION_ENTRY] : entries
    variants.set(needsConstructEntry, result)
  }
  return result
}

function companionTypes(entries: ContentEntry[]) {
  let types = companionTypeCache.get(entries)
  if (!types) {
    types = entries.filter(entry => entry.kind === 'companion' && !entry.deleted)
      .sort((a, b) => a.name.localeCompare(b.name))
    companionTypeCache.set(entries, types)
  }
  return types
}

const UNDEAD_FAMILIAR_TRAIT: ContentEntry = {
  id: 'undead-familiar-trait', systems: ['pf2e'], name: 'Undead', kind: 'trait', source: 'official', level: 0,
  traits: [], description: "Immune to bleed, death effects, disease, mental, and poison. Can't choose familiar abilities that change its trait, such as Construct or Dragon. Can be targeted by spells and abilities that target your thralls. If destroyed, can be raised during next daily preparations.",
  data: {}, effects: [], updatedAt: 0,
}

function minionSummaryData(c: Character) {
  const companions = c.companions ?? []
  const advancement = companionAdvancement(c)
  const constructAdvancement = constructCompanionAdvancement(c)
  const stage = [advancement.advanced, advancement.mature ? 'Mature' : 'Young'].find(Boolean)
  const { leshy, undeadFamiliar, crocodileFamiliar, familiar, wasp } = familiarSelection(c)
  const seaFriend = activeFeatsNamed(c, 'Friend of the Sea').length > 0
  const pet = seaFriend || activeFeatsNamed(c, 'Pet').length > 0
    || activeFeatsNamed(c, 'Beast Trainer').some(feat => feat.choice === 'Pet')
  return { companions, advancement, constructAdvancement, stage, leshy, undeadFamiliar, crocodileFamiliar, familiar, wasp, seaFriend, pet }
}

function companionTitle(c: Character, index: number) {
  const companion = c.companions![index]
  const advancement = companion.type === CONSTRUCT_COMPANION_NAME
    ? constructCompanionAdvancement(c) : companionAdvancementFor(c, index)
  const stage = advancement.advanced ?? (advancement.mature
    ? companion.type === CONSTRUCT_COMPANION_NAME ? 'Advanced' : 'Mature'
    : companion.type === CONSTRUCT_COMPANION_NAME ? 'Prototype' : 'Young')
  return `${stage} ${companion.type}${companion.name && companion.name !== companion.type ? ` (${companion.name})` : ''}`
}

function SortedMinionSections({ children }: { children: ReactNode }) {
  const name = (child: ReactNode) => {
    if (!isValidElement<Record<string, unknown>>(child)) return ''
    if (child.type === SummonedCreature) return `Summoned ${child.props.displayName ?? child.props.name}`
    if (child.type === SummonedFiendCard) return `Summoned ${(child.props.fiend as SummonedFiend).name}`
    return String(child.props['data-minion-name'] ?? '')
  }
  return <>{Children.toArray(children).sort((a, b) => name(a).localeCompare(name(b), undefined, { sensitivity: 'base' }))}</>
}

function MinionFerocity({ c, ferocity }: { c: Character; ferocity: ReturnType<typeof minionFerocity> }) {
  if (!ferocity) return null
  const name = adoptedAncestryText(c, 'Orc Ferocity')
  return <section className="companion-actions" aria-label={name}>
    <h5>Reactions</h5>
    <div className="companion-action">
      <div className="companion-action-title">
        <ActionIcon actions="Reaction" /><b>{name}</b>
      </div>
      <p className="companion-action-description">Once per day, when reduced to 0 HP but not immediately killed, remain at 1 HP instead of being knocked out; wounded increases by 1. One reaction per round, usable only for {name}.
        {ferocity.temporaryHp > 0 && <> Gain {ferocity.temporaryHp} temporary HP when using {name}.</>}
      </p>
    </div>
  </section>
}

export function CompanionEquipmentSlots({ c, companion, entries, save, size }: {
  c: Character
  companion: NonNullable<Character['companions']>[number]
  entries: SectionProps['entries']
  save: SectionProps['save']
  size?: string
}) {
  const available = entries.filter(entry => !entry.deleted && entry.systems.some(system => c.systems.includes(system)))
  const options = [...available.filter(entry => isCompanionEquipmentItem(entry)
    && (!/\bbarding\b/i.test(entry.name) || /\bsaddle\b/i.test(entry.name))),
    ...bardingOptions(entries, c.level, size).filter(entry => entry.systems.some(system => c.systems.includes(system)))]
  const selectedOther = Array.isArray(companion.equipment?.Other)
    ? companion.equipment.Other
    : companion.equipment?.Other ? [companion.equipment.Other] : []
  const bySlot = (slot: CompanionEquipmentSlot, selectedIds: string[] = []) => {
    const matches = options.filter(entry => {
      const text = `${entry.name} ${entry.traits.join(' ')} ${String(entry.data.item_category ?? '')} ${String(entry.data.item_subcategory ?? '')}`
      switch (slot) {
        case 'Barding': return !!entry.data.barding_type
        case 'Collar': return /\bcollar\b/i.test(text)
        case 'Saddle': return /\bsaddle\b/i.test(text)
        case 'Shoes': return /\b(?:shoes|boots|horseshoes?)\b/i.test(text)
        case 'Other': return ['steadyfoottassel', 'hostelingstatuette'].includes(entry.name.toLowerCase().replace(/[^a-z0-9]/g, ''))
      }
    }).sort((a, b) => a.name.localeCompare(b.name) || a.level - b.level)
    const unique = new Map<string, ContentEntry>()
    for (const entry of matches) {
      const key = entry.name.trim().toLowerCase()
      if (!unique.has(key) || selectedIds.includes(entry.id)) unique.set(key, entry)
    }
    return [...unique.values()]
  }
  const saveEquipment = (equipment: NonNullable<typeof companion.equipment>) => {
    save({ companions: (c.companions ?? []).map(current => current.id === companion.id
      ? { ...current, equipment: Object.keys(equipment).length ? equipment : undefined } : current) })
  }
  const update = (slot: Exclude<CompanionEquipmentSlot, 'Other'>, item: NonNullable<typeof companion.equipment>[Exclude<CompanionEquipmentSlot, 'Other'>] | undefined) => {
    const equipment = { ...companion.equipment }
    if (item) equipment[slot] = item
    else delete equipment[slot]
    saveEquipment(equipment)
  }
  const updateOther = (item: Pick<CompanionEquipment, 'entryId' | 'name'>, checked: boolean) => {
    const equipment = { ...companion.equipment }
    const current = selectedOther.filter(other => other.entryId !== item.entryId)
    const next = checked ? [...current, { ...item, qty: 1 }] : current
    if (next.length) equipment.Other = next.sort((a, b) => a.name.localeCompare(b.name))
    else delete equipment.Other
    saveEquipment(equipment)
  }
  const itemName = (name: string) => companionItemName(companion.type, name)
  const itemTag = (slot: CompanionEquipmentSlot, item: CompanionEquipment, entry?: ContentEntry) =>
    <div key={item.entryId} className="rune">
      <EntryDescription name={itemName(entry?.name ?? item.name)} entry={entry} entries={entries} character={c} />
      {!entry && <span> (unavailable)</span>}
      <button type="button" aria-label={`Remove ${companion.name || companion.type} ${slot}: ${entry?.name ?? item.name}`}
        onClick={() => confirmRemoval(`"${entry?.name ?? item.name}"`, () =>
          slot === 'Other' ? updateOther(item, false) : update(slot, undefined))}>×</button>
    </div>
  return <section className="col companion-equipment" aria-label={`${companion.name || companion.type} equipment`}>
    <h5>Equipment</h5>
    {COMPANION_EQUIPMENT_SLOTS.map(slot => {
      if (slot === 'Other') {
        const selectedIds = selectedOther.map(item => item.entryId)
        const slotOptions = bySlot(slot, selectedIds)
        const remaining = slotOptions.filter(entry => !selectedIds.includes(entry.id))
        return <div key={slot} className="row companion-equipment-slot companion-other-equipment" role="group"
          aria-label={`${companion.name || companion.type} Other equipment`}>
          <strong>Other</strong>
          {[...selectedOther].sort((a, b) => a.name.localeCompare(b.name))
            .map(item => itemTag(slot, item, slotOptions.find(entry => entry.id === item.entryId)))}
          {remaining.length > 0 && <SearchableSelect aria-label={`${companion.name || companion.type} Add other equipment`}
            value="" optionCount={remaining.length} optionLevel={value => remaining.find(option => option.id === value)?.level} renderDetails={value => {
              const entry = remaining.find(option => option.id === value)
              return entry && <EntryDescription name={itemName(entry.name)} entry={entry} entries={entries} character={c} buttonLabel="Details" />
            }} onChange={event => {
              const entry = remaining.find(option => option.id === event.target.value)
              if (entry) updateOther({ entryId: entry.id, name: entry.name }, true)
            }}>
            <option value="">Choose other equipment...</option>
            {remaining.map(entry => <option key={entry.id} value={entry.id}>{itemName(entry.name)}</option>)}
          </SearchableSelect>}
        </div>
      }
      const selected = companion.equipment?.[slot]
      const slotOptions = bySlot(slot, selected ? [selected.entryId] : [])
      const selectedEntry = selected && (slot === 'Barding'
        ? equippedBarding(entries, c.level, selected, size) : slotOptions.find(entry => entry.id === selected.entryId))
      return <div key={slot} className="row companion-equipment-slot">
        <strong>{slot}</strong>
        {selected ? itemTag(slot, selected, selectedEntry) : <SearchableSelect aria-label={`${companion.name || companion.type} ${slot} equipment`}
          value="" optionCount={slotOptions.length} optionLevel={value => slotOptions.find(option => option.id === value)?.level}
          renderDetails={value => {
            const entry = slotOptions.find(option => option.id === value)
            return entry && <EntryDescription name={itemName(entry.name)} entry={entry} entries={entries} character={c} buttonLabel="Details" />
          }}
          onChange={event => {
            const entry = slotOptions.find(option => option.id === event.target.value)
            if (entry) update(slot, { entryId: entry.id, name: entry.name, qty: 1 })
          }}>
          <option value="">{slot === 'Barding' ? 'None' : `Choose ${slot.toLowerCase()}...`}</option>
          {slotOptions.map(entry => <option key={entry.id} value={entry.id}>{itemName(entry.name)}</option>)}
        </SearchableSelect>}
      </div>
    })}
  </section>
}

export function MinionsSummary({ c }: Pick<SectionProps, 'c'>) {
  const { companions, leshy, undeadFamiliar, crocodileFamiliar, familiar, wasp, seaFriend, pet } = minionSummaryData(c)
  const lashuntaAlly = activeLashuntaAlly(c)
  return <summary className="character-section-summary">
    <strong>Minions</strong>
    <span>{[...companions.map((_, index) => companionTitle(c, index)),
      ...(c.className === 'Mechanic' && c.systems.includes('sf2e') && c.subclass === 'Drone' ? ['Drone'] : []),
      ...(familiar ? [leshy ? 'Leshy Familiar' : undeadFamiliar ? 'Undead Familiar'
        : crocodileFamiliar ? 'Crocodile Familiar' : 'Familiar'] : []), ...(wasp ? ['Wasp Familiar'] : []),
      ...(pet ? [seaFriend ? 'Aquatic Pet' : 'Pet'] : []), ...(activeCaypinAlly(c) ? ['Summoned Caypin'] : []),
      ...Array.from({ length: followerCount(c) }, (_, index) => {
        return followerTitle(c, index)
      }),
      ...(lashuntaAlly ? [`Summoned ${lashuntaAlly}`] : []),
      ...(activeShirrenAlly(c) ? ['Summoned Kucharn'] : []),
      ...(activeSummonedFiend(c) ? [`Summoned ${activeSummonedFiend(c)!.name}`] : [])]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })).join(', ') || '0 minions'}</span>
  </summary>
}

export function MinionsSection(props: SectionProps) {
  return <details className="character-section">
    <MinionsSummary {...props} />
    <MinionsContent {...props} />
  </details>
}

export function FollowerCards({ c, entries, save }: SectionProps) {
  const ancestries = [...new Set(entries.filter(entry => entry.kind === 'ancestry' && !entry.deleted
    && entry.systems.includes('pf2e')).map(entry => entry.name))].sort((a, b) => a.localeCompare(b))
  const update = (index: number, patch: Partial<NonNullable<Character['followers']>[number]>) => {
    const followers = [...(c.followers ?? [])]
    while (followers.length <= index) followers.push({})
    followers[index] = { ...followers[index], ...patch }
    save({ followers })
  }
  return Array.from({ length: followerCount(c) }, (_, index) => {
    const follower = c.followers?.[index]
    const typeIndex = FOLLOWER_TYPES.indexOf(follower?.type ?? '')
    const stage = followerStage(c)
    const stats = followerStats(c, follower?.type, follower?.adeptSkill)
    const specials: { name: string; actions?: string; text: string }[] = []
    if (follower?.type === 'Sharpshooter') {
      specials.push({ name: 'Take Aim', actions: 'Two Actions', text: `Make a ranged Strike with a +2 circumstance bonus to attack${stage >= 2 ? ', ignoring concealment' : ''}.` })
      if (stage >= 1) specials.push({ name: 'Slowing Shot', text: 'Ranged Strike damage reduces target Speeds by 5 feet for 1 round, or 10 feet on a critical hit.' })
      if (stage >= 3) specials.push({ name: 'Following Shot', actions: 'Free Action', text: 'Once per turn, after a ranged critical hit with a reload 0 weapon, Strike again with that weapon at the same multiple attack penalty; this Strike counts toward the penalty.' })
    } else if (follower?.type === 'Berserker') {
      specials.push({ name: 'Berserker', text: `After taking damage, gain a +${stage + 1} status bonus to the next damage roll before the end of your next turn.` })
      if (stage >= 2) specials.push({ name: 'Reckless Attack', actions: 'Free Action', text: 'Once per turn when Directed, gain +1 circumstance to the next attack this turn; remain off-guard until your next turn.' })
      if (stage >= 3) specials.push({ name: 'Share the Pain', actions: 'Reaction', text: 'When critically hit by a creature within reach, make a melee Strike against it. Gain a reaction when Directed, lost at the start of your next turn if unused.' })
    } else if (follower?.type === 'Medic') {
      specials.push({ name: 'Battle Medicine', actions: 'Single Action', text: stage === 0 ? 'Has Battle Medicine and a healer’s toolkit.'
        : `Has Battle Medicine and a healer’s toolkit; may treat a temporarily immune creature once per ${stage === 3 ? 'hour' : 'day'}.` })
      if (stage >= 1) specials.push({ name: 'Scalpel', text: `${stage === 3 ? '2' : '1'} persistent bleed on a Strike, or ${stage === 3 ? '2d6' : '1d6'} on a critical hit.` })
      if (stage >= 2) specials.push({ name: 'Medic’s Treatment', actions: 'Single Action', text: 'With a healer’s toolkit, attempt a Medicine counteract check against an adjacent creature’s clumsy, enfeebled, sickened, or stupefied condition; counteract rank is half the follower’s level.' })
      if (stage >= 3) specials.push({ name: 'Quick Treatment', actions: 'Single Action', text: 'Once per round, Stride then Administer First Aid, Battle Medicine, Medic’s Treatment, or Treat Poison.' })
    } else if (follower?.type === 'Scout') {
      specials.push({ name: 'Precision Damage', text: `Deals ${stage >= 2 ? '1d6' : '1d4'} extra precision damage against off-guard targets.` })
      specials.push({ name: 'Exploration', text: stage === 3 ? 'Can Scout, Avoid Notice, and Search together without spending your exploration activity.'
        : `Can Scout${stage >= 1 ? ' or Search' : ''} without spending your exploration activity.` })
      if (stage >= 2) specials.push({ name: 'Exploit Injury', actions: 'Single Action', text: 'After a successful melee Strike against an off-guard target, keep it off-guard until the end of your next turn.' })
    } else if (follower?.type === 'Shieldbearer') {
      const shields = [[5, 20, 10], [6, 40, 20], [8, 64, 32], [10, 100, 50]]
      const [hardness, hp, bt] = shields[stage]
      specials.push({ name: 'Shield', text: `Hardness ${hardness}, HP ${hp}, BT ${bt}; Raise a Shield grants +2 circumstance AC. Has Shield Block and gains a reaction when Directed.${stage >= 1 ? ` Can Shield Block for ${stage >= 2 ? 'an adjacent ally' : 'you while adjacent'}.` : ''}${stage >= 3 ? ' Gains an additional reaction for Shield Block protecting themself.' : ''}` })
      if (stage >= 2) specials.push({ name: 'Bulwark', text: 'Armor has the bulwark trait; the kit includes a repair toolkit.' })
    } else if (follower?.type === 'Adept') {
      specials.push({ name: 'Spellshaped Blast', actions: 'Two Actions', text: 'Make an energy blast with two choices: fatal d8, 120-foot range, or splash damage equal to its damage dice.' })
      if (stage >= 2) {
        specials.push({ name: 'Dagger Energy', text: `Dagger Strikes deal ${stage === 3 ? 5 : 3} additional damage of a selected energy type.` })
        specials.push({ name: 'Energy Deflection', actions: 'Reaction', text: `Protect yourself or an ally within 10 feet against eligible energy damage: resistance ${Math.floor(c.level / 2)}, or ${c.level} against a selected blast damage type. Target is then immune for 1 minute.` })
      }
      if (stage >= 3 && stats) specials.push({ name: 'Energy Wave', actions: 'Two Actions', text: `Deal energy blast damage in a 15-foot or 30-foot cone with a basic Reflex save against DC ${10 + c.level + 4 + stats.attributes.int}. Recharge after 1d6 rounds.` })
    }
    return <details className="character-subsection" data-minion-name={followerTitle(c, index)} open key={`follower:${index}`}>
      <summary><h4>{followerTitle(c, index)}</h4></summary>
      <div className="gear-traits"><span>Level {c.level}</span><span>{FOLLOWER_STAGES[stage]}</span><span>Minion</span></div>
      <label>Type <select aria-label={`Follower ${index + 1} type`} value={follower?.type ?? ''}
        onChange={event => update(index, { type: event.target.value || undefined })}>
        <option value="">Choose follower...</option>{FOLLOWER_TYPES.map(type => <option key={type}>{type}</option>)}
      </select></label>
      {!!activeFeatsNamed(c, 'Leader of All').length && <SearchableSelect label="Ancestry" aria-label={`Follower ${index + 1} ancestry`}
        value={follower?.ancestry ?? 'Human'} onChange={event => update(index, { ancestry: event.target.value })}>
        {[...new Set(['Human', follower?.ancestry].filter((name): name is string => !!name && !ancestries.includes(name)))]
          .map(name => <option key={name}>{name}</option>)}
        {ancestries.map(name => <option key={name}>{name}</option>)}
      </SearchableSelect>}
      {follower?.type === 'Adept' && <label>Skill <select aria-label={`Follower ${index + 1} adept skill`}
        value={follower.adeptSkill ?? ''} onChange={event => update(index, { adeptSkill: event.target.value || undefined })}>
        <option value="">Choose skill...</option>{['Nature', 'Occultism', 'Religion'].map(skill => <option key={skill}>{skill}</option>)}
      </select></label>}
      {follower?.type === 'Adept' && Array.from({ length: stage >= 2 ? 3 : 2 }, (_, slot) => {
        const selected = follower.energyTypes ?? []
        const choices = slot === 2 ? [...ADEPT_NOVICE_ENERGY, ...ADEPT_VETERAN_ENERGY] : ADEPT_NOVICE_ENERGY
        return <select key={slot} aria-label={`Follower ${index + 1} energy ${slot + 1}`}
          value={selected[slot] ?? ''} onChange={event => {
            const energyTypes = [...selected]
            while (energyTypes.length <= slot) energyTypes.push('')
            energyTypes[slot] = event.target.value
            update(index, { energyTypes })
          }}>
          <option value="">Choose energy...</option>
          {choices.map(energy => <option key={energy} disabled={selected.slice(0, stage >= 2 ? 3 : 2).some((value, i) => i !== slot && value === energy)}>{energy}</option>)}
        </select>
      })}
      {stats && <>
        <div className="gear-stats">{ABILITIES.map(ability => <span key={ability}><small>{ABILITY_LABEL[ability]}</small>{signed(stats.attributes[ability])}</span>)}</div>
        <section className="companion-actions"><h5>Attacks</h5>{stats.attacks.map(attack =>
          <div className="companion-action" key={attack.name}><div className="companion-action-title"><ActionIcon actions="Single Action" />
            <b>{attack.name}</b> {attack.traits && <small>({attack.traits})</small>} <span>{signed(attack.bonus)}</span><span>— {attack.damage.replace('chosen energy',
              follower?.energyTypes?.slice(0, stage >= 2 ? 3 : 2).filter(Boolean).join(' / ').toLowerCase() || 'chosen energy')}</span>
          </div>{stage >= 2 && <small>Magical for overcoming resistances</small>}</div>)}</section>
        <section className="companion-actions"><h5>Defenses</h5><div className="gear-stats">
          <span><small>Hit Points</small><b>{stats.hp}</b></span><span><small>Armor Class</small><b>{stats.ac}</b></span>
          {['Fortitude', 'Reflex', 'Will'].map((name, i) => <span key={name}><small>{name}</small>{signed(stats.saves[i])}</span>)}
        </div><div>Kit armor +{stats.armor}, Dexterity cap +{stats.dexCap}</div></section>
        <section className="companion-actions"><h5>Senses</h5><div>Perception {signed(stats.perception)}</div></section>
        <section className="companion-actions"><h5>Skills</h5>{stats.skills.map(skill =>
          <div key={skill.name}>{skill.name} {signed(skill.value)}</div>)}</section>
        {specials.length > 0 && <section className="companion-actions"><h5>Special</h5>{specials.map(special =>
          <div className="companion-action" key={special.name}><div className="companion-action-title">
            {special.actions && <ActionIcon actions={special.actions} />}<b>{special.name}</b></div>
            <p className="companion-action-description">{special.text}</p></div>)}</section>}
      </>}
      <a href={typeIndex < 0 ? 'https://2e.aonprd.com/Followers.aspx' : `https://2e.aonprd.com/Followers.aspx?ID=${typeIndex + 1}`}
        target="_blank" rel="noreferrer">Follower statistics and abilities</a>
    </details>
  })
}

export function MinionsContent({ c, entries, save }: SectionProps) {
  const { companions, constructAdvancement, leshy, undeadFamiliar, crocodileFamiliar, familiar, wasp, seaFriend, pet } = minionSummaryData(c)
  const lashuntaAlly = activeLashuntaAlly(c)
  const ferocity = minionFerocity(c)
  const magicHideKnown = knowsSpell(c, entries, 'Magic Hide')
  const needsConstructEntry = hasConstructInnovation(c) || companions.some(comp => comp.type === CONSTRUCT_COMPANION_NAME)
  const companionEntries = companionEntriesFor(entries, needsConstructEntry)
  const faithfulSteed = activeFeatsNamed(c, 'Faithful Steed').length > 0
  const hasAlpha = activeFeatsNamed(c, 'Spirit of the Alpha').length > 0
  const animalCompanionGrant = c.className === 'Druid' && (c.order ?? c.subclass) === 'Animal'
    || activeFeatsNamed(c, 'Animal Companion').length > 0
    || activeFeatsNamed(c, 'Animal Trainer Dedication').length > 0
    || activeFeatsNamed(c, "Commander's Companion").length > 0
  const beastmaster = activeFeatsNamed(c, 'Beastmaster Dedication').length > 0
  const companionGrant = faithfulSteed ? 'Faithful Steed'
    : activeFeatsNamed(c, "Commander's Companion").length > 0 ? "Commander's Companion"
      : animalCompanionGrant ? 'Animal Companion' : beastmaster ? 'Beastmaster Dedication' : undefined
  const companionLimit = beastmaster && !getSettings().singleAnimalCompanion ? Math.min(4, (animalCompanionGrant || faithfulSteed ? 1 : 0) + 1
    + activeFeatsNamed(c, 'Additional Companion').length) : 1
  const needsCompanionOptions = companions.length === 0 && !!companionGrant
    || companions.length > 0 && companions.length < companionLimit
  const types = needsCompanionOptions ? companionTypes(companionEntries) : []
  const familiarCapacity = familiarAbilityCapacity(c, entries)
  const familiarAbilityCatalog = familiarAbilityEntries(entries, c)
  const minionDefense = familiar || wasp || pet ? (() => {
    const base = (breakdown: TotalBreakdown) => breakdown.parts
      .filter(part => !/\((?:circumstance|status)\)/i.test(part.label)).reduce((sum, part) => sum + part.value, 0)
    const ranks = ranksAt(c, entries)
    return { ac: base(armorClassBreakdown(c, entries)), fortitude: base(savingThrowBreakdown(c, entries, 'Fortitude', ranks)),
      reflex: base(savingThrowBreakdown(c, entries, 'Reflex', ranks)), will: base(savingThrowBreakdown(c, entries, 'Will', ranks)) }
  })() : undefined
  const familiarSecrets = leshy && activeFeatsNamed(c, 'Leshy Familiar Secrets').length > 0
  const oaken = leshy && activeFeatsNamed(c, 'Grown of Oak').length > 0 ? oakenResilience(c, entries, 'familiar') : undefined
  const highestSlot = Math.max(c.className === 'Druid' ? Math.ceil(c.level / 2) : 0,
    ...Object.entries(classSpellSlots(c) ?? c.spellcasting?.slots ?? {}).filter(([rank, count]) => Number(rank) >= 1 && count > 0).map(([rank]) => Number(rank)), 0)
  const petAbilities = c.pet?.abilities ?? []
  const choices = c.feats.map((feat, featIndex) => ({ feat, featIndex }))
    .filter(({ feat }) => featTakenLevel(feat) <= c.level && (isCompanionAdvancement(feat.name) && feat.name !== 'Splendid Companion' || isCompanionSpecialization(feat.name)))
    .sort((a, b) => Number(isCompanionAdvancement(b.feat.name)) - Number(isCompanionAdvancement(a.feat.name))
      || (isCompanionAdvancement(a.feat.name) && isCompanionAdvancement(b.feat.name)
        ? Number(!ADVANCED_TYPES.some(type => type === a.feat.choice)) - Number(!ADVANCED_TYPES.some(type => type === b.feat.choice))
        : Number(!a.feat.choice) - Number(!b.feat.choice) || (a.feat.choice ?? '').localeCompare(b.feat.choice ?? '')))
    .filter(({ feat }, index, all) => !isCompanionAdvancement(feat.name)
      || all.findIndex(({ feat: other }) => isCompanionAdvancement(other.name)) === index)
  const update = (id: string, patch: Partial<NonNullable<typeof c.companions>[number]>) =>
    save({ companions: companions.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
  const setFeatChoice = (featIndex: number, choice: string) =>
    save({ feats: c.feats.map((feat, i) => i === featIndex ? { ...feat, choice: choice || undefined } : feat) })
  return (
      <div className="character-section-content minions-section-content">
        <SortedMinionSections>
        {activeCaypinAlly(c) && <SummonedCreature name="Caypin" />}
        {lashuntaAlly && <SummonedCreature name={lashuntaAlly} />}
        {activeShirrenAlly(c) && <SummonedCreature name="Emganat" displayName="Kucharn" />}
        {activeSummonedFiend(c) && <SummonedFiendCard fiend={activeSummonedFiend(c)!} save={save} />}
        {c.className === 'Mechanic' && c.systems.includes('sf2e') && c.subclass === 'Drone' && <details className="character-subsection" data-minion-name="Drone" open>
          <summary><h4>Drone</h4></summary>
          <DroneFeatures c={c} entries={entries} save={save} />
        </details>}
        {companions.length === 0 && companionGrant && <details className="character-subsection" data-minion-name="Animal Companion" open>
          <summary><h4>Animal Companion</h4></summary>
          <span>{companionGrant}{' '}
            <SearchableSelect aria-label="Choose Faithful Steed" value="" onChange={(e) => {
              const type = types.find((type) => type.name === e.target.value)
                if (type) save({ ...(faithfulSteed ? { faithfulSteedGranted: true } : {}),
                  companions: [{ id: newId(), type: type.name, name: '' }] })
            }}>
              <option value="">Choose companion...</option>
              {types.map((type) => <option key={type.id}>{type.name}</option>)}
            </SearchableSelect>
          </span>
        </details>}
          {companions.map((comp, index) => {
              const isConstruct = comp.type === CONSTRUCT_COMPANION_NAME
            const companionAdvances = isConstruct ? constructAdvancement : companionAdvancementFor(c, index)
            const compStage = companionAdvances.advanced ?? (companionAdvances.mature ? isConstruct ? 'Advanced' : 'Mature' : isConstruct ? 'Prototype' : 'Young')
              const stats = companionStats(c, companionEntries, comp.type, companionAdvances, comp.id)
              const description = stats?.entry.source === 'homebrew'
                ? stats.entry.description.replace(/\s*\bStarts (?:Small|Medium)\.\s*$/i, '') : stats?.entry.description
              const enlargeNote = stats?.enlarge
                ? `${stats.enlarge.size}; +${stats.enlarge.damage} status melee damage; +${stats.enlarge.reachIncrease} feet reach; clumsy 1.`
                : undefined
              const enlargeModifierNote = enlargeNote
              const reach = stats?.reach ?? (stats?.enlarge
                ? (stats.naturalSize === 'Tiny' ? 0 : 5) + stats.enlarge.reachIncrease : undefined)
              const clumsyNote = stats?.clumsy ? '-1 Status (clumsy 1)' : undefined
              const acNote = [stats?.barding ? `+${stats.barding.data.ac} Item (${stats.barding.name}); Dexterity cap +${stats.barding.data.dex_cap}` : undefined,
                stats?.magicHide ? '+1 Status (Magic Hide)' : undefined,
                stats?.mountedParry && stats.mountedParry >= stats.mountedShield ? `+${stats.mountedParry} Circumstance (Mounted Parry)` : undefined,
                stats?.mountedShield && stats.mountedShield >= stats.mountedParry ? `+${stats.mountedShield} Circumstance (Mounted Shield)` : undefined,
                stats?.clumsy ? '-1 Status (clumsy 1; Enlarge Companion)' : undefined].filter(Boolean).join('; ') || undefined
              const acSource = [stats?.barding?.name, stats?.magicHide ? 'Magic Hide' : undefined,
                stats?.mountedParry && stats.mountedParry >= stats.mountedShield ? 'Mounted Parry' : undefined,
                stats?.mountedShield && stats.mountedShield >= stats.mountedParry ? 'Mounted Shield' : undefined,
                stats?.clumsy ? 'Enlarge Companion' : undefined].filter(Boolean).join(', ')
              const specials = [
                ...(stats?.mount ? [{ name: 'Mount', note: undefined }] : []),
                ...(stats?.beastmasterSpecial ?? []),
                ...(stats?.nidarrmar ? [{ name: 'Nidarrmar Steed',
                  note: 'Reduce Speed penalties by 10 feet. You may replace fleeing or controlled with slowed 1 for the same duration.' }] : []),
                ...(stats?.peerlessMascot ? [{ name: 'Peerless Mascot',
                  note: `The companion provides your banner's benefits in a ${comp.mascotBannerAffixed
                    ? activeFeatsNamed(c, 'Glorious Banner').length ? 100 : 60 : 30}-foot aura.` }] : []),
                ...(!isConstruct && activeFeatsNamed(c, 'Beastmaster Bond').length ? [{ name: 'Beastmaster Bond',
                  note: `Communicate telepathically with this animal companion ${ranksAt(c, entries).Nature >= 4 ? 'anywhere on the planet' : 'within 100 feet'}.` }] : []),
              ].sort((a, b) => a.name.localeCompare(b.name))
              const maneuvers = [
                ...(stats?.maneuver ? [{ name: stats.maneuver, actions: stats.maneuverActions, traits: stats.maneuverTraits,
                  requirements: stats.maneuverRequirements,
                  damage: (comp.type === 'Thruneosaurus Rex' && stats.maneuver === 'Hellfire Gaze'
                    || comp.type === 'Riding Drake' && stats.maneuver === 'Fire Breath') && c.level >= 2
                    ? { label: 'Damage', dice: Math.floor(c.level / 2), sides: 6, type: 'fire' } : undefined,
                  description: stats.maneuverDescription || 'Description unavailable from Archives of Nethys.' }] : []),
                ...(stats?.beastmasterManeuvers ?? []).map(maneuver => ({ ...maneuver, traits: maneuver.traits ?? '', requirements: maneuver.requirements,
                  damage: undefined })),
                ...(stats?.primalHowl ? [{ name: 'Primal Howl', actions: 'Two Actions', traits: 'Primal, sonic',
                  requirements: undefined,
                  damage: { label: 'Damage', dice: parseInt(stats.primalHowl, 10), sides: 6, type: 'sonic' },
                  description: `Once per hour: 30-foot cone, ${stats.primalHowl} sonic damage, basic Fortitude save against your spell DC; frightened 1 on a failure or frightened 2 on a critical failure. The fright is an emotion, fear, and mental effect.` }] : []),
              ].sort((a, b) => a.name.localeCompare(b.name))
              const statusControls = [
                ...(['Cavalier Dedication', 'Mounted Parry', 'Mounted Shield', 'Born In The Saddle', 'Legendary Rider', 'Reckless Riding Lunge']
                  .some(name => activeFeatsNamed(c, name).length) ? [{ name: 'Mounted', element: <label><input type="checkbox"
                  aria-label={`Mounted on ${comp.name || comp.type}`} checked={c.mountedCompanionId === comp.id}
                  onChange={event => save({ mountedCompanionId: event.target.checked ? comp.id : undefined })} /> Mounted</label> }] : []),
                ...(magicHideKnown ? [{ name: 'Magic Hide', element: <label><input type="checkbox"
                  aria-label={`Magic Hide on ${comp.name || comp.type}`} checked={isMagicHideActive(c, entries, comp.id)}
                  onChange={event => save(magicHideChange(c, event.target.checked, comp.id))} /> Magic Hide</label> }] : []),
                ...(['Apex Companion', 'Canopy Crawler', 'Enlarge Companion'] as const).filter(name => knowsSpell(c, entries, name))
                  .map(name => ({ name, element: <CompanionSpellOptions key={name} c={c} entries={entries}
                    save={save} name={name} companionId={comp.id} toggleOnly /> })),
                ...(knowsSpell(c, entries, 'Spirit of the Beast') ? [{ name: 'Spirit of the Beast', element:
                  <SearchableSelect aria-label={`Spirit of the Beast aspect on ${comp.name || comp.type}`} value={comp.spiritAspect ?? ''} onChange={event => {
                    const choice = (['Might', 'Swiftness', 'Insight', 'Alpha'] as const).find(aspect => aspect === event.target.value)
                    update(comp.id, { spiritAspect: choice })
                  }}>
                    <option value="">Spirit of the Beast…</option>
                    {['Insight', 'Might', 'Swiftness', ...(hasAlpha ? ['the Alpha'] : [])].map(aspect => <option key={aspect} value={aspect === 'the Alpha' ? 'Alpha' : aspect}>Aspect of {aspect}</option>)}
                  </SearchableSelect> }] : []),
                ...(stats?.peerlessMascot ? [{ name: 'Banner affixed', element: <label><input type="checkbox"
                  aria-label={`Banner affixed to ${comp.name || comp.type}`} checked={!!comp.mascotBannerAffixed}
                  onChange={event => update(comp.id, { mascotBannerAffixed: event.target.checked })} /> Banner affixed</label> }] : []),
                ...(index === 0 && activeFeatsNamed(c, 'Faithful Steed').length > 0 && activeFeatsNamed(c, 'Pale Horse').length > 0
                  ? [{ name: 'Pale Horse', element: <label>Pale Horse{' '}
                    <select aria-label="Pale Horse mounted damage type" value={comp.paleHorse ?? ''} onChange={event => {
                      const choice = (['Fire', 'Poison', 'Void'] as const).find(type => type === event.target.value)
                      update(comp.id, { paleHorse: choice })
                    }}>
                      <option value="">Not mounted</option>
                      {['Fire', 'Poison', 'Void'].map(type => <option key={type}>{type}</option>)}
                    </select>
                  </label> }] : []),
              ].sort((a, b) => a.name.localeCompare(b.name))
            return (
              <details key={comp.id} className="character-subsection" data-minion-name={companionTitle(c, index)} open>
                <summary><h4>{companionTitle(c, index)}</h4></summary>
                {index === 0 && companions.length < companionLimit && <span>Beastmaster companion{' '}
                  <SearchableSelect aria-label="Choose additional companion" value="" onChange={(e) => {
                    const type = types.find((type) => type.name === e.target.value)
                    if (type) save({ companions: [...companions, { id: newId(), type: type.name, name: '' }] })
                  }}>
                    <option value="">Choose companion...</option>
                    {types.map((type) => <option key={type.id}>{type.name}</option>)}
                  </SearchableSelect>
                </span>}
              <article className="gear-card">
                <header className="row">
                  <SearchableSelect aria-label="Companion type" value={comp.type} onChange={(e) => update(comp.id, { type: e.target.value, supportActive: false })}>
                    {types.map((t) => <option key={t.id} value={t.name}>{t.name}{t.data.rarity && t.data.rarity !== 'common' ? ` (${t.data.rarity})` : ''}</option>)}
                  </SearchableSelect>
                </header>
                {description && <p className="companion-description">{spellDCText(c, entries, description)}</p>}
                {statusControls.length > 0 && <div className="companion-status-toggles" role="group" aria-label="Companion status toggles">
                  {statusControls.map(({ name, element }) => <div key={name}>{element}</div>)}
                </div>}
                {!isConstruct && index === 0 && choices.length > 0 && (
                  <div className="row companion-choices">
                    {choices.map(({ feat, featIndex }) => {
                      const advanced = isCompanionAdvancement(feat.name)
                      const options: string[] = advanced ? [...ADVANCED_TYPES] : specializationOptions(c, entries, featIndex)
                      return (
                        <SearchableSelect key={`${feat.name}:${featIndex}`} aria-label={advanced ? 'Companion advancement' : `Companion specialization ${featIndex + 1}`}
                          value={feat.choice ?? ''} onChange={(e) => setFeatChoice(featIndex, e.target.value)}>
                          <option value="">{advanced ? 'Choose advancement…' : 'Choose specialization…'}</option>
                          {feat.choice && !options.includes(feat.choice) && <option value={feat.choice}>{feat.choice}</option>}
                          {options.map((option) => <option key={option} value={option}>{option}</option>)}
                        </SearchableSelect>
                      )
                    })}
                  </div>
                )}
                {!isConstruct && index > 0 && companionAdvances.mature
                  && !!activeFeatsNamed(c, 'Incredible Beastmaster Companion').length && <div className="row companion-choices">
                  <SearchableSelect aria-label={`Companion advancement: ${comp.name || comp.type}`} value={comp.beastmasterAdvancement ?? ''}
                    onChange={event => {
                      const choice = ADVANCED_TYPES.find(type => type === event.target.value)
                      update(comp.id, { beastmasterAdvancement: choice })
                    }}>
                    <option value="">Choose advancement…</option>
                    {ADVANCED_TYPES.map(option => <option key={option}>{option}</option>)}
                  </SearchableSelect>
                  {companionAdvances.advanced && c.feats.map((feat, featIndex) => {
                    if (feat.name !== 'Specialized Beastmaster Companion' || featTakenLevel(feat) > c.level) return null
                    const key = beastmasterSpecializationKey(feat, featIndex)
                    const value = comp.beastmasterSpecializations?.[key] ?? ''
                    const projected = { ...c, feats: c.feats.map((item, itemIndex) => ({ ...item,
                      choice: item.name === 'Specialized Beastmaster Companion'
                        ? comp.beastmasterSpecializations?.[beastmasterSpecializationKey(item, itemIndex)] : undefined })) }
                    const options = specializationOptions(projected, entries, featIndex).filter(option => option !== 'Peerless Mascot')
                    return <SearchableSelect key={key} aria-label={`Companion specialization ${featIndex + 1}: ${comp.name || comp.type}`}
                      value={value} onChange={event => {
                        if (event.target.value && !options.includes(event.target.value)) return
                        update(comp.id, { beastmasterSpecializations: { ...comp.beastmasterSpecializations, [key]: event.target.value } })
                      }}>
                      <option value="">Choose specialization…</option>
                      {value && !options.includes(value) && <option value={value} disabled>{value} (unavailable)</option>}
                      {options.map(option => <option key={option}>{option}</option>)}
                    </SearchableSelect>
                  })}
                </div>}
                {stats ? <>
                  {stats.auspice && <div className="row">
                    {c.className !== 'Champion' && <label>Servitor{' '}
                      <select aria-label="Auspice servitor" value={comp.auspiceServitor ?? ''} onChange={(e) => {
                        const servitor = (['Celestial', 'Fiend', 'Monitor'] as const).find((type) => type === e.target.value)
                        update(comp.id, { auspiceServitor: servitor })
                      }}>
                        <option value="">Choose deity's servitor...</option>
                        {['Celestial', 'Fiend', 'Monitor'].map((type) => <option key={type}>{type}</option>)}
                      </select>
                    </label>}
                    {(stats.servitor === 'Celestial' || stats.servitor === 'Fiend') && <label>Servitor type{' '}
                      <select aria-label="Auspice servitor type" value={stats.subtype ?? ''} onChange={(e) => {
                        const subtype = (['Angel', 'Devil'] as const).find(type => type === e.target.value)
                        update(comp.id, { auspiceSubtype: subtype })
                      }}>
                        <option value="">Other</option>
                        <option>{stats.servitor === 'Celestial' ? 'Angel' : 'Devil'}</option>
                      </select>
                    </label>}
                    {!stats.subtype && <label>Servitor language{' '}
                      <input aria-label="Auspice servitor language" value={comp.auspiceLanguage ?? ''}
                        onChange={(e) => update(comp.id, { auspiceLanguage: e.target.value })} />
                    </label>}
                  </div>}
                  {stats.auspiceLanguage && <div>Language:{' '}
                    <Info label={stats.auspiceLanguage}>
                      {(() => {
                        const language = stats.auspiceLanguage!.toLowerCase()
                        const speakers = Object.values(languageGroups(entries, c.systems)).flat().find(([name]) => name.toLowerCase() === language)?.[1]
                          || entries.find(entry => entry.kind === 'language' && entry.name.toLowerCase() === language)?.description
                        return speakers ? `Speakers: ${speakers.replace(/\.$/, '')}` : 'Speakers unavailable.'
                      })()}
                    </Info>
                  </div>}
                  {stats.peerlessMascot && (() => {
                    const known = [...new Map([...languageAllowance(c, entries).locked,
                      ...(migrateAncestralLinguistics(c)?.languages ?? c.languages)]
                      .map(language => [language.toLowerCase(), language])).values()].sort((a, b) => a.localeCompare(b))
                    return <label>Language{' '}
                      <select aria-label="Peerless Mascot language" value={known.includes(comp.mascotLanguage ?? '') ? comp.mascotLanguage : ''}
                        onChange={event => update(comp.id, { mascotLanguage: known.find(language => language === event.target.value) })}>
                        <option value="">Choose language...</option>
                        {known.map(language => <option key={language}>{language}</option>)}
                      </select>
                    </label>
                  })()}
                  <div className="gear-traits">
                    {[
                      { name: compStage },
                      { name: stats.size, size: true },
                      ...(!isConstruct ? companionAdvances.specializations.map(name => ({ name })) : []),
                      ...stats.traits.map(name => ({ name })),
                    ].filter(badge => badge.name).sort((a, b) => a.name.localeCompare(b.name)).map((badge, badgeIndex) =>
                      <span key={`${badge.name}:${badgeIndex}`}>{badge.name}{badge.size && enlargeNote
                        && <SourceNote source="Enlarge Companion" note={enlargeNote} inlineSource={false} />}
                        {badge.size && stats.apex && <SourceNote source="Apex Companion" note="Huge for 1 minute; requires room to expand." inlineSource={false} />}</span>)}
                  </div>
                  <div className="gear-stats">
                    {ABILITIES.map(k => <span key={k}><small>{ABILITY_LABEL[k]}</small>{signed(stats.mods[k])}</span>)}
                  </div>
                  {(stats.attacks.length > 0 || stats.enlarge) && <section className="companion-actions">
                      <h5>Attacks{reach !== undefined && <> (Reach {reach} feet)
                        {stats.apex ? <SourceNote source="Apex Companion" note="Attacks have 15-foot reach; damage dice increase one step and gain Deadly d12." inlineSource={false} />
                          : enlargeNote && <SourceNote source="Enlarge Companion" note={enlargeNote} inlineSource={false} />}</>}</h5>
                      {[...stats.attacks].sort((a, b) => a.name.localeCompare(b.name)).map(a => <div key={a.name} className="companion-action">
                        <div className="companion-action-title">
                          <ActionIcon actions="Single Action" />
                          <b>{a.name.replace(/\b\w/g, char => char.toUpperCase())}</b>{a.traits && <small>({a.traits})</small>}
                          <span>{signed(a.attack)}{a.dexterityBased && clumsyNote
                            && <SourceNote source="Enlarge Companion" note={clumsyNote} inlineSource={false} />}</span>
                          <span>— {a.damage}{!a.ranged && enlargeModifierNote
                            && <SourceNote source="Enlarge Companion" note={enlargeModifierNote} inlineSource={false} />}
                            {stats.apex && <SourceNote source="Apex Companion" note="Damage dice increase one step; Deadly d12." inlineSource={false} />}</span>
                        </div>
                      </div>)}
                  </section>}
                  {stats.stealthyCompanion && <div><small>Camouflage</small> In natural terrain, your companion can Hide and Sneak without cover or concealment.</div>}
                  <section className="companion-actions">
                    <h5>Defenses</h5>
                    <div className="gear-stats">
                      <span><small>Hit Points</small><b>{stats.hp}</b></span>
                      {stats.temporaryHp > 0 && <span><small>Temporary Hit Points</small><b>{stats.temporaryHp}</b>
                        <SourceNote source="Apex Companion" note="Gain 30 temporary Hit Points when cast; not added to maximum Hit Points." inlineSource={false} /></span>}
                      <span><small>Armor Class</small><b>{stats.ac}{acNote && <SourceNote source={acSource} note={acNote} inlineSource={false} />}</b></span>
                      <span><small>Fortitude</small>{signed(stats.fortitude)}
                        {stats.antiDragon && <SourceNote source={stats.antiDragon.source}
                          note={`+${stats.antiDragon.bonus} item bonus to Fortitude DC against Grapple, Reposition, Shove, or Trip. A creature that Grapples this companion takes ${stats.antiDragon.damage} piercing damage.`} />}</span>
                      <span><small>Reflex</small>{signed(stats.reflex)}{clumsyNote
                        && <SourceNote source="Enlarge Companion" note={clumsyNote} inlineSource={false} />}
                        {stats.antiDragon && <SourceNote source={stats.antiDragon.source}
                          note={`+${stats.antiDragon.bonus} item bonus to Reflex DC against Grapple, Reposition, Shove, or Trip.`} />}</span>
                      <span><small>Will</small>{signed(stats.will)}</span>
                    </div>
                    {stats.weakness && <small>Weakness: {stats.weakness}</small>}
                    {stats.paleHorse && <div><small>Resistance</small> {stats.paleHorse.damage} {stats.paleHorse.resistance} (Pale Horse).
                      Creatures touching or hitting the steed with an adjacent melee Strike take {stats.paleHorse.retaliation} {stats.paleHorse.damage.toLowerCase()} damage.</div>}
                  </section>
                  <CompanionEquipmentSlots c={c} companion={comp} entries={companionEntries} size={stats.size} save={save} />
                  {maneuvers.length > 0 && <section className="companion-actions">
                      <h5>Maneuvers</h5>
                      {maneuvers.map(maneuver => <div key={maneuver.name} className="companion-action">
                        <div className="companion-action-title">
                          {maneuver.damage ? <DamageRoll key={`${maneuver.damage.dice}d${maneuver.damage.sides}`}
                            name={maneuver.name} damage={maneuver.damage} actions={maneuver.actions} />
                            : maneuver.actions ? <ActionIcon actions={maneuver.actions} showOther />
                            : <small>Action cost unavailable</small>}
                          <b>{maneuver.name}</b>{maneuver.traits && <small>({maneuver.traits})</small>}
                        </div>
                        {maneuver.requirements && <p className="companion-action-requirements">
                          <strong>Requirements:</strong> {spellDCText(c, entries, maneuver.requirements)}
                        </p>}
                        <p className="companion-action-description">{spellDCText(c, entries, maneuver.description)}</p>
                      </div>)}
                  </section>}
                  <MinionFerocity c={c} ferocity={stats.ferocity} />
                  <section className="companion-actions">
                    <h5>Senses</h5>
                    <div><small>Perception</small> <b>{signed(stats.perception)}</b>{stats.senses && <> · {stats.senses}</>}
                      {stats.apex && <SourceNote source="Apex Companion" note="Grants darkvision." inlineSource={false} />}</div>
                  </section>
                  {stats.skills.length > 0 && <section className="companion-actions">
                    <h5>Skills</h5>
                    {stats.skills.map(s => <div key={s.name}>
                      {s.name} {signed(s.bonus)}{s.clumsy && clumsyNote
                        && <SourceNote source="Enlarge Companion" note={clumsyNote} inlineSource={false} />}
                      {s.note && s.noteSource && <SourceNote source={s.noteSource} note={s.note} inlineSource={false} />} ({RANK_LETTER[s.rank]})
                    </div>)}
                  </section>}
                  <section className="companion-actions">
                    <h5>Special</h5>
                    <div>{specials.length ? specials.map((special, specialIndex) => {
                      const source = selectedFeatEntry(c, entries, special.name)
                      return <Fragment key={special.name}>
                        {specialIndex > 0 && ', '}
                        {special.note ? <EntryDescription name={special.name} entry={source ?? {
                          ...stats.entry, id: `${stats.entry.id}:${special.name}`, name: special.name, kind: 'trait',
                          description: special.note, data: {}, effects: [],
                        }} entries={entries} character={c} descriptionNote={source ? special.note : undefined} /> : special.name}
                      </Fragment>
                    }) : 'None'}</div>
                  </section>
                  <section className="companion-actions">
                    <h5>Speed</h5>
                    <div><span>{stats.speed}{stats.canopyCrawler
                      && <SourceNote source="Canopy Crawler" note="Climb Speed equal to highest Speed." />}</span>
                      {stats.speedBonuses.length > 0 && ` (${stats.speedBonuses.map((bonus) => `${signed(bonus.feet)} ${bonus.source}`).join(', ')})`}</div>
                    {stats.ignoreAllDifficultTerrain ? <small>Ignores difficult terrain and greater difficult terrain (Apex Companion).</small>
                      : stats.ignoreDifficultTerrain > 0 && <small>Ignores the first {stats.ignoreDifficultTerrain} feet of difficult terrain each turn (Chiardmar Steed).</small>}
                  </section>
                  {stats.support && <section className="companion-actions">
                    <div className="companion-action">
                      <div className="companion-action-title">
                        <ActionIcon actions="Single Action" /><b>Support Benefit</b>
                        <label><input type="checkbox" aria-label={`Support Benefit on ${comp.name || comp.type}`}
                          checked={!!comp.supportActive} onChange={event => update(comp.id, { supportActive: event.target.checked })} /> Active</label>
                      </div>
                      <p className="companion-action-description">{spellDCText(c, entries, stats.support)}</p>
                    </div>
                  </section>}
                </> : <><small>Companion data is still loading.</small>
                  <CompanionEquipmentSlots c={c} companion={comp} entries={companionEntries} save={save} />
                </>}
              </article>
              </details>
            )
          })}
        {FollowerCards({ c, entries, save })}
        {[...(familiar ? [{ wasp: false, data: c.familiar }] : []),
          ...(wasp ? [{ wasp: true, data: c.waspFamiliar }] : [])].map(({ wasp: isWasp, data }) => {
          const isLeshy = leshy && !isWasp
          const isUndead = undeadFamiliar && !isWasp
          const isCrocodile = crocodileFamiliar && !isWasp && !isUndead && !isLeshy
          const patronAbility = !isWasp ? familiarCapacity.patronAbility : undefined
          const dailyAbilityLimit = familiarCapacity.dailyAbilityLimit
          const selectableAbilityLimit = patronAbility ? familiarCapacity.selectableAbilityLimit : dailyAbilityLimit
          const familiarType = isUndead ? 'Undead familiar' : isLeshy ? 'Leshy familiar'
            : isCrocodile ? 'Crocodile familiar' : 'Familiar'
          const familiarLabel = isWasp ? 'Wasp familiar' : familiarType
          const savedAbilities = (data?.abilities ?? []).map((ability, index) => ({ ability, index })).filter(item => !!item.ability)
          const activeAbilityChoices = savedAbilities.filter(item => item.index < selectableAbilityLimit)
          const abilityStatus = (ability: string, index: number) => {
            const entry = familiarAbilityEntry(ability, familiarAbilityCatalog, c)
            if (!entry) return { entry, reason: 'Ability rules are unavailable.' }
            const others = activeAbilityChoices.filter(item => item.index !== index).map(item => item.ability)
            return { entry, reason: familiarAbilityUnavailableReason(entry, c, others, isUndead, entries) }
          }
          const activeAbilities = activeAbilityChoices.flatMap(({ ability, index }) => {
            const status = abilityStatus(ability, index)
            return status.entry && !status.reason ? [status.entry.name] : []
          })
          const castingAbility = classSpellcasting(c, entries)?.ability ?? c.spellcasting?.ability
          const spellcastingModifier = castingAbility ? Math.floor((c.abilities[castingAbility] - 10) / 2) : 0
          const movementAbilities = [...activeAbilities, ...(isWasp ? ['Burrower', 'Flier'] : [])]
          const familiarEffects = familiarAbilityEffects(movementAbilities, c.level, data?.abilityOptions, spellcastingModifier)
          const amphibious = movementAbilities.some(ability => ability.toLowerCase() === 'amphibious')
          const baseSpeeds = minionMovementSpeeds(movementAbilities.filter(ability => ability.toLowerCase() !== 'fast movement'))
            .filter(speed => speed.feet === 25 && !(amphibious && speed.movement === 'Swim'))
          const savedSpeed = amphibious && data?.abilityOptions?.fastMovement === 'Swim' ? 'Land' : data?.abilityOptions?.fastMovement
          const selectedSpeed = baseSpeeds.find(speed => speed.movement === savedSpeed)?.movement
            ?? baseSpeeds[0]?.movement
          const skilledCount = activeAbilities.filter(ability => ability.toLowerCase() === 'skilled').length
          const resistanceCount = activeAbilities.filter(ability => ability.toLowerCase() === 'resistance').length
          const saveFamiliar = (changes: Partial<NonNullable<Character['familiar']>>) =>
            save(isWasp ? { waspFamiliar: { ...data, ...changes } } : { familiar: { ...data, ...changes } })
          const saveAbilityOptions = (abilityOptions: NonNullable<Character['familiar']>['abilityOptions']) =>
            saveFamiliar({ abilityOptions: { ...data?.abilityOptions, ...abilityOptions } })
          const chooseAbility = (event: { target: { value: string } }) => {
            const ability = familiarAbilityCatalog.find(entry => entry.id === event.target.value)
            if (!ability || activeAbilityChoices.length >= selectableAbilityLimit
              || /^specific familiar\b/i.test(String(ability.data.ability_type ?? ''))
              || familiarAbilityUnavailableReason(ability, c, savedAbilities.map(item => item.ability), isUndead, entries)) return
            const abilities = [...(data?.abilities ?? [])]
            const slot = Array.from({ length: selectableAbilityLimit }, (_, index) => index).find(index => !abilities[index])
            if (slot === undefined) return
            abilities[slot] = ability.name
            saveFamiliar({ abilities })
          }
          const abilityOptions = familiarAbilityCatalog.filter(entry => {
            const alreadySelected = savedAbilities.some(item => item.ability.toLowerCase() === entry.name.toLowerCase())
            return !/^specific familiar\b/i.test(String(entry.data.ability_type ?? ''))
              && (!alreadySelected || isFamiliarAbilityRepeatable(entry))
              && !familiarAbilityUnavailableReason(entry, c, savedAbilities.map(item => item.ability), isUndead, entries)
          })
          return <details key={isWasp ? 'wasp' : 'familiar'} className="character-subsection" data-minion-name={isWasp ? 'Wasp Familiar' : isUndead ? 'Undead Familiar' : isLeshy ? 'Leshy Familiar' : isCrocodile ? 'Crocodile Familiar' : 'Familiar'} open>
          <summary><h4>{isWasp ? 'Wasp Familiar' : isUndead ? 'Undead Familiar' : isLeshy ? 'Leshy Familiar'
            : isCrocodile ? 'Crocodile Familiar' : 'Familiar'}</h4> ({activeAbilityChoices.length + Number(!!patronAbility)}/{dailyAbilityLimit})</summary>
          <article className="gear-card">
          {isCrocodile && <small>Tiny crocodile familiar granted by Crocodile's Twin.</small>}
          {patronAbility && <div className="gear-traits"><EntryDescription name={patronAbility.name} entry={patronAbility}
            entries={entries} character={c} buttonLabel="Patron familiar ability" /></div>}
          {isWasp && <div className="gear-runes">{['Burrower', 'Flier'].map(name => {
            const entry = familiarAbilityEntry(name, familiarAbilityCatalog, c)
            return entry ? <EntryDescription key={name} name={name} entry={entry} entries={entries} character={c}
              buttonLabel={`Granted ${name}`} /> : <small key={name}>{name}</small>
          })}</div>}
          {isUndead && <>
            <div className="gear-traits"><EntryDescription name="Undead" entry={UNDEAD_FAMILIAR_TRAIT}
              className="gear-trait" entries={entries} character={c} /></div>
          </>}
          <section className="companion-actions">
            <h5>Defenses</h5>
            <div className="gear-stats">
              <span><small>Hit Points</small><b>{familiarEffects.hitPoints}</b></span>
              {minionDefense && <>
                <span><small>Armor Class</small><b>{minionDefense.ac}</b></span>
                <span><small>Fortitude</small>{signed(minionDefense.fortitude)}</span>
                <span><small>Reflex</small>{signed(minionDefense.reflex)}</span>
                <span><small>Will</small>{signed(minionDefense.will)}</span>
              </>}
            </div>
            {familiarEffects.resistances.length > 0 && <div><small>Resistances</small> {familiarEffects.resistances
              .map(resistance => `${resistance.damage} ${resistance.value}`).join(', ')}</div>}
          </section>
          {familiarEffects.senses.length > 0 && <section className="companion-actions">
            <h5>Senses</h5><div>{familiarEffects.senses.join(', ')}</div>
          </section>}
          {familiarEffects.skilled.length > 0 && <section className="companion-actions">
            <h5>Skills</h5><div>{familiarEffects.skilled.map(skill => `${skill.skill} ${signed(skill.modifier)}`).join(', ')}</div>
          </section>}
          {isLeshy && <label>Granted ability{' '}
            <select aria-label="Leshy familiar granted ability" value={data?.leshyAbility ?? ''} onChange={event => {
              const value = event.target.value
              saveFamiliar({ leshyAbility: value === 'Plant' || value === 'Fungus' ? value : undefined })
            }}>
              <option value="">Choose ability</option><option>Plant</option><option>Fungus</option>
            </select>
          </label>}
          <section className="companion-actions">
          <h5>Special</h5>
          <div className="gear-runes">
            {[...savedAbilities].sort((a, b) => a.ability.localeCompare(b.ability, undefined, { sensitivity: 'base' }) || a.index - b.index)
              .map(({ ability, index }) => {
              const { entry, reason } = abilityStatus(ability, index)
              return <div key={`${index}:${ability}`} className="rune">
                <EntryDescription name={entry?.name ?? ability} entry={entry} entries={entries} character={c} />
                {index >= selectableAbilityLimit && <small> (inactive)</small>}
                {reason && index < selectableAbilityLimit && <small title={reason}> (unavailable)</small>}
                <button type="button" aria-label={`Remove ${familiarLabel} ability ${index + 1}`}
                  onClick={() => confirmRemoval(`familiar ability "${ability}"`, () =>
                    saveFamiliar({ abilities: (data?.abilities ?? []).filter((_, abilityIndex) => abilityIndex !== index) }))}>×</button>
              </div>
            })}
            {activeAbilityChoices.length < selectableAbilityLimit && <SearchableSelect aria-label={`${familiarLabel} ability`}
              value="" optionCount={abilityOptions.length}
              renderDetails={value => {
                const entry = abilityOptions.find(option => option.id === value)
                return entry && <EntryDescription name={entry.name} entry={entry} entries={entries} character={c}
                  buttonLabel="Details" className="picker-details" />
              }} onChange={chooseAbility}>
              <option value="">+</option>
              {['Familiar', 'Master'].map(type => {
                const options = abilityOptions.filter(entry =>
                  String(entry.data.ability_type ?? 'Familiar').toLowerCase() === type.toLowerCase())
                return options.length > 0 && <optgroup key={type} label={type}>
                  {options.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                </optgroup>
              })}
            </SearchableSelect>}
          </div>
          </section>
          <section className="companion-actions">
          <h5>Speed</h5><div>{familiarEffects.speeds.map(speed =>
            `${speed.movement === 'Land' ? '' : `${speed.movement} `}${speed.feet} feet`).join(', ')}</div>
          {activeAbilities.some(ability => ability.toLowerCase() === 'fast movement') && baseSpeeds.length > 1 && <label>Fast Movement{' '}
            <select aria-label={`${familiarLabel} Fast Movement speed`} value={selectedSpeed}
              onChange={event => saveAbilityOptions({ fastMovement: event.target.value })}>
              {baseSpeeds.map(speed => <option key={speed.movement} value={speed.movement}>{speed.movement} ({speed.feet} feet)</option>)}
            </select>
          </label>}
          </section>
          {Array.from({ length: resistanceCount }, (_, index) => <label key={`resistance-${index}`}>Resistance type {index + 1}{' '}
            <select aria-label={`${familiarType} resistance type ${index + 1}`}
              value={data?.abilityOptions?.resistance?.[index] ?? ''} onChange={event => {
                const resistance = [...(data?.abilityOptions?.resistance ?? [])]
                resistance[index] = event.target.value
                saveAbilityOptions({ resistance })
              }}>
              <option value="">Choose damage type</option>
              {FAMILIAR_RESISTANCE_TYPES.map(type => <option key={type} value={type}
                disabled={data?.abilityOptions?.resistance?.some((other, otherIndex) => otherIndex !== index && other === type)}>{type}</option>)}
            </select>
          </label>)}
          {Array.from({ length: skilledCount }, (_, index) => <label key={`skilled-${index}`}>Skilled ability {index + 1}{' '}
            <select aria-label={`${familiarType} Skilled ability ${index + 1}`}
              value={data?.abilityOptions?.skilled?.[index] ?? ''} onChange={event => {
                const skilled = [...(data?.abilityOptions?.skilled ?? [])]
                skilled[index] = event.target.value
                saveAbilityOptions({ skilled })
              }}>
              <option value="">Choose skill</option>
              {FAMILIAR_SKILLS.map(skill => <option key={skill} value={skill}
                disabled={data?.abilityOptions?.skilled?.some((other, otherIndex) => otherIndex !== index && other === skill)}>{skill}</option>)}
            </select>
          </label>)}
          {!isWasp && familiarSecrets && <div className="col">
            <label>Leshy Familiar Secrets{' '}
              <select aria-label="Leshy Familiar Secrets ability" value={c.familiar?.leshySecret ?? ''} onChange={event => {
                const value = event.target.value
                if (value === 'Verdant Burst' && highestSlot < 2) return
                if (value && !['Grasping Tendrils', 'Purify Air', 'Verdant Burst'].includes(value)) return
                save({ familiar: { ...c.familiar, leshySecret: value === 'Grasping Tendrils' || value === 'Purify Air'
                  || value === 'Verdant Burst' ? value : undefined } })
              }}>
                <option value="">Choose one extra ability</option>
                <option>Grasping Tendrils</option><option>Purify Air</option>
                <option disabled={highestSlot < 2}>Verdant Burst</option>
              </select>
            </label>
            {c.familiar?.leshySecret === 'Grasping Tendrils' && <small>Familiar reach 15 feet.</small>}
            {c.familiar?.leshySecret === 'Purify Air' && <small>Recycles air for one Medium creature; +2 circumstance to saves against inhaled effects within 15 feet, at GM discretion.</small>}
            {c.familiar?.leshySecret === 'Verdant Burst' && (highestSlot >= 2
              ? <small>On familiar death, three-action Heal at rank {highestSlot - 1}; plants regain an additional {2 * (highestSlot - 1)} HP.</small>
              : <small>Verdant Burst requires a 2nd-rank spell slot.</small>)}
          </div>}
          {isLeshy && activeFeatsNamed(c, 'Grown of Oak').length > 0 && knowsSpell(c, entries, 'Oaken Resilience') && <>
            {oaken && <small>Oaken Resilience: Bludgeoning and piercing resistance {oaken.resistance}; fire weakness {oaken.fireWeakness}.</small>}
            <SourceNote source="Grown of Oak" note="Targets your leshy familiar only if within 30 feet when cast." />
          </>}
          <MinionFerocity c={c} ferocity={ferocity} />
          </article>
        </details>})}
        {pet && <details className="character-subsection" data-minion-name={seaFriend ? 'Aquatic Pet' : 'Pet'} open>
          <summary><h4>{seaFriend ? 'Aquatic Pet' : 'Pet'}</h4></summary>
          <article className="gear-card">
          {!seaFriend && <label><input type="checkbox" aria-label="Aquatic pet" checked={!!c.pet?.aquatic}
            onChange={event => save({ pet: { ...c.pet, aquatic: event.target.checked } })} /> Aquatic</label>}
          <div className="gear-traits"><span>Level {c.level}</span>
            {(seaFriend || c.pet?.aquatic) && <span>Aquatic<SourceNote source="Aquatic"
              note={petAbilities.includes('Amphibious') ? 'Breathes air and water.' : 'Breathes water instead of air.'} /></span>}
          </div>
          <section className="companion-actions">
            <h5>Defenses</h5>
            <div className="gear-stats"><span><small>Hit Points</small><b>{c.level * (petAbilities.includes('Tough') || seaFriend ? 7 : 5)}</b></span>
              {minionDefense && <>
                <span><small>Armor Class</small><b>{minionDefense.ac}</b></span>
                <span><small>Fortitude</small>{signed(minionDefense.fortitude)}</span>
                <span><small>Reflex</small>{signed(minionDefense.reflex)}</span>
                <span><small>Will</small>{signed(minionDefense.will)}</span>
              </>}
            </div>
          </section>
          <section className="companion-actions"><h5>Senses</h5>
            <div>Low-light vision{seaFriend || petAbilities.includes('Darkvision') ? ', Darkvision' : ''}</div>
          </section>
          <section className="companion-actions">
            <h5>Special</h5>
            <div className="gear-runes">
              {petAbilities.map((ability, index) => ability && <div key={`${index}:${ability}`} className="rune">
                {(() => {
                  const entry = entries.find(candidate => candidate.kind === 'familiar' && !candidate.deleted
                    && candidate.name.toLowerCase() === ability.toLowerCase()
                    && candidate.systems.some(system => c.systems.includes(system)))
                    ?? (PET_ABILITY_NOTES[ability] ? { id: `pet:${ability}`, name: ability, kind: 'familiar' as const,
                      systems: c.systems, source: 'official' as const, level: 1, traits: [], description: PET_ABILITY_NOTES[ability],
                      data: {}, effects: [], updatedAt: 0 } : undefined)
                  return entry ? <EntryDescription name={ability} entry={entry} entries={entries} character={c} /> : <span>{ability}</span>
                })()}
                <button type="button" aria-label={`Remove Pet ability ${index + 1}`}
                  onClick={() => confirmRemoval(`pet ability "${ability}"`, () =>
                    save({ pet: { ...c.pet, abilities: petAbilities.map((value, i) => i === index ? '' : value) } }))}>×</button>
              </div>)}
              {seaFriend && ['Darkvision', 'Tough'].map(ability => <span className="rune" key={ability}>{ability}</span>)}
              {[0, 1].some(index => !petAbilities[index]) && <SearchableSelect aria-label="Pet ability" value=""
                onChange={event => {
                  const value = event.target.value
                  const index = [0, 1].find(i => !petAbilities[i])
                  if (index === undefined || !PET_ABILITIES.includes(value) || petAbilities.includes(value)
                    || seaFriend && ['Darkvision', 'Tough'].includes(value)) return
                  const abilities = [...petAbilities]
                  abilities[index] = value
                  save({ pet: { ...c.pet, abilities } })
                }}>
                <option value="">+</option>
                {PET_ABILITIES.filter(ability => !petAbilities.includes(ability)
                  && !(seaFriend && ['Darkvision', 'Tough'].includes(ability))).map(ability => <option key={ability}>{ability}</option>)}
              </SearchableSelect>}
            </div>
            {seaFriend && petAbilities.some(ability => ['Darkvision', 'Tough'].includes(ability)) && <small>Choose a different pet ability; Darkvision and Tough are already granted.</small>}
          </section>
          <section className="companion-actions">
          <h5>Speed</h5><div>{minionMovementSpeeds(petAbilities, c.pet?.fastMovement, !!(seaFriend || c.pet?.aquatic))
            .map(speed => `${speed.movement === 'Land' ? '' : `${speed.movement} `}${speed.feet} feet`).join(', ')}</div>
          {petAbilities.includes('Fast Movement') && (() => {
            const amphibious = petAbilities.includes('Amphibious')
            const options = minionMovementSpeeds(petAbilities.filter(ability => ability !== 'Fast Movement'), undefined, !!(seaFriend || c.pet?.aquatic))
              .filter(speed => speed.feet === 25 && !(amphibious && speed.movement === 'Swim'))
            const saved = amphibious && c.pet?.fastMovement === 'Swim' ? 'Land' : c.pet?.fastMovement
            const selected = options.find(speed => speed.movement === saved)?.movement ?? options[0]?.movement
            return options.length > 1 && <label>Fast Movement{' '}
              <select aria-label="Pet Fast Movement speed" value={selected}
                onChange={event => save({ pet: { ...c.pet, fastMovement: event.target.value } })}>
                {options.map(speed => <option key={speed.movement} value={speed.movement}>{speed.movement}</option>)}
              </select>
            </label>
          })()}
          </section>
          <MinionFerocity c={c} ferocity={ferocity} />
          </article>
        </details>}
        </SortedMinionSections>
      </div>
  )
}
