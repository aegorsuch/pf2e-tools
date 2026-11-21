import { Fragment } from 'react'
import { Info, SourceNote } from './Info'
import { EntryDescription } from './EntryDescription'
import { ADVANCED_TYPES, companionItemName, beastmasterSpecializationKey, companionAdvancement, companionAdvancementFor, companionStats, constructCompanionAdvancement, CONSTRUCT_COMPANION_ENTRY,
  CONSTRUCT_COMPANION_NAME, hasConstructInnovation, minionFerocity, specializationOptions } from './companions'
import { ABILITY_LABEL, ABILITIES, LANGUAGE_CATEGORIES, activeFeatsNamed, armorClassBreakdown, classSpellSlots, classSpellcasting, featTakenLevel, isMagicHideActive, knowsSpell, languageAllowance, magicHideChange, migrateAncestralLinguistics, oakenResilience, ranksAt, savingThrowBreakdown, signed, spellDCText, type SectionProps, type TotalBreakdown } from './builder'
import { adoptedAncestryText, isCompanionAdvancement, isCompanionSpecialization, selectedFeatEntry } from './featChoices'
import { CompanionSpellOptions } from './SpellsSection'
import { ActionIcon } from './ActionIcon'
import { DamageRoll } from './SpellDamage'
import { newId } from './db'
import { getSettings } from './settings'
import { SearchableSelect } from './SearchableSelect'
import { bardingOptions, equippedBarding, isCompanionEquipmentItem } from './companions'
import { confirmRemoval } from './confirmRemoval'
import { DroneFeatures } from './DroneFeatures'
import { FAMILIAR_RESISTANCE_TYPES, FAMILIAR_SKILLS, familiarAbilityEffects, familiarAbilityEntries,
  familiarAbilityEntry, familiarAbilityUnavailableReason, familiarSelection, isFamiliarAbilityRepeatable } from './familiarAbilities'
import type { Character, CompanionEquipment, CompanionEquipmentSlot, ContentEntry } from './types'

