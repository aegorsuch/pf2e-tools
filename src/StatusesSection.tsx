import { activeFeatsNamed, activeStance, activeUntamedShiftEffects, armorEntry, armorProficiencyRank, boneShieldActive, conditionValue, equippedShield, featEffectChange, hasHuntPrey, hasParryWeapon, isBucklerShield, isFeatEffectActive, isSpellActive, knowsSpell, ownedArmors, parryValue, selectedFeatEntry, shieldAcBonus, shieldParagonActive, shieldRaised, shieldRaisedChange, spellActiveChange, twinnedDefenseActive, warriorLegendWeakness, weaponEntry, whirlwindStanceActive, wornArmor, type SectionProps } from './builder'
import { grantedFeatSpells } from './featSpells'
import { FavoredTerrainSelector, HardenFleshToggle, RageToggle } from './SkillsSection'
import { StancesContent } from './StancesSection'
import { ActiveSpellActions, automatedSpellStatusControls, ProtectCompanionOptions, SpiritOfTheBeastOptions, SpellEffectActions, ZealousConvictionToggle } from './SpellsSection'
import { EntryDescription } from './EntryDescription'
import { SimplePoisons } from './GearSection'
import { isAncestralEmbrace, isBastionNamedArmor, isImmortalBastion, isIncendiaryArmor, isMountainArmor, mountainPoisonImmunities } from './namedArmor'
import { DamageRoll } from './SpellDamage'
import { ANCESTRAL_AVATAR } from './battleForms'
import { FULMINATING_SHOT_ELEMENTS, fulminatingShotBonus } from './fulminatingShot'
import { confirmRemoval } from './confirmRemoval'
import { PURIFY_AIR_DESCRIPTION, purifyAirActive, purifyAirAvailable } from './familiarAbilities'
import { summonSpellName } from './summonedFiends'
import { Fragment } from 'react'
import type { ContentEntry } from './types'
import { companionAdvancementFor, companionStats, constructCompanionAdvancement, CONSTRUCT_COMPANION_NAME,
  hasCompanionMountOption, isBadgerCompanion } from './companions'
import { ActionIcon } from './ActionIcon'
import { AUTOMATIC_JETPACK_ID, armorUpgradeEntries, automaticSpecificArmorUpgrades, forceFieldAlwaysActive, forceFieldStats, jetpackSpeed } from './builder'
import type { OwnedArmor } from './types'

const entrenchMeleeEntry = (bonus: number): ContentEntry => ({
  id: `action:entrench-melee:${bonus}`, systems: ['pf2e'], kind: 'trait', source: 'official', name: 'Entrench Melee',
  level: 0, traits: ['Entrench'], effects: [], updatedAt: 0, data: { actions: 'Single Action' },
  description: `Spend a single action to gain a +${bonus} circumstance bonus to AC against melee attacks until the start of your next turn. Circumstance bonuses to AC do not stack.`,
})

const companionLabel = (companion: NonNullable<SectionProps['c']['companions']>[number]) =>
  companion.name || companion.type
const spiritAspectStatusName = (companion: NonNullable<SectionProps['c']['companions']>[number]) =>
  companion.spiritAspect
    ? `Spirit of the Beast (${companionLabel(companion)}: ${companion.spiritAspect === 'Alpha'
      ? 'Aspect of the Alpha' : `Aspect of ${companion.spiritAspect}`})`
    : undefined

const canDeviseAStratagem = (c: SectionProps['c']) => c.systems.includes('pf2e') && c.className === 'Investigator'

const HUNT_PREY: ContentEntry = {
  id: 'action:hunt-prey', systems: ['pf2e'], kind: 'classFeature', source: 'official', name: 'Hunt Prey',
  level: 1, traits: ['Concentrate'], effects: [], updatedAt: 0,
  description: 'Choose one creature you can see or hear, or are tracking during exploration, as your prey. '
    + 'Gain a +2 circumstance bonus to Perception checks to Seek it and Survival checks to Track it. '
    + 'Ignore the ranged attack penalty in the second range increment against it. '
    + 'You can designate only one prey at a time; choosing another replaces it. The designation lasts until your next daily preparations.',
  data: { url: 'https://2e.aonprd.com/Actions.aspx?ID=2257' },
}

const PARRY: ContentEntry = {
  id: 'trait:parry', systems: ['pf2e'], kind: 'trait', source: 'official', name: 'Parry',
  level: 0, traits: [], effects: [], updatedAt: 0,
  description: 'While wielding a parry weapon with trained or better proficiency, spend one action to gain a +1 circumstance bonus to AC until the start of your next turn.',
  data: { url: 'https://2e.aonprd.com/Traits.aspx?ID=667' },
}

export function parryTrait(c: SectionProps['c'], entries: SectionProps['entries']) {
  return entries.find(entry => entry.kind === 'trait' && !entry.deleted && entry.name === 'Parry'
    && entry.systems.some(system => c.systems.includes(system))) ?? PARRY
}

const CONDITION_RULES = {
  enfeebled: "You're physically weakened. Enfeebled always includes a value. When you are enfeebled, you take a status penalty equal to the condition value to Strength-based rolls and DCs, including Strength-based melee attack rolls, Strength-based damage rolls, and Athletics checks.",
  frightened: "You're gripped by fear and struggle to control your nerves. The frightened condition always includes a value. You take a status penalty equal to this value to all your checks and DCs. Unless specified otherwise, at the end of each of your turns, the value of your frightened condition decreases by 1.",
  sickened: "You feel ill. Sickened always includes a value. You take a status penalty equal to this value on all your checks and DCs. You can't willingly ingest anything\u2014including elixirs and potions\u2014while sickened.\n\nYou can spend a single action retching in an attempt to recover, which lets you immediately attempt a Fortitude save against the DC of the effect that made you sickened. On a success, you reduce your sickened value by 1 (or by 2 on a critical success).",
  doomed: "Your soul has been gripped by a powerful force that calls you closer to death. Doomed always includes a value. The dying value at which you die is reduced by your doomed value. If your maximum dying value is reduced to 0, you instantly die. When you die, you're no longer doomed.\n\nYour doomed value decreases by 1 each time you get a full night's rest.",
} as const
const CONDITION_IDS = { doomed: 67, enfeebled: 71, frightened: 76, sickened: 91 } as const
const conditionEntry = (name: keyof typeof CONDITION_RULES): ContentEntry => ({
  id: `condition:${name}`, systems: ['pf2e'], kind: 'item', source: 'official', name: name[0].toUpperCase() + name.slice(1),
  level: 0, traits: [], effects: [], updatedAt: 0, description: CONDITION_RULES[name], data: { url: `/Conditions.aspx?ID=${CONDITION_IDS[name]}` },
})