const RANK_LETTER = ['U', 'T', 'E', 'M', 'L']
const COMPANION_EQUIPMENT_SLOTS: CompanionEquipmentSlot[] = ['Barding', 'Collar', 'Other', 'Saddle', 'Shoes']
const PET_ABILITIES = ['Amphibious', 'Burrower', 'Climber', 'Darkvision', 'Echolocation', 'Fast Movement', 'Flier', 'Manual Dexterity', 'Scent', 'Tough']
const PET_ABILITY_NOTES: Record<string, string> = {
  Amphibious: 'Breathes air and water; land and swim Speeds equal highest land or swim Speed.',
  Burrower: 'Burrow Speed 5 feet; can dig Tiny holes.',
  Climber: 'Climb Speed 25 feet.',
  Darkvision: 'Darkvision.',
  Echolocation: 'Precise hearing within 20 feet.',
  'Fast Movement': 'Increase one 25-foot Speed to 40 feet.',
  Flier: 'Fly Speed 25 feet.',
  'Manual Dexterity': 'Can use up to two limbs as hands for manipulate actions.',
  Scent: 'Imprecise scent within 30 feet.',
  Tough: 'Maximum HP increases by 2 per level.',
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
            value="" optionCount={remaining.length} renderDetails={value => {
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
          value="" optionCount={slotOptions.length}
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
  const { companions, constructAdvancement, leshy, undeadFamiliar, crocodileFamiliar, familiar, wasp, seaFriend, pet } = minionSummaryData(c)
  return <summary className="character-section-summary">
    <strong>Minions</strong>
    <span>{[...companions.map((comp, index) => {
      const compStage = comp.type === CONSTRUCT_COMPANION_NAME
        ? constructAdvancement.advanced ?? (constructAdvancement.mature ? 'Advanced' : 'Prototype')
        : companionAdvancementFor(c, index).advanced ?? (companionAdvancementFor(c, index).mature ? 'Mature' : 'Young')
      return `${compStage} ${comp.type}${comp.name && comp.name !== comp.type ? ` (${comp.name})` : ''}`
    }), ...(c.className === 'Mechanic' && c.systems.includes('sf2e') && c.subclass === 'Drone' ? ['Drone'] : []),
      ...(familiar ? [leshy ? 'Leshy Familiar' : undeadFamiliar ? 'Undead Familiar'
        : crocodileFamiliar ? 'Crocodile Familiar' : 'Familiar'] : []), ...(wasp ? ['Wasp Familiar'] : []),
      ...(pet ? [seaFriend ? 'Aquatic Pet' : 'Pet'] : [])].join(', ') || '0 minions'}</span>
  </summary>
}

export function MinionsSection(props: SectionProps) {
  return <details className="character-section">
    <MinionsSummary {...props} />
    <MinionsContent {...props} />
  </details>
}

export function MinionsContent({ c, entries, save }: SectionProps) {
  const { companions, constructAdvancement, leshy, undeadFamiliar, crocodileFamiliar, familiar, wasp, seaFriend, pet } = minionSummaryData(c)
  const ferocity = minionFerocity(c)
  const magicHideKnown = knowsSpell(c, entries, 'Magic Hide')
  const companionEntries = hasConstructInnovation(c) || companions.some(comp => comp.type === CONSTRUCT_COMPANION_NAME)
    ? [...entries, ...entries.some(entry => entry.id === CONSTRUCT_COMPANION_ENTRY.id) ? [] : [CONSTRUCT_COMPANION_ENTRY]]
    : entries
  const types = companionEntries.filter((e) => e.kind === 'companion' && !e.deleted).sort((a, b) => a.name.localeCompare(b.name))
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
  const familiarCapacity = familiarSelection(c).dailyAbilityLimit
  const familiarAbilityCatalog = familiarAbilityEntries(entries, c)
  const familiarDefense = familiar || wasp ? (() => {
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
        {c.className === 'Mechanic' && c.systems.includes('sf2e') && c.subclass === 'Drone' && <details className="character-subsection" open>
          <summary><h4>Drone</h4></summary>
          <DroneFeatures c={c} entries={entries} save={save} />
        </details>}
        {(companions.length > 0 || companionGrant) && <details className="character-subsection" open>
          <summary><h4>{companions.length === 1
            ? companions[0].type === CONSTRUCT_COMPANION_NAME ? 'Construct Companion' : 'Animal Companion'
            : 'Animal Companions'}</h4></summary>
            {companions.length === 0 && companionGrant && <span>{companionGrant}{' '}
            <SearchableSelect aria-label="Choose Faithful Steed" value="" onChange={(e) => {
              const type = types.find((type) => type.name === e.target.value)
                if (type) save({ ...(faithfulSteed ? { faithfulSteedGranted: true } : {}),
                  companions: [{ id: newId(), type: type.name, name: '' }] })
            }}>
              <option value="">Choose companion...</option>
              {types.map((type) => <option key={type.id}>{type.name}</option>)}
            </SearchableSelect>
          </span>}
          {companions.length > 0 && companions.length < companionLimit && <span>Beastmaster companion{' '}
            <SearchableSelect aria-label="Choose additional companion" value="" onChange={(e) => {
              const type = types.find((type) => type.name === e.target.value)
              if (type) save({ companions: [...companions, { id: newId(), type: type.name, name: '' }] })
            }}>
              <option value="">Choose companion...</option>
              {types.map((type) => <option key={type.id}>{type.name}</option>)}
            </SearchableSelect>
          </span>}
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
              <article key={comp.id} className="gear-card">
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
                    const options = specializationOptions(projected, entries, featIndex)
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
                        const speakers = Object.values(LANGUAGE_CATEGORIES).flat().find(([name]) => name.toLowerCase() === language)?.[1]
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
            )
          })}
        </details>}
        {[...(familiar ? [{ wasp: false, data: c.familiar }] : []),
          ...(wasp ? [{ wasp: true, data: c.waspFamiliar }] : [])].map(({ wasp: isWasp, data }) => {
          const isLeshy = leshy && !isWasp
          const isUndead = undeadFamiliar && !isWasp
          const isCrocodile = crocodileFamiliar && !isWasp && !isUndead && !isLeshy
          const dailyAbilityLimit = familiarCapacity
          const familiarType = isUndead ? 'Undead familiar' : isLeshy ? 'Leshy familiar'
            : isCrocodile ? 'Crocodile familiar' : 'Familiar'
          const familiarLabel = isWasp ? 'Wasp familiar' : familiarType
          const savedAbilities = (data?.abilities ?? []).map((ability, index) => ({ ability, index })).filter(item => !!item.ability)
          const activeAbilityChoices = savedAbilities.filter(item => item.index < dailyAbilityLimit)
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
          const familiarEffects = familiarAbilityEffects(activeAbilities, c.level, data?.abilityOptions, spellcastingModifier)
          const baseSpeeds = [
            { movement: 'Land', feet: 25 },
            ...(activeAbilities.some(ability => ability.toLowerCase() === 'amphibious') ? [{ movement: 'Swim', feet: 25 }] : []),
            ...(activeAbilities.some(ability => ability.toLowerCase() === 'climber') ? [{ movement: 'Climb', feet: 25 }] : []),
            ...(activeAbilities.some(ability => ability.toLowerCase() === 'flier') ? [{ movement: 'Fly', feet: 25 }] : []),
          ]
          const skilledCount = activeAbilities.filter(ability => ability.toLowerCase() === 'skilled').length
          const resistanceCount = activeAbilities.filter(ability => ability.toLowerCase() === 'resistance').length
          const saveFamiliar = (changes: Partial<NonNullable<Character['familiar']>>) =>
            save(isWasp ? { waspFamiliar: { ...data, ...changes } } : { familiar: { ...data, ...changes } })
          const saveAbilityOptions = (abilityOptions: NonNullable<Character['familiar']>['abilityOptions']) =>
            saveFamiliar({ abilityOptions: { ...data?.abilityOptions, ...abilityOptions } })
          const chooseAbility = (event: { target: { value: string } }) => {
            const ability = familiarAbilityCatalog.find(entry => entry.id === event.target.value)
            if (!ability || activeAbilityChoices.length >= dailyAbilityLimit
              || /^specific familiar\b/i.test(String(ability.data.ability_type ?? ''))
              || familiarAbilityUnavailableReason(ability, c, savedAbilities.map(item => item.ability), isUndead, entries)) return
            const abilities = [...(data?.abilities ?? [])]
            const slot = Array.from({ length: dailyAbilityLimit }, (_, index) => index).find(index => !abilities[index])
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
          return <details key={isWasp ? 'wasp' : 'familiar'} className="character-subsection" open>
          <summary><h4>{isWasp ? 'Wasp Familiar' : isUndead ? 'Undead Familiar' : isLeshy ? 'Leshy Familiar'
            : isCrocodile ? 'Crocodile Familiar' : 'Familiar'}</h4> ({activeAbilityChoices.length}/{dailyAbilityLimit})</summary>
          {isCrocodile && <small>Tiny crocodile familiar granted by Crocodile's Twin.</small>}
          {isWasp && <div className="gear-runes">{['Burrower', 'Flier'].map(name => {
            const entry = familiarAbilityEntry(name, familiarAbilityCatalog, c)
            return entry ? <EntryDescription key={name} name={name} entry={entry} entries={entries} character={c}
              buttonLabel={`Granted ${name}`} /> : <small key={name}>{name}</small>
          })}</div>}
          <div><small>Hit Points</small> <b>{familiarEffects.hitPoints}</b></div>
          {isUndead && <>
            <div className="gear-traits"><EntryDescription name="Undead" entry={UNDEAD_FAMILIAR_TRAIT}
              className="gear-trait" entries={entries} character={c} /></div>
          </>}
          {familiarDefense && <>
            <div className="gear-stats">
              <span><small>Armor Class</small><b>{familiarDefense.ac}</b></span>
              <span><small>Fortitude</small>{signed(familiarDefense.fortitude)}</span>
              <span><small>Reflex</small>{signed(familiarDefense.reflex)}</span>
              <span><small>Will</small>{signed(familiarDefense.will)}</span>
            </div>
          </>}
          {isLeshy && <label>Granted ability{' '}
            <select aria-label="Leshy familiar granted ability" value={data?.leshyAbility ?? ''} onChange={event => {
              const value = event.target.value
              saveFamiliar({ leshyAbility: value === 'Plant' || value === 'Fungus' ? value : undefined })
            }}>
              <option value="">Choose ability</option><option>Plant</option><option>Fungus</option>
            </select>
          </label>}
          <div className="gear-runes">
            {[...savedAbilities].sort((a, b) => a.ability.localeCompare(b.ability, undefined, { sensitivity: 'base' }) || a.index - b.index)
              .map(({ ability, index }) => {
              const { entry, reason } = abilityStatus(ability, index)
              return <div key={`${index}:${ability}`} className="rune">
                <EntryDescription name={entry?.name ?? ability} entry={entry} entries={entries} character={c} />
                {index >= dailyAbilityLimit && <small> (inactive)</small>}
                {reason && index < dailyAbilityLimit && <small title={reason}> (unavailable)</small>}
                <button type="button" aria-label={`Remove ${familiarLabel} ability ${index + 1}`}
                  onClick={() => confirmRemoval(`familiar ability "${ability}"`, () =>
                    saveFamiliar({ abilities: (data?.abilities ?? []).filter((_, abilityIndex) => abilityIndex !== index) }))}>×</button>
              </div>
            })}
            {activeAbilityChoices.length < dailyAbilityLimit && <SearchableSelect aria-label={`${familiarLabel} ability`}
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
          <div><small>Speed</small> {familiarEffects.speeds.map(speed =>
            `${speed.movement === 'Land' ? '' : `${speed.movement} `}${speed.feet} feet`).join(', ')}</div>
          {familiarEffects.senses.length > 0 && <div><small>Senses</small> {familiarEffects.senses.join(', ')}</div>}
          {familiarEffects.resistances.length > 0 && <div><small>Resistances</small> {familiarEffects.resistances
            .map(resistance => `${resistance.damage} ${resistance.value}`).join(', ')}</div>}
          {familiarEffects.skilled.length > 0 && <div><small>Skilled</small> {familiarEffects.skilled
            .map(skill => `${skill.skill} ${signed(skill.modifier)}`).join(', ')}</div>}
          {activeAbilities.some(ability => ability.toLowerCase() === 'fast movement') && <label>Fast Movement{' '}
            <select aria-label={`${familiarType} Fast Movement speed`} value={data?.abilityOptions?.fastMovement ?? 'Land'}
              onChange={event => saveAbilityOptions({ fastMovement: event.target.value })}>
              {baseSpeeds.map(speed => <option key={speed.movement} value={speed.movement}>{speed.movement} ({speed.feet} feet)</option>)}
            </select>
          </label>}
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
          {!isWasp && c.className === 'Witch' && <small>One ability must be your patron's unique familiar ability.</small>}
          {isLeshy && activeFeatsNamed(c, 'Grown of Oak').length > 0 && knowsSpell(c, entries, 'Oaken Resilience') && <>
            {oaken && <small>Oaken Resilience: Bludgeoning and piercing resistance {oaken.resistance}; fire weakness {oaken.fireWeakness}.</small>}
            <SourceNote source="Grown of Oak" note="Targets your leshy familiar only if within 30 feet when cast." />
          </>}
          <MinionFerocity c={c} ferocity={ferocity} />
        </details>})}
        {pet && <details className="character-subsection" open>
          <summary><h4>{seaFriend ? 'Aquatic Pet' : 'Pet'}</h4></summary>
          <label>Name <input aria-label="Pet name" value={c.pet?.name ?? ''}
            onChange={event => save({ pet: { ...c.pet, name: event.target.value } })} /></label>
          {!seaFriend && <label><input type="checkbox" aria-label="Aquatic pet" checked={!!c.pet?.aquatic}
            onChange={event => save({ pet: { ...c.pet, aquatic: event.target.checked } })} /> Aquatic</label>}
          <small>Level {c.level}; HP {c.level * (petAbilities.includes('Tough') || seaFriend ? 7 : 5)}; {seaFriend || c.pet?.aquatic ? 'swim Speed 25 feet; breathes water' : 'Speed 25 feet'}; low-light vision.</small>
          {seaFriend && <small>Friend of the Sea grants Darkvision and Tough in addition to two pet abilities.</small>}
          {Array.from({ length: 2 }, (_, index) => <label key={index}>Pet ability {index + 1}{' '}
            <select aria-label={`Pet ability ${index + 1}`} value={petAbilities[index] ?? ''} onChange={event => {
              const value = event.target.value
              if (value && (!PET_ABILITIES.includes(value) || petAbilities.some((other, i) => i !== index && other === value)
                || seaFriend && ['Darkvision', 'Tough'].includes(value))) return
              const abilities = Array.from({ length: Math.max(petAbilities.length, index + 1) }, (_, i) => petAbilities[i] ?? '')
              abilities[index] = value
              save({ pet: { ...c.pet, abilities } })
            }}>
              <option value="">Choose ability</option>
              {petAbilities[index] && !PET_ABILITIES.includes(petAbilities[index]) && <option value={petAbilities[index]}>{petAbilities[index]}</option>}
              {PET_ABILITIES.filter(ability => ability === petAbilities[index] || !petAbilities.includes(ability)
                && !(seaFriend && ['Darkvision', 'Tough'].includes(ability))).map(ability => <option key={ability} disabled={seaFriend && ['Darkvision', 'Tough'].includes(ability)}>{ability}</option>)}
            </select>
          </label>)}
          {[...new Set([...petAbilities.filter(ability => PET_ABILITIES.includes(ability)), ...(seaFriend ? ['Darkvision', 'Tough'] : [])])]
            .map(ability => <small key={ability}>{ability}: {PET_ABILITY_NOTES[ability]}</small>)}
          {seaFriend && petAbilities.some(ability => ['Darkvision', 'Tough'].includes(ability)) && <small>Choose a different pet ability; Darkvision and Tough are already granted.</small>}
          <MinionFerocity c={c} ferocity={ferocity} />
        </details>}
      </div>
  )
}