const FAVORED_TERRAIN: ContentEntry = {
  id: 'feat:favored-terrain', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Favored Terrain',
  level: 2, traits: ['Ranger'], effects: [], updatedAt: 0,
  description: 'Choose a favored terrain. Ignore non-magical difficult terrain there; Unimpeded Journey grants an additional benefit based on the terrain.',
  data: {},
}

const LIVING_FLAME: ContentEntry = {
  id: 'armor:living-flame', systems: ['pf2e'], kind: 'item', source: 'official', name: 'Living Flame',
  level: 20, traits: ['Aura', 'Concentrate', 'Fire'], effects: [], updatedAt: 0,
  description: 'Once per day, engulf yourself in living fire for 10 minutes in a 15-foot emanation. Creatures entering the aura or starting their turn in it take 10d6 fire damage (DC 40 basic Reflex save). The area is difficult terrain for other creatures.',
  data: { actions: 'Two Actions', url: 'https://2e.aonprd.com/Equipment.aspx?ID=3814' },
}

const HOLO_ROGER: ContentEntry = {
  id: 'action:holo-roger', systems: ['sf2e'], kind: 'classFeature', source: 'official', name: 'Holo-Roger',
  level: 2, traits: [], effects: [], updatedAt: 0,
  description: 'Trigger: You roll initiative. Project your ship’s holo-flag for 1 minute and attempt to Demoralize one enemy within 30 feet that can see it. While projected on a starship, gain a +1 circumstance bonus to Intimidation checks to Demoralize.',
  data: { actions: 'Free Action', url: 'https://2e.aonsrd.com/actions/189-holo-roger' },
}

function entrenchMeleeActive(c: SectionProps['c'], entries: SectionProps['entries']) {
  return ownedArmors(c, entries).some(armor => {
    if (!isBastionNamedArmor(armor.name) || !armor.entrenchMeleeActive || !armor.worn || armor.inheritorCloakRed) return false
    const entry = armorEntry(c, entries, armor.name, armor.id)
    return !!entry && armorProficiencyRank(c, entries, entry) > 0
  })
}

function defenseToggles(c: SectionProps['c'], entries: SectionProps['entries']) {
  const shield = equippedShield(c)
  const whirlwind = whirlwindStanceActive(c, entries)
  const parry = whirlwind ? 2 : parryValue(c, entries)
  const boneShield = boneShieldActive(c)
  return {
    shield, parry, boneShield,
    shieldLabel: shield?.id === 'granted-shield:chitinous' ? 'Raise Chitinous Shield'
      : shield && isBucklerShield(shield.name) ? 'Raise Buckler' : 'Raise Shield',
    cantrip: knowsSpell(c, entries, 'Shield'),
    parryWeapon: hasParryWeapon(c, entries),
    stanceParry: twinnedDefenseActive(c, entries) || whirlwind,
  }
}

function armorDeviceStatuses(c: SectionProps['c'], entries: SectionProps['entries']) {
  const armor = c.systems.includes('sf2e') ? wornArmor(c, entries) : undefined
  const empty = { armor: undefined, jetpack: undefined, jetpackId: undefined, jetpackActive: false,
    forceField: undefined, forceFieldStats: undefined, forceFieldActive: false }
  if (!armor) return empty
  const armorItem = armorEntry(c, entries, armor.name, armor.id)
  const automatic = automaticSpecificArmorUpgrades(c, entries, armorItem)
  const upgrades = armorUpgradeEntries(c, entries, armor)
  const automaticJetpack = automatic.find(entry => jetpackSpeed(entry) > 0)
  const jetpack = automaticJetpack ?? upgrades.find(entry => jetpackSpeed(entry) > 0)
  const activeManualJetpack = upgrades.find(entry => entry.id === armor.activeJetpack && jetpackSpeed(entry) > 0)
  const forceField = upgrades.find(entry => forceFieldStats(entry))
  const stats = forceFieldStats(forceField)
  return {
    armor, jetpack, jetpackId: automaticJetpack ? AUTOMATIC_JETPACK_ID : jetpack?.id,
    jetpackActive: armor.activeJetpack === AUTOMATIC_JETPACK_ID && !!automaticJetpack || !!activeManualJetpack,
    forceField, forceFieldStats: stats,
    forceFieldActive: !!stats && (!!armor.activeForceField || forceFieldAlwaysActive(forceField)),
  }
}

export function StatusesSummary({ c, entries, save }: SectionProps) {
  const defense = defenseToggles(c, entries)
  const armorDevices = armorDeviceStatuses(c, entries)
  const stance = activeStance(c, entries)
  const poisonTotal = Math.max(0, Math.floor(c.level))
  const poisonSpent = Math.max(0, Math.min(poisonTotal, Math.floor(c.simplePoisonsSpent ?? 0)))
  const active = [
    ...(canDeviseAStratagem(c) && c.deviseAStratagemActive ? ['Devise a Stratagem'] : []),
    ...(hasHuntPrey(c, entries) && c.huntPreyActive ? ['Hunt Prey'] : []),
    ...(c.raging ? ['Rage'] : []),
    ...(defense.shield && shieldRaised(c) ? [defense.shieldLabel] : []),
    ...(defense.boneShield ? (c.boneShieldRaised ? ['Raise Bone Shield'] : [])
      : defense.cantrip && isSpellActive(c, entries, 'Shield') ? ['Raise Shield Cantrip (+1 AC)'] : []),
    ...(defense.parryWeapon && defense.parry > 0 && (c.parrying || defense.stanceParry) ? ['Parry'] : []),
    ...(stance ? [stance.name] : []),
    ...(activeFeatsNamed(c, 'Poison Weapon').length
      ? [`Poison Weapon ${poisonTotal - poisonSpent}/${poisonTotal}${c.poisonWeaponActive ? ' (active)' : ''}`] : []),
    ...(c.companions ?? []).filter(companion => isBadgerCompanion(companion) && companion.badgerRageActive)
      .map(companion => `Badger Rage (${companion.name || companion.type})`),
    ...(c.companions ?? []).filter(companion => companion.id === c.mountedCompanionId)
      .map(companion => `Mounted (${companionLabel(companion)})`),
    ...(knowsSpell(c, entries, 'Spirit of the Beast')
      ? (c.companions ?? []).flatMap(companion => spiritAspectStatusName(companion) ?? []) : []),
    ...(entrenchMeleeActive(c, entries) ? ['Entrench Melee'] : []),
    ...(armorDevices.jetpackActive && armorDevices.jetpack ? [armorDevices.jetpack.name] : []),
    ...(armorDevices.forceFieldActive && armorDevices.forceFieldStats
      ? [`Force Field (+${armorDevices.forceFieldStats.hitPoints} HP)`] : []),
    ...(mountainPoisonImmunities(c).length ? ['Poison Immunity'] : []),
    ...((c.armors ?? []).some(armor => isIncendiaryArmor(armor.name) && armor.livingFlameActive) ? ['Living Flame'] : []),
    ...(fulminatingShotBonus(c) ? [`Fulminating Shot (${fulminatingShotBonus(c)})`] : []),
    ...(purifyAirActive(c) ? ['Purify Air'] : []),
    ...(c.hardenFleshActive && activeFeatsNamed(c, 'Harden Flesh').length ? ['Harden Flesh'] : []),
    ...(c.systems.includes('sf2e') && activeFeatsNamed(c, 'Space Pirate Dedication').length
      && c.holoRogerActive ? ['Holo-Roger'] : []),
    ...(c.activeSpells ?? []).flatMap(name => name === 'Shield' && defense.cantrip && !defense.boneShield
      ? []
      : name === ANCESTRAL_AVATAR
        ? isAncestralEmbrace(wornArmor(c, entries)?.name) ? ['Avatar'] : []
        : [name]),
    ...(c.summonedUndead ? ['Summon Undead'] : []),
    ...(c.summonedFiend ? [summonSpellName(c.summonedFiend)] : []),
    ...(c.systems.includes('sf2e') && activeFeatsNamed(c, 'Creature Ally').length
      && (c.ancestry === 'Vesk' && c.creatureAllyActive || c.ancestry === 'Shirren' && c.shirrenCreatureAllyActive
        || c.ancestry === 'Lashunta' && c.lashuntaCreatureAlly) ? ['Summon Animal'] : []),
    ...c.activeFeatEffects ?? [],
    ...(c.zealousConvictionRank !== undefined ? ['Zealous Conviction'] : []),
    ...(activeFeatsNamed(c, 'Favored Terrain').length && isFeatEffectActive(c, 'Favored Terrain') ? ['Favored Terrain'] : []),
    ...(['frightened', 'sickened', 'enfeebled'] as const).flatMap(name =>
      conditionValue(c, name) ? [`${name[0].toUpperCase() + name.slice(1)} ${conditionValue(c, name)}`] : []),
  ]
  const headerToggle = (name: string) => {
    const toggle = name === 'Cairn Form' || name === 'Mountain Resilience'
      ? () => save(spellActiveChange(c, name, false))
      : name === 'Entrench Melee'
        ? () => save({ armors: ownedArmors(c, entries).map(armor => armor.entrenchMeleeActive
          ? { ...armor, entrenchMeleeActive: false } : armor) })
        : name.startsWith('Badger Rage (')
          ? () => save({ companions: c.companions?.map(companion =>
            `Badger Rage (${companion.name || companion.type})` === name
              ? { ...companion, badgerRageActive: false } : companion) })
        : name.startsWith('Mounted (')
          ? () => save({ mountedCompanionId: undefined })
        : name.startsWith('Spirit of the Beast (')
          ? () => save({ companions: c.companions?.map(companion =>
            spiritAspectStatusName(companion) === name ? { ...companion, spiritAspect: undefined } : companion) })
        : name === 'Tenacious Stance' ? () => save({ activeStance: undefined }) : undefined
    if (!toggle) return name
    return <button type="button" className="status-header-toggle" aria-label={name} aria-pressed="true"
      onClick={event => { event.preventDefault(); event.stopPropagation(); toggle() }}>{name}</button>
  }
  const headerEntry = (name: string) => entries.find(entry => !entry.deleted && entry.name === name
    && entry.systems.some(system => c.systems.includes(system))
    && ['spell', 'feat', 'classFeature'].includes(entry.kind))
  const headerContent = (name: string) => {
    const toggle = headerToggle(name)
    if (typeof toggle !== 'string') return toggle
    const entry = headerEntry(name)
    return entry
      ? <span className="status-header-info" onClick={event => event.stopPropagation()}>
        <EntryDescription name={name} entry={entry} entries={entries} character={c} hideButtonActions deferDetails />
      </span>
      : name
  }
  const sorted = [...new Set(active)].sort((a, b) => a.localeCompare(b))
  return <summary className="character-section-summary"><strong>Statuses</strong>
    <span>{sorted.length ? sorted.map((name, index) => <Fragment key={name}>{index > 0 && ', '}
      {name === 'Parry' ? <span onClick={event => event.stopPropagation()}>
        <EntryDescription name="Parry" entry={parryTrait(c, entries)} entries={entries} character={c} deferDetails />
      </span> : headerContent(name)}</Fragment>) : 'None active'}</span>
  </summary>
}

export function DeviseAStratagemToggle({ c, save, summary = false }: Pick<SectionProps, 'c' | 'save'> & { summary?: boolean }) {
  if (!canDeviseAStratagem(c)) return null
  const toggle = <label><input type="checkbox" aria-label="Devise a Stratagem active" checked={!!c.deviseAStratagemActive}
    onChange={event => save({ deviseAStratagemActive: event.target.checked })} /> Devise a Stratagem</label>
  return summary
    ? <span className="combat-summary-toggles" onClick={event => event.stopPropagation()}>{toggle}</span>
    : toggle
}

export function HuntPreyToggle({ c, entries, save, summary = false }: SectionProps & { summary?: boolean }) {
  if (!hasHuntPrey(c, entries)) return null
  const content = <><input type="checkbox" aria-label="Hunt Prey active" checked={!!c.huntPreyActive}
      onChange={event => save({ huntPreyActive: event.target.checked })} />{' '}
    <EntryDescription name="Hunt Prey" entry={HUNT_PREY} character={c} entries={entries} hideButtonActions />{' '}
    <ActiveSpellActions name="Hunt Prey" entry={HUNT_PREY} actions="Single Action">
      <label><input type="checkbox" aria-label="Hunt Prey active in options" checked={!!c.huntPreyActive}
        onChange={event => save({ huntPreyActive: event.target.checked })} /> Hunt Prey</label>
    </ActiveSpellActions></>
  return <span className={summary ? 'combat-summary-toggles' : undefined}
    onClick={summary ? event => event.stopPropagation() : undefined}>{content}</span>
}

export function StatusesContent({ c, entries, save }: SectionProps) {
  const defense = defenseToggles(c, entries)
  const armorDevices = armorDeviceStatuses(c, entries)
  const updateArmorDevice = (patch: Pick<OwnedArmor, 'activeJetpack' | 'activeForceField'>) => {
    const armor = armorDevices.armor
    if (!armor) return
    save({ armors: (c.armors ?? ownedArmors(c, entries)).map(current => current.id === armor.id
      ? { ...current, ...patch } : current) })
  }
  const jetpackControl = armorDevices.jetpack && armorDevices.jetpackId
    ? { name: 'Jetpack', element: <button type="button"
      className={`spell-action-button status-action-button${armorDevices.jetpackActive ? ' on' : ''}`}
      aria-label={`${armorDevices.jetpackActive ? 'Dismiss' : 'Activate'} ${armorDevices.jetpack.name}`}
      aria-pressed={armorDevices.jetpackActive}
      title={`${armorDevices.jetpackActive ? 'Deactivate' : 'Activate'} jetpack (1 minute)`}
      onClick={() => updateArmorDevice({ activeJetpack: armorDevices.jetpackActive ? undefined : armorDevices.jetpackId })}>
      {armorDevices.jetpackActive && <span aria-hidden="true">✓</span>}
      <ActionIcon actions="Single Action" /> {armorDevices.jetpack.name}
    </button> }
    : undefined
  const forceFieldAlwaysOn = forceFieldAlwaysActive(armorDevices.forceField)
  const forceFieldControl = armorDevices.forceField && armorDevices.forceFieldStats
    ? { name: 'Force Field', element: forceFieldAlwaysOn
      ? <span className="spell-action-button status-action-button on" role="status"
        aria-label={`${armorDevices.forceField.name} always active`}>
        <span aria-hidden="true">✓</span> {armorDevices.forceField.name} (+{armorDevices.forceFieldStats.hitPoints} HP)
      </span>
      : <button type="button"
        className={`spell-action-button status-action-button${armorDevices.forceFieldActive ? ' on' : ''}`}
        aria-label={`${armorDevices.forceFieldActive ? 'Dismiss' : 'Activate'} ${armorDevices.forceField.name}`}
        aria-pressed={armorDevices.forceFieldActive}
        title={`${armorDevices.forceFieldActive ? 'Deactivate' : 'Activate'} Force Field; ${armorDevices.forceFieldStats.hitPoints} HP, replenishes ${armorDevices.forceFieldStats.regeneration} HP at the start of your turn`}
        onClick={() => updateArmorDevice({ activeForceField: !armorDevices.forceFieldActive })}>
        {armorDevices.forceFieldActive && <span aria-hidden="true">✓</span>}
        <ActionIcon actions="Single Action" /> {armorDevices.forceField.name} (+{armorDevices.forceFieldStats.hitPoints} HP)
      </button> }
    : undefined
  const companionStatuses = (c.companions ?? []).map((companion, index) => {
    const advancement = companion.type === CONSTRUCT_COMPANION_NAME
      ? constructCompanionAdvancement(c) : companionAdvancementFor(c, index)
    const stats = companionStats(c, entries, companion.type, advancement, companion.id)
    return { companion, mountable: hasCompanionMountOption(c, stats?.mount) }
  })
  const grant = grantedFeatSpells(c, entries).find(spell => spell.source === 'Heroic Presence')
  const summonedUndead = c.summonedUndead
  const summonedFiend = c.summonedFiend
  const entrenchArmors = ownedArmors(c, entries).filter(armor => isBastionNamedArmor(armor.name))
  const mountainArmors = ownedArmors(c, entries).filter(armor => isMountainArmor(armor.name))
  const incendiaryArmors = ownedArmors(c, entries).filter(armor => isIncendiaryArmor(armor.name))
  const cursedWeakness = warriorLegendWeakness(c, entries)
  const ancestralAvatarAvailable = isAncestralEmbrace(wornArmor(c, entries)?.name)
  const avatarEntry = entries.find(entry => entry.kind === 'spell' && !entry.deleted && entry.name === 'Avatar'
    && entry.systems.some(system => c.systems.includes(system)))
  const ancestralAvatarActive = ancestralAvatarAvailable && !!c.activeSpells?.includes(ANCESTRAL_AVATAR)
  const spellControls = automatedSpellStatusControls({ c, entries, save })
    .filter(control => control.name !== 'Shield' || !defense.cantrip || defense.boneShield)
  const crimsonClawModes = (c.weapons ?? []).flatMap(weapon => {
    const entry = weaponEntry(entries, weapon.name, weapon.id)
    if (!/^crimson claw\b/i.test(entry?.name ?? '')) return []
    const modes = entry?.weaponModes ?? []
    const fire = modes.find(mode => mode.damageType.toLowerCase() === 'fire')
    const slashing = modes.find(mode => mode.damageType.toLowerCase() === 'slashing')
    return fire && slashing ? [{ weapon, modes, fire, slashing }] : []
  })
  const untamedShift = knowsSpell(c, entries, 'Untamed Shift')
  const shiftEntry = entries.find(entry => entry.kind === 'spell' && !entry.deleted && entry.name === 'Untamed Shift'
    && entry.systems.some(system => c.systems.includes(system)))
  const shiftActive = isSpellActive(c, entries, 'Untamed Shift')
  const shiftCanRestore = untamedShift && !!c.untamedShiftEffects?.length
    && activeUntamedShiftEffects({ ...c, ...spellActiveChange(c, 'Untamed Shift', true) }, entries).length > 0
  const purifyAirEntry: ContentEntry = { id: 'leshy-secret:Purify Air', systems: c.systems, kind: 'familiar', source: 'official',
    name: 'Purify Air', level: 1, traits: [], description: PURIFY_AIR_DESCRIPTION, data: {}, effects: [], updatedAt: 0 }
  const heroicDefianceEntry = entries.find(entry => entry.kind === 'feat' && !entry.deleted
    && entry.name === 'Heroic Defiance' && entry.systems.some(system => c.systems.includes(system)))
  const zealousEntry = grant?.entry ?? entries.find(entry => entry.kind === 'spell' && !entry.deleted
    && entry.name === 'Zealous Conviction' && entry.systems.some(system => c.systems.includes(system)))
  const zealousRank = grant?.rank ?? c.zealousConvictionRank
  const terrainEntry = selectedFeatEntry(c, entries, 'Favored Terrain') ?? FAVORED_TERRAIN
  const terrainActive = isFeatEffectActive(c, 'Favored Terrain')
  const terrainLocked = activeFeatsNamed(c, 'Terrain Master').length > 0
  const controls = [
    { name: 'Active stance', element: <StancesContent c={c} entries={entries} save={save} /> },
    ...(jetpackControl ? [jetpackControl] : []),
    ...(forceFieldControl ? [forceFieldControl] : []),
    ...(crimsonClawModes.length ? [{ name: 'Crimson Claw', element: <div className="status-action-group">
      {crimsonClawModes.map(({ weapon, modes, fire, slashing }) => {
        const selected = modes.find(mode => mode.id === weapon.weaponMode) ?? modes[0] ?? fire
        const fireSelected = selected.id === fire.id
        return <label key={weapon.id}><input type="checkbox" aria-label={`Crimson Claw mode status: ${weapon.name}`}
          checked={fireSelected} onChange={event => save({ weapons: (c.weapons ?? []).map(current =>
            current.id === weapon.id ? { ...current, weaponMode: event.target.checked ? fire.id : slashing.id } : current) })} />
          {' '}{weapon.name}: {fireSelected ? 'Fire' : 'Slashing'}
        </label>
      })}
    </div> }] : []),
    ...(activeFeatsNamed(c, 'Heroic Defiance').length ? [{ name: 'Heroic Defiance', element: <>
      <input type="checkbox" aria-label="Heroic Defiance active" checked={isFeatEffectActive(c, 'Heroic Defiance')}
        onChange={event => save(featEffectChange(c, 'Heroic Defiance', event.target.checked))} />{' '}
      <EntryDescription name="Heroic Defiance" entry={heroicDefianceEntry} entries={entries} character={c} hideButtonActions />{' '}
      {heroicDefianceEntry && <ActiveSpellActions name="Heroic Defiance" entry={heroicDefianceEntry}>
        <label><input type="checkbox" aria-label="Heroic Defiance active in options" checked={isFeatEffectActive(c, 'Heroic Defiance')}
          onChange={event => save(featEffectChange(c, 'Heroic Defiance', event.target.checked))} /> Heroic Defiance</label>
      </ActiveSpellActions>}
    </> }] : []),
    ...(activeFeatsNamed(c, 'Poison Weapon').length
      ? [{ name: 'Poison Weapon', element: <SimplePoisons c={c} entries={entries} save={save} /> }] : []),
    ...(canDeviseAStratagem(c)
      ? [{ name: 'Devise a Stratagem', element: <DeviseAStratagemToggle c={c} save={save} /> }] : []),
    ...(hasHuntPrey(c, entries)
      ? [{ name: 'Hunt Prey', element: <HuntPreyToggle c={c} entries={entries} save={save} /> }] : []),
    ...(c.systems.includes('sf2e') && activeFeatsNamed(c, 'Space Pirate Dedication').length ? [{
      name: 'Holo-Roger', element: <>
        <input type="checkbox" aria-label="Holo-Roger status" checked={!!c.holoRogerActive}
          onChange={event => save({ holoRogerActive: event.target.checked })} />{' '}
        <EntryDescription name="Holo-Roger" entry={HOLO_ROGER} entries={entries} character={c} hideButtonActions />{' '}
        <ActiveSpellActions name="Holo-Roger" entry={HOLO_ROGER}>
          <label><input type="checkbox" aria-label="Holo-Roger active" checked={!!c.holoRogerActive}
            onChange={event => save({ holoRogerActive: event.target.checked })} /> Active</label>
        </ActiveSpellActions>
      </>,
    }] : []),
    ...(purifyAirAvailable(c) ? [{ name: 'Purify Air', element: <>
      <input type="checkbox" aria-label="Purify Air status" checked={purifyAirActive(c)}
        onChange={event => save({ familiar: { ...c.familiar, purifyAirActive: event.target.checked } })} />{' '}
      <EntryDescription name="Purify Air" entry={purifyAirEntry} entries={entries} character={c} />
    </> }] : []),
    ...(activeFeatsNamed(c, 'Harden Flesh').length
      ? [{ name: 'Harden Flesh', element: <HardenFleshToggle c={c} save={save} /> }] : []),
    ...companionStatuses.filter(status => status.mountable).map(({ companion }) => ({
      name: `Mounted (${companionLabel(companion)})`,
      element: <label><input type="checkbox" aria-label={`Mounted on ${companionLabel(companion)}`}
        checked={c.mountedCompanionId === companion.id}
        onChange={event => save({ mountedCompanionId: event.target.checked ? companion.id : undefined,
          ...(event.target.checked ? { mountedSummon: undefined } : {}) })} /> Mounted</label>,
    })),
    ...(knowsSpell(c, entries, 'Spirit of the Beast') ? companionStatuses.map(({ companion }) => ({
      name: `Spirit of the Beast (${companionLabel(companion)})`,
      element: <SpiritOfTheBeastOptions c={c} save={save} companionId={companion.id} />,
    })) : []),
    ...(c.companions ?? []).filter(isBadgerCompanion).map(companion => {
      const name = companion.name || companion.type
      const active = !!companion.badgerRageActive
      const toggle = (checked: boolean) => save({ companions: c.companions?.map(current => current.id === companion.id
        ? { ...current, badgerRageActive: checked } : current) })
      return { name: `Badger Rage (${name})`, element: <button type="button"
        className="spell-action-button status-action-button" aria-label={`Badger Rage on ${name}`}
        aria-pressed={active} onClick={() => toggle(!active)}>
        {active && <span aria-hidden="true">✓</span>}<ActionIcon actions="Single Action" /> Badger Rage
      </button> }
    }),
    ...(ancestralAvatarAvailable ? [{ name: 'Avatar', element: <>
      <input type="checkbox" aria-label="Avatar status" checked={ancestralAvatarActive}
        onChange={event => save(spellActiveChange(c, ANCESTRAL_AVATAR, event.target.checked))} />{' '}
      <EntryDescription name="Avatar" entry={avatarEntry} entries={entries} character={c} hideButtonActions />{' '}
      <ActiveSpellActions name="Avatar" entry={avatarEntry} actions="Two Actions">
        <label><input type="checkbox" aria-label="Avatar active" checked={ancestralAvatarActive}
          onChange={event => save(spellActiveChange(c, ANCESTRAL_AVATAR, event.target.checked))} /> Active</label>
      </ActiveSpellActions>
    </> }] : []),
    ...(untamedShift ? [{ name: 'Untamed Shift', element: <>
      <input type="checkbox" aria-label="Untamed Shift status" checked={shiftActive} disabled={!shiftActive && !shiftCanRestore}
        onChange={event => save(spellActiveChange(c, 'Untamed Shift', event.target.checked))} />{' '}
      <EntryDescription name="Untamed Shift" entry={shiftEntry} entries={entries} character={c} />{' '}
      <SpellEffectActions c={c} entries={entries} save={save} entry={shiftEntry} name="Untamed Shift" />
    </> }] : []),
    ...(entrenchArmors.length ? [{ name: 'Entrench Melee', element: <div className="status-action-group">{entrenchArmors.map(armor => {
      const entry = armorEntry(c, entries, armor.name, armor.id)
      const disabled = !armor.worn || !entry || !armorProficiencyRank(c, entries, entry) || !!armor.inheritorCloakRed
      const active = !!armor.entrenchMeleeActive
      const bonus = isImmortalBastion(armor.name) ? 2 : 1
      const update = (entrenchMeleeActive: boolean) => save({ armors: ownedArmors(c, entries).map(current => current.id === armor.id
        ? { ...current, entrenchMeleeActive } : current) })
      return <div key={armor.id} className="status-action-group">
        <input type="checkbox" aria-label={`Entrench Melee active: ${armor.name}`} checked={active} disabled={disabled}
          onChange={event => update(event.target.checked)} />
        <EntryDescription name="Entrench Melee" entry={entrenchMeleeEntry(bonus)} />
        <ActiveSpellActions name="Entrench Melee" entry={entrenchMeleeEntry(bonus)} actions="Single Action">
          <label><input type="checkbox" aria-label={`Entrench Melee active in options: ${armor.name}`}
            checked={active} disabled={disabled} onChange={event => update(event.target.checked)} /> Active</label>
        </ActiveSpellActions>
      </div>
    })}</div> }] : []),
    ...(mountainArmors.length ? [{ name: 'Poison Immunity', element: <div>{mountainArmors.map(armor => {
      const active = !!armor.mountainPoisonImmunityActive
      const update = (patch: Partial<typeof armor>) => save({ armors: (c.armors ?? ownedArmors(c, entries))
        .map(current => current.id === armor.id ? { ...current, ...patch } : current) })
      return <div key={armor.id}>
        <label><input type="checkbox" aria-label={`Poison immunity: ${armor.name} status`}
          checked={active} disabled={!active && (!armor.worn || !!armor.mountainPoisonImmunityUsed)}
          onChange={event => update({ mountainPoisonImmunityActive: event.target.checked,
            ...(event.target.checked ? { mountainPoisonImmunityUsed: true } : {}) })} />
          {' '}Poison Immunity: {armor.name}</label>
        {armor.mountainPoisonImmunityUsed && <button type="button" aria-label={`Reset ${armor.name} poison immunity`}
          onClick={() => update({ mountainPoisonImmunityUsed: false, mountainPoisonImmunityActive: false })}>Daily preparations</button>}
      </div>
    })}</div> }] : []),
    ...(incendiaryArmors.length ? [{ name: 'Living Flame', element: <div>{incendiaryArmors.map(armor => {
      const active = !!armor.livingFlameActive
      const update = (patch: Partial<typeof armor>) => save({ armors: (c.armors ?? ownedArmors(c, entries))
        .map(current => current.id === armor.id ? { ...current, ...patch } : current) })
      const toggle = (checked: boolean) => update({ livingFlameActive: checked, ...(checked ? { livingFlameUsed: true } : {}) })
      const disabled = !active && (!armor.worn || !!armor.livingFlameUsed)
      const useLabel = `${armor.livingFlameUsed ? 'Restore' : 'Spend'} ${armor.name} Living Flame use 1`
      return <div key={armor.id}>
        <input type="checkbox" aria-label={`Living Flame: ${armor.name} status`} checked={active} disabled={disabled}
          onChange={event => toggle(event.target.checked)} />{' '}
        <EntryDescription name="Living Flame" entry={LIVING_FLAME} hideButtonActions />{' '}
        <ActiveSpellActions name="Living Flame" entry={LIVING_FLAME} actions="Two Actions">
          <label><input type="checkbox" aria-label={`Living Flame: ${armor.name} active`} checked={active} disabled={disabled}
            onChange={event => toggle(event.target.checked)} /> Active</label>{' '}
          <DamageRoll name="Living Flame" damage={{ label: 'Damage', dice: 10, sides: 6, type: 'fire',
            note: 'DC 40 basic Reflex save' }} disabled={!active} />
        </ActiveSpellActions>
        <span className="focus-tracker" role="group" aria-label={`${armor.livingFlameUsed ? 0 : 1} of 1 uses remaining`}>
          <button type="button" className="focus-point" aria-label={useLabel} title={useLabel}
            aria-pressed={!armor.livingFlameUsed} onClick={() => update({ livingFlameUsed: !armor.livingFlameUsed })} />
        </span>
      </div>
    })}</div> }] : []),
    ...(cursedWeakness ? [{ name: 'Cursed Weakness', element: <button type="button" aria-label={`Took ${cursedWeakness.damage} damage`}
      disabled={conditionValue(c, 'doomed') >= 2}
      onClick={() => save({ conditions: { ...c.conditions, doomed: Math.max(2, conditionValue(c, 'doomed')) } })}>
      Took {cursedWeakness.damage} damage</button> }] : []),
    ...(c.systems.includes('pf2e') && activeFeatsNamed(c, 'Fulminating Shot').length ? [{
      name: 'Fulminating Shot',
      element: <div>
        <label><input type="checkbox" aria-label="Fulminating Shot status" checked={!!c.fulminatingShotActive}
          disabled={!FULMINATING_SHOT_ELEMENTS.includes(c.fulminatingShotElement as typeof FULMINATING_SHOT_ELEMENTS[number])}
          onChange={event => save({ fulminatingShotActive: event.target.checked })} />
          {' '}Fulminating Shot ({c.level >= 18 ? '3d6' : c.level >= 12 ? '2d6' : '1d6'})</label>{' '}
        <label>Element{' '}
          <select aria-label="Fulminating Shot element" value={c.fulminatingShotElement ?? ''}
            onChange={event => {
              const element = FULMINATING_SHOT_ELEMENTS.find(option => option === event.target.value)
              save({ fulminatingShotElement: element, ...(!element ? { fulminatingShotActive: false } : {}) })
            }}>
            <option value="">Choose</option>
            {FULMINATING_SHOT_ELEMENTS.map(element => <option key={element}>{element}</option>)}
          </select>
        </label>
      </div>,
    }] : []),
    ...(activeFeatsNamed(c, 'Sky Master Mask').length ? [{
      name: 'Sky Master Mask',
      element: <label><input type="checkbox" aria-label="Sky Master Mask doubled flight"
        checked={isFeatEffectActive(c, 'Sky Master Mask')}
        onChange={event => save(featEffectChange(c, 'Sky Master Mask', event.target.checked))} />
        {' '}Sky Master Mask doubled flight</label>,
    }] : []),
    ...(activeFeatsNamed(c, 'Thick Hide Mask').length ? [{
      name: 'Thick Hide Mask',
      element: <label><input type="checkbox" aria-label="Thick Hide Mask resistance active"
        checked={isFeatEffectActive(c, 'Thick Hide Mask')}
        onChange={event => save(featEffectChange(c, 'Thick Hide Mask', event.target.checked))} />
        {' '}Thick Hide Mask resistance</label>,
    }] : []),
    ...(defense.shield ? [{ name: 'Raise Shield', element: <label title={shieldParagonActive(c) ? 'Always raised by Shield Paragon' : undefined}>
      <input type="checkbox" aria-label={`${defense.shieldLabel} status`} checked={shieldRaised(c)} disabled={shieldParagonActive(c)}
        onChange={event => { if (!shieldParagonActive(c)) save(shieldRaisedChange(c, event.target.checked)) }} />
      {' '}{defense.shieldLabel} (+{shieldAcBonus(c, entries)} AC)</label> }] : []),
    ...(defense.boneShield ? [{ name: 'Raise Bone Shield', element: <label><input type="checkbox" aria-label="Raise Bone Shield status"
      checked={!!c.boneShieldRaised} onChange={event => save({ boneShieldRaised: event.target.checked })} /> Raise Bone Shield (+2 AC)</label> }]
      : defense.cantrip ? [{ name: 'Raise Shield Cantrip', element: <label><input type="checkbox" aria-label="Raise Shield Cantrip status"
        checked={isSpellActive(c, entries, 'Shield')}
        onChange={event => save(spellActiveChange(c, 'Shield', event.target.checked))} /> Raise Shield Cantrip (+1 AC)</label> }] : []),
    ...(defense.parryWeapon && defense.parry > 0 ? [{ name: 'Parry', element: <>
      <input type="checkbox" aria-label="Parry active" checked={!!c.parrying || defense.stanceParry}
        disabled={defense.stanceParry} onChange={event => save({ parrying: event.target.checked })} />{' '}
      <EntryDescription name="Parry" entry={parryTrait(c, entries)} entries={entries} character={c} />{' '}
      <ActiveSpellActions name="Parry" entry={parryTrait(c, entries)} actions="Single Action">
        <label><input type="checkbox" aria-label="Parry active in options" checked={!!c.parrying || defense.stanceParry}
          disabled={defense.stanceParry} onChange={event => save({ parrying: event.target.checked })} /> Parry</label>
        <p>Current bonus: +{defense.parry} circumstance bonus to AC until the start of your next turn.</p>
      </ActiveSpellActions>{' '}(+{defense.parry} AC)
    </> }] : []),
    ...(['enfeebled', 'frightened', 'sickened', 'doomed'] as const).map(name => ({
      name, element: <span>
        <EntryDescription name={name[0].toUpperCase() + name.slice(1)} entry={conditionEntry(name)} entries={entries} character={c} />{' '}
        <input type="number" min="0" step="1" aria-label={`${name[0].toUpperCase() + name.slice(1)} status`}
          value={conditionValue(c, name)} onChange={event => {
            const value = Number(event.target.value)
            if (!Number.isSafeInteger(value) || value < 0) return
            save({ conditions: { ...c.conditions, [name]: value } })
          }} />
      </span>,
    })),
    ...(c.className === 'Barbarian' || activeFeatsNamed(c, 'Barbarian Dedication').length
      ? [{ name: 'Rage', element: <RageToggle c={c} entries={entries} save={save} /> }] : []),
    ...(zealousRank !== undefined ? [{ name: 'Zealous Conviction', element: <>
      <input type="checkbox" aria-label="Zealous Conviction active on self" checked={c.zealousConvictionRank !== undefined}
        onChange={event => save({ zealousConvictionRank: event.target.checked ? zealousRank : undefined })} />{' '}
      <EntryDescription name="Zealous Conviction" entry={zealousEntry} entries={entries} character={c} />{' '}
      {zealousEntry && <ActiveSpellActions name="Zealous Conviction" entry={zealousEntry} rank={zealousRank}
        actions={grant?.source === 'Heroic Presence' ? 'Single Action' : undefined}>
        <ZealousConvictionToggle c={c} save={save} rank={zealousRank} />
      </ActiveSpellActions>}
    </> }] : []),
    ...(activeFeatsNamed(c, 'Favored Terrain').length
      ? [{ name: 'Favored Terrain', element: <><input type="checkbox" aria-label="Favored Terrain status"
        checked={terrainActive} disabled={terrainLocked}
        onChange={event => save(featEffectChange(c, 'Favored Terrain', event.target.checked))} />{' '}
        <EntryDescription name="Favored Terrain" entry={terrainEntry} entries={entries} character={c} hideButtonActions />{' '}
        <FavoredTerrainSelector c={c} save={save} status /></> }] : []),
    ...(knowsSpell(c, entries, 'Protect Companion') || c.activeSpells?.includes('Protect Companion')
      ? [{ name: 'Protect Companion', element: <ProtectCompanionOptions c={c} save={save} entries={entries} showDetails /> }] : []),
    ...(summonedUndead ? [{
      name: 'Summon Undead',
      element: <label><input type="checkbox" aria-label="Summon Undead status" checked
        onChange={event => {
          if (event.target.checked) return
          confirmRemoval(`summoned ${summonedUndead.name}`, () => save({
            summonedUndead: undefined, activeSpells: c.activeSpells?.filter(spell => spell !== 'Summon Undead'),
            ...(c.mountedSummon?.startsWith('undead:') ? { mountedSummon: undefined } : {}),
          }))
        }} /> Summon Undead: {summonedUndead.name}</label>,
    }] : []),
    ...(summonedFiend ? [{
      name: summonSpellName(summonedFiend),
      element: <label><input type="checkbox" aria-label={`${summonSpellName(summonedFiend)} status`} checked
        onChange={event => {
          if (event.target.checked) return
          confirmRemoval(`summoned ${summonedFiend.name}`, () => save({
            summonedFiend: undefined, activeSpells: c.activeSpells?.filter(spell => spell !== summonSpellName(summonedFiend)),
            ...(c.mountedSummon?.startsWith('fiend:') ? { mountedSummon: undefined } : {}),
          }))
        }} /> {summonSpellName(summonedFiend)}: {summonedFiend.name}</label>,
    }] : []),
    ...spellControls,
  ].sort((a, b) => a.name.localeCompare(b.name))
  return <div className="character-section-content">
    <div className="condition-controls" role="group" aria-label="Statuses">
      {controls.map(control => {
        const entry = !['Heroic Defiance', 'Hunt Prey'].includes(control.name) && !spellControls.some(spell => spell.name === control.name) && entries.find(candidate => (candidate.kind === 'feat' || candidate.kind === 'classFeature')
          && !candidate.deleted && candidate.name.toLowerCase() === control.name.toLowerCase()
          && candidate.systems.some(system => c.systems.includes(system))
          && typeof candidate.data.actions === 'string' && /(?:single|one|two|three) action|free action|reaction/i.test(candidate.data.actions))
        return <div className="status-row" key={control.name}>{entry ? <>
          {control.name === 'Harden Flesh' && <><input type="checkbox" aria-label="Harden Flesh status"
            checked={!!c.hardenFleshActive} onChange={event => save({ hardenFleshActive: event.target.checked })} />{' '}</>}
          <EntryDescription name={control.name} entry={entry} entries={entries} character={c} hideButtonActions />{' '}
          <ActiveSpellActions name={control.name} entry={entry}>{control.element}</ActiveSpellActions>
        </> : control.element}</div>
      })}
    </div>
  </div>
}
