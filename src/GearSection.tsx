import { Fragment, useMemo, useState } from 'react'
import {
  propertyRunes, eligibleWeaponRunes, runeBaseName, runeName, canBeOsteoArmament, osteoArmamentRune, activeBattleForm, withoutBattleForm, STRIKING_LABEL, gearPickerEntries, isMagicItem, armorCategory, isRanged, weaponDamage, weaponRuneApplies, maxPropertyRunes, ownedArmors, ownedWeapons, signed, weaponAttack, weaponCategory, isAutomaticUnarmed, isLockedWeapon,
  activeFeatsNamed, alloyedAttackMaterial, animalStrengthSource, animalStrengthRuneSources, armorProficiencyRank, augmentationLimitUsed, augmentationExemption, augmentationLimit, baseItems, canInstallAugmentation, hasAnimalStrength, armorDisplayName, armorEntry, armorGauntlet, automaticHardlightGrade, automaticWeaponFundamentals, isSolarianCrystalWeapon, solarianCoreCrystals, blessedArmamentRune, bulkLimits, canAttachWeapon, canBeLivingWeapon, canBeVerdantWeapon, canBeWeaponInnovation, combinationForms, combinationName, effectiveHandwraps, effectiveWeapon, equippedShield, hardpointWeaponEligible, totalHandCapacity, usesWeaponUpgrades, weaponCanUseTwoHands, weaponEquipped, weaponHeld, weaponHands, ownedShields, shieldChange, hasAutomaticWeaponFundamentals, haftStrikerSource, haftStrikerWeapons, handwrapRuneOptions, isBucklerShield, isFavoredWeapon, isGrantedDwarfClanWeapon, isWoodArmor, livingWeaponEnhancements, livingWeaponRunes, PLAYING_CARD_WEAPONS, proficiencyBonus, RANKS, rogueRackets, SHIELD_RUNES, shieldAcBonus, shieldMaterial, shieldMaterialOptions, shieldParagonActive, shieldRaised, shieldRaisedChange, shieldStats, speedBonuses, testSubjectAdaptation, type SectionProps,
} from './builder'
import { newId } from './db'
import { armorUpgradeEntries, automaticArmorUpgradeUsesSlot, blessedShieldBenefit, canEquipShield, canRaiseShield, championBlessings, clanPistolRunes, equippedHands, forceFieldStats, isEnergyShieldingUpgrade, scaleOfIgroonWeaponRunes, shieldAllowsUpgrades, shieldAttachmentOptions, shieldAttachmentSource, shieldBraceEligible, shieldEquipChange, weaponEntry } from './builder'
import { confirmRemoval } from './confirmRemoval'
import { isAncestralEmbrace, isBastionNamedArmor, isHighhelmPlate, isImmortalBastion, isInheritorPlate, isIncendiaryArmor, isLibraryRobes, isMountainArmor, isScaleOfIgroonShield, scaledNamedArmorDescription, scalingBastionRuneFamilies, SCALE_OF_IGROON_FORTRESS } from './namedArmor'
import { SourceNote } from './Info'
import { EntryDescription } from './EntryDescription'
import { DamageRoll, MultipleDamageRoll } from './SpellDamage'
import { ABILITY_LABEL, APEX_AUGMENTATIONS, MOBILITY_ENHANCER_SPEEDS, activeApexAugmentation, armorBulk, armorStrengthMet, installedApexAugmentations } from './builder'
import { barbarianInstinct, classHandwrapKind, isGiantWeapon } from './builder'
import { equipmentDisplayName, specificMagicItemName } from './equipmentGroups'
import { adoptedAncestryText, selectedFeatEntry } from './featChoices'
import { GearTraits } from './GearTraits'
import { gearAccess } from './gearAccess'
import { ActionIcon } from './ActionIcon'
import { formulaKey, gadgetLimits, grenadeLimits, isGrenade, withBreachingGrenades, isMunitionsAmmunition, isMunitionsConsumable, knownFormulas, munitionsLimits } from './formulas'
import { SearchableSelect } from './SearchableSelect'
import { PickerSort, sortPickerOptions, type PickerSortOrder } from './PickerSort'
import { GearSystemFilter } from './GearSystemFilter'
import { matchesGearSystem, type GearSystem } from './gearSystem'
import { TotalBreakdown } from './TotalBreakdown'
import { BRIAR_MAX_SHARPNESS, briarSharpnessPoints, namedWeaponAbilities, namedWeaponEnhancements, namedWeaponStrikeNote, withNamedWeaponState } from './namedWeapons'
import { installedHardlightUpgrades, isFeatEffectActive, raptorialEdgeImproved } from './builder'
import { getSettings } from './settings'
import { ARMIGER_ARMOR_ID, automaticArmorFundamentals, automaticArmorPropertyRunes, BONY_PLATE_RUNE_FAMILIES, BONY_PLATES_ID, canWearWithAttachedArmor, INVENTOR_ARMOR_ID, INVENTOR_SUITS, isGrantedArmor } from './grantedArmor'
import { ARMOR_GAUNTLETS, CLAN_DAGGER, CLAN_DAGGER_DEXTERITY, FIST, GAUNTLET, HAFT_STRIKER_WEAPON, HANDWRAPS, HARDLIGHT_GRADES, HARDLIGHT_HANDWRAPS, IRON_FIST, OVERSIZED_THROW, SPARK_FIST, UNTAMED_CLAWS } from './supplemental'
import { supportsMeleeWeaponUpgrade } from './builder'
import { ENERGIZED_SPIKES_ENERGIES, ENERGY_SHIELDING_TYPES, type Character, type ContentEntry, type EnergyShieldingType, type EnergizedSpikesEnergy, type HardlightGrade, type OwnedArmor, type OwnedShield, type OwnedWeapon } from './types'
import { EnergyNeutralizer } from './EnergyNeutralizer'
import { TransmutativeCasing } from './TransmutativeCasing'
import { ExploitiveAssault } from './ExploitiveAssault'
import { mechanicClassDC } from './mechanicRules'
import { boostingTheBasics } from './mechanicMods'
import { warmaskSource, warmaskItemBonus } from './warmask'
import { complexSimplicityTraits, hasWeaponRuneCapacity, weaponModificationOptions, weaponModificationSlots, type WeaponModificationSlot } from './inventorWeapon'
import { armorModifications, armorModificationOptions, armorModificationSlots, type ArmorModificationSlot } from './inventorArmor'
import { TURRET_GRADES, turretWeapon } from './mechanicTurret'
import { clearItemGlitching, enduringGrenadeMods, enduringWeaponMods, setEnduringMod } from './mechanicEnduring'
import { ItemTroubleshoot } from './ItemTroubleshoot'
import { namedArmorEnhancements, namedArmorRuneLimit } from './namedArmor'
import { NamedArmorAbilities } from './NamedArmorAbilities'
import { fulminatingShotDamage } from './fulminatingShot'
import { ANCESTRAL_AVATAR } from './battleForms'
import { spellActiveChange } from './builder'
import { shieldEntry } from './builder'
import { intensifiedElementDamage, inventiveOffensiveOptions, ranksAt } from './builder'
import { AUTOMATIC_JETPACK_ID, armorUpgradeSlots, automaticArmorUpgradeSlotsUsed, automaticSpecificArmorUpgrades, jetpackSpeed } from './builder'
import { weaponGradeFamily } from './builder'
import { isDuplicateVeskAttack, tailbladeInheritance } from './builder'
export { armorUpgradeSlots } from './builder'

const POTENCY = [0, 1, 2, 3]
const WEAPON_MATERIALS = ['Orichalcum', 'Peachwood'] as const
const ARMOR_MATERIALS = ['Duskwood', 'Grisantian Hide', 'Orichalcum'] as const
const DERMAL_GRADES: { name: HardlightGrade; level: number; hardness: number }[] = [
  { name: 'Commercial', level: 1, hardness: 5 }, { name: 'Tactical', level: 4, hardness: 10 },
  { name: 'Advanced', level: 7, hardness: 15 }, { name: 'Superior', level: 10, hardness: 20 },
  { name: 'Elite', level: 13, hardness: 25 }, { name: 'Ultimate', level: 16, hardness: 30 },
  { name: 'Paragon', level: 19, hardness: 35 },
]
const damageRuneSummary = (weapon: OwnedWeapon, attack: ReturnType<typeof weaponAttack>, entries: ContentEntry[], formSpecific: boolean) => {
  const damageDice = /^(\d+)d/.exec(attack.damage)?.[1]
  return weapon.runes.filter(rune => (!formSpecific || weaponRuneApplies(entries, weapon, rune))
    && !/^(?:Bloodthirsty|Cunning)$/i.test(runeBaseName(rune))
    && !['Animated', 'Disarming', 'Parrying', 'Throwing', 'Fearsome', 'Fearsome (Greater)', 'Ghost Touch', 'Grappling', 'Grievous', 'Hooked', 'Keen', 'Returning', 'Shifting', 'Shoving', 'Crushing', 'Crushing (Greater)', 'Vorpal', 'Speed', 'Quickstrike', 'Spell Reservoir', 'Bane'].includes(runeName(rune))
    && !/^Impossible(?: Alloy)?$/i.test(runeName(rune))).sort((x, y) => x.localeCompare(y))
    .map(rune => {
      const source = runeName(rune)
      const note = source === 'Serrating' ? 'Only on slashing damage. One action to increase the additional damage to 1d12 on your next slashing hit this turn.'
        : source === 'Anarchic' ? 'Legacy alignment rule: only against lawful targets. A lawful bearer is enfeebled 2. On a critical hit against a lawful target, roll 1d6: 1-2 double minimum damage, 3-4 normal critical damage, 5-6 double maximum damage.'
        : source === 'Axiomatic' ? 'Legacy alignment rule: only against chaotic targets. A chaotic bearer is enfeebled 2. On a critical hit against a chaotic target, use rounded-up average for each weapon damage die instead of rolling.'
        : source === 'Brilliant' || source === 'Brilliant (Greater)'
        ? `Additional 1d4 spirit against fiends and 1d4 vitality against undead. Critical hit: DC ${source === 'Brilliant' ? 29 : 41} Fortitude or blinded for 1 round.${source === 'Brilliant (Greater)' ? ' Damage ignores fire, spirit, and vitality resistance.' : ''}`
        : source === 'Holy' ? 'Holy: 2d4 spirit instead against unholy targets.'
        : source === 'Unholy' ? 'Unholy: 2d4 spirit instead against holy targets.'
          : source === 'Astral (Greater)' ? 'Greater Astral: spirit damage ignores spirit resistance.'
            : source === 'Shock' || source === 'Shock (Greater)' ? `1d10 electricity damage on a critical hit, and it arcs to each creature adjacent to the target.${source === 'Shock (Greater)' ? ' Electricity damage from this weapon ignores electricity resistance.' : ''}`
            : source === 'Flaming' ? '1d10 persistent fire damage on a critical hit.'
              : source === 'Flaming (Greater)' ? '2d10 persistent fire damage on a critical hit; fire damage from this weapon ignores fire resistance.'
                : source === 'Frost' || source === 'Frost (Greater)' ? `Critical hit: DC ${source === 'Frost' ? 24 : 34} Fortitude or slowed 1 until the end of your next turn.${source === 'Frost (Greater)' ? ' Cold damage from this weapon ignores cold resistance.' : ''}`
                : source === 'Ashen' ? 'On hit, target must attempt a DC 25 Will save or be confused for 1 round.'
                  : source === 'Ashen (Greater)' ? 'On hit, target must attempt a DC 35 Will save or be confused for 1 round; critical failure extends confusion to 1 minute.'
                    : source === 'Decaying' || source === 'Decaying (Greater)'
                      ? `Critical hit: ${source === 'Decaying (Greater)' ? '4d4' : '2d4'} persistent void damage, also affecting a raised shield. This void damage can damage objects and constructs.${source === 'Decaying (Greater)' ? ' Void damage ignores void resistance and immunity.' : ''}`
                    : undefined
      const value = source === 'Serrating' ? `1d4 slashing${/\b(?:slashing|s)\b/i.test(attack.damage) ? '' : ' (slashing only)'}`
        : source === 'Anarchic' ? '1d6 chaotic vs. lawful targets'
        : source === 'Axiomatic' ? '1d6 lawful vs. chaotic targets'
        : source === 'Brilliant' || source === 'Brilliant (Greater)' ? '1d4 fire'
        : source === 'Corrosive' || source === 'Corrosive (Greater)' ? '1d6 acid'
          : source === 'Wounding' ? '1d6 persistent bleed'
        : /^(?:Greater )?Impactful(?: \(Greater\))?$/.test(rune) ? '1d6 force'
        : /^Astral(?: \(Greater\))?$/.test(source) ? '1d6 spirit'
          : source === 'Holy' || source === 'Unholy' ? '1d4 spirit'
            : source === 'Flaming' || source === 'Flaming (Greater)' ? '1d6 fire'
              : source === 'Frost' || source === 'Frost (Greater)' ? '1d6 cold'
                : source === 'Shock' || source === 'Shock (Greater)' ? '1d6 electricity'
                : source === 'Thundering' || source === 'Thundering (Greater)' ? '1d6 sonic'
              : source === 'Ashen' ? '1d4 persistent fire'
                : source === 'Ashen (Greater)' ? '1d8 persistent fire'
                  : source === 'Decaying' || source === 'Decaying (Greater)' ? '1d4 void'
                  : source === 'Shockwave' ? damageDice ? `${damageDice} bludgeoning splash` : 'bludgeoning splash equal to weapon damage dice'
                    : rune
      return { source, note, value: value.replace(/\b(bludgeoning|piercing|slashing)\b/gi, type => type[0].toUpperCase()) }
    }).concat(attack.additionalDamage)
}

export const upgradeDamageSummary = (attack: ReturnType<typeof weaponAttack>) => {
  const damage: Record<string, string> = {
    'Acid Module': '1d6 acid',
    'Entropic Destabilizer': '1d4 void',
    'Flaming Module': '1d6 fire',
    'Frost Module': '1d6 cold',
    'Holy Module': '1d4 spirit',
    'Loudener': '1d6 sonic',
    'Radiation Module': '1d6 poison',
    'Shock Module': '1d6 electricity',
  }
  return attack.upgrades.flatMap(upgrade => {
    const base = upgrade.name.replace(/\s*\([^)]*\)$/, '')
    const value = damage[base]
    return value ? [{ source: upgrade.name, value, note: upgrade.description || 'Sync official content for upgrade rules.' }] : []
  })
}

export const mechanicDamageSummary = (c: Character, weapon: OwnedWeapon, attack: ReturnType<typeof weaponAttack>) => {
  if (c.className !== 'Mechanic' || !c.systems.includes('sf2e') || !activeFeatsNamed(c, 'Explosive Shot').length
    || !c.mechanicWeaponMods?.[weapon.id]?.explosiveShot) return []
  const dice = Number(/^(\d+)d/.exec(attack.damage)?.[1])
  const type = attack.damage.match(/[A-Za-z]+$/)?.[0]
  return dice && type ? [{ source: 'Explosive Shot', value: `${dice} ${type} splash`, note: 'Splash damage applies to the target and creatures adjacent to it.' }] : []
}

const mechanicModDuration = (c: Character) => `${activeFeatsNamed(c, 'Steady Modifications').length
  ? 'Mods normally last 1 minute' : 'Mods normally end after your next turn'}${c.level >= 13
  ? '; your daily enduring mod lasts 24 hours' : ''}.`

function WeaponAttackBonuses({ attack, label }: { attack: ReturnType<typeof weaponAttack>; label: string }) {
  return <>
    <span className="weapon-attack-bonuses">
      <TotalBreakdown label={label} breakdown={attack.breakdown} signedTotal />
      {attack.multipleAttackPenalties.slice(1).map((penalty, index) => <Fragment key={index}>/{signed(attack.attack + penalty)}</Fragment>)}
    </span>
    {attack.huntedPreyMultipleAttackPenalties && <SourceNote source="Flurry"
      note={`Against your hunted prey: ${attack.huntedPreyMultipleAttackPenalties.map(penalty => signed(attack.attack + penalty)).join('/')}.`} />}
  </>
}

function AttackUpgrades({ attack }: { attack: ReturnType<typeof weaponAttack> }) {
  if (!attack.upgrades.length) return null
  return <div className="gear-runes">{[...attack.upgrades].sort((a, b) => a.name.localeCompare(b.name)).map(upgrade =>
    <EntryDescription key={upgrade.id} name={upgrade.name} entry={upgrade} />)}</div>
}

const weaponCapacity = (entry?: ContentEntry) => {
  const capacity = entry?.traits.map(trait => /^capacity\s*(?:\(\s*(\d+)\s*\)|(\d+))?$/i.exec(trait.trim()))
    .find(Boolean)
  return Number(capacity?.[1] ?? capacity?.[2]) || 0
}

export function Augmentations({ c, entries, save }: SectionProps) {
  const [apexOnly, setApexOnly] = useState(false)
  if (!c.systems.includes('sf2e')) return null
  const installed = c.augmentations ?? []
  const worn = c.armors?.find(armor => armor.worn)
  const wornEntry = worn && armorEntry(c, entries, worn.name, worn.id)
  const wingsRestricted = !!wornEntry && !['Light', 'Unarmored'].includes(armorCategory(wornEntry) ?? '')
  const dermalGrade = DERMAL_GRADES.find(grade => grade.name === (c.dermalPlating?.grade ?? 'Commercial')) ?? DERMAL_GRADES[0]
  const granted = [
    ...(testSubjectAdaptation(c) === 'Cybernetic Augmentation' ? [{ name: 'Datajack', source: 'Test-Subject Ysoki' }] : []),
    ...(activeFeatsNamed(c, 'Rat Retinal HUD').length ? [{ name: 'Autorecognition Lens', source: 'Rat Retinal HUD' }] : []),
    ...(activeFeatsNamed(c, 'Thresher Ko-1 Frame').length ? [{ name: `Dermal Plating (${dermalGrade.name})`, source: 'Thresher Ko-1 Frame' }] : []),
    ...(activeFeatsNamed(c, 'Hardpoint').length ? [{ name: 'Hideaway Limb (Tactical)', source: 'Hardpoint' }] : []),
  ]
  const displayed = [
    ...granted.map(item => ({ kind: 'granted' as const, item })),
    ...installed.map(item => ({ kind: 'installed' as const, item })),
  ].sort((a, b) => a.item.name.localeCompare(b.item.name))
  const limit = augmentationLimit(c)
  const standardUsed = augmentationLimitUsed(c)
  const biotechUpgrade = activeFeatsNamed(c, 'Biotech Os Upgrade').length > 0
  const secondaryPower = activeFeatsNamed(c, 'Secondary Power Source').length > 0
  const powerIds = new Set([...installed.map(item => item.id),
    ...granted.map(item => `granted:${item.source}:${item.name}`)])
  const selectedPower = [...new Set(c.secondaryPowerSourceIds ?? [])].filter(id => powerIds.has(id))
  const options = entries.filter(entry => entry.kind === 'item' && !entry.deleted && entry.systems.includes('sf2e')
    && String(entry.data.item_category).toLowerCase() === 'augmentations')
    .sort((a, b) => a.name.localeCompare(b.name) || a.level - b.level)
  const apexInstalled = installedApexAugmentations(c)
  const apexActive = activeApexAugmentation(c)
  const isApex = (entry: ContentEntry) => !!APEX_AUGMENTATIONS[entry.name] || entry.traits.some(trait => trait.toLowerCase() === 'apex')
  const installable = options.filter(entry => canInstallAugmentation(c, entry, 'standard'))
  const shownOptions = apexOnly ? installable.filter(isApex) : installable
  const hardpoint = activeFeatsNamed(c, 'Hardpoint').length > 0
  const hardpointWeapons = (c.weapons ?? []).filter(weapon => hardpointWeaponEligible(c, entries, weapon))
  const powerControl = (id: string, name: string) => {
    if (!secondaryPower) return null
    const checked = selectedPower.includes(id)
    const uses = Math.max(0, Math.min(2, c.secondaryPowerUses?.[id] ?? 0))
    return <span>{' '}<label><input type="checkbox" aria-label={`Secondary Power Source: ${name}`}
      checked={checked} disabled={!checked && selectedPower.length >= 2}
      onChange={event => {
        if (event.target.checked && !checked && selectedPower.length >= 2) return
        save({ secondaryPowerSourceIds: event.target.checked
          ? [...new Set([...selectedPower, id])] : selectedPower.filter(existing => existing !== id) })
      }} /> Once-per-day activation: extra use</label>
      {checked && <label> Used{' '}<select aria-label={`${name} uses`} value={uses} onChange={event => {
        const value = Number(event.target.value)
        if (Number.isInteger(value) && value >= 0 && value <= 2)
          save({ secondaryPowerUses: { ...c.secondaryPowerUses, [id]: value } })
      }}><option value={0}>0/2</option><option value={1}>1/2</option><option value={2}>2/2</option></select></label>}
    </span>
  }
  return <section className="col" aria-label="Augmentations">
    <h4>Augmentations <small aria-label="Augmentation capacity">{standardUsed}/{limit}</small></h4>
    {standardUsed > limit && <small role="status">Installed augmentations exceed your current implant limit.</small>}
    <ul>{displayed.map(({ kind, item }) => {
      if (kind === 'granted') return <li key={`granted:${item.source}:${item.name}`}><EntryDescription name={item.name}
        entry={entries.find(entry => entry.kind === 'item' && entry.name.toLowerCase() === item.name.toLowerCase() && entry.systems.includes('sf2e'))}
        entries={entries} /> <small>({item.source})</small>{biotechUpgrade && <SourceNote inlineSource={false}
          source="Biotech OS Upgrade" note="This cybernetic augmentation has the biotech trait instead of the tech trait." />}
        {powerControl(`granted:${item.source}:${item.name}`, item.name)}</li>
      const entry = entries.find(candidate => candidate.id === item.entryId)
      return <li key={item.id}><div className="rune"><EntryDescription name={item.name} entry={entry} entries={entries} />
        <button type="button" aria-label={`Remove ${item.name} augmentation`} onClick={() => confirmRemoval(`augmentation "${item.name}"`,
          () => save({ augmentations: installed.filter(existing => existing.id !== item.id),
            secondaryPowerSourceIds: selectedPower.filter(id => id !== item.id) }))}>×</button></div>
        {biotechUpgrade && String(entry?.data.item_subcategory ?? '').toLowerCase() === 'cybernetics' && <SourceNote inlineSource={false}
          source="Biotech OS Upgrade" note="This cybernetic augmentation has the biotech trait instead of the tech trait." />}
        {item.slot !== 'standard' && <>{' '}<small>({item.slot === 'apex' ? 'apex' : 'item exemption'})</small></>}
        {/^Ultralight Wings\b/i.test(item.name) && <label>{' '}<input type="checkbox" aria-label={`Deploy ${item.name}`}
          checked={!!item.deployed} disabled={wingsRestricted && !item.deployed}
          onChange={event => save({ augmentations: installed.map(existing => existing.id === item.id
            ? { ...existing, deployed: event.target.checked } : existing) })} /> Deployed</label>}
        {/^Mobility Enhancer\b/.test(item.name) && <label>{' '}Speed{' '}<select aria-label={`${item.name} speed`} value={item.speed ?? ''}
          onChange={event => save({ augmentations: installed.map(existing => existing.id === item.id
            ? { ...existing, speed: MOBILITY_ENHANCER_SPEEDS.find(mode => mode === event.target.value) } : existing) })}>
          <option value="">Automatic</option>
          {MOBILITY_ENHANCER_SPEEDS.map(mode => <option key={mode}>{mode}</option>)}
        </select></label>}
        {powerControl(item.id, item.name)}</li>
    })}</ul>
    {!!activeFeatsNamed(c, 'Thresher Ko-1 Frame').length && <>
      <label>Dermal plating grade{' '}<select aria-label="Dermal plating grade" value={dermalGrade.name} onChange={event => {
        const grade = DERMAL_GRADES.find(option => option.name === event.target.value && option.level <= c.level)
        if (grade) save({ dermalPlating: { ...c.dermalPlating, grade: grade.name } })
      }}>
        {DERMAL_GRADES.map(grade => <option key={grade.name} value={grade.name} disabled={grade.level > c.level}>
          {grade.name} (Hardness {grade.hardness})
        </option>)}
      </select><SourceNote inlineSource={false} source="Thresher Ko-1 Frame"
        note="Commercial plating is free. Upgrades require paying the difference in price." /></label>
      <label><input type="checkbox" checked={!!c.dermalPlating?.damaged} onChange={event => save({
        dermalPlating: { ...c.dermalPlating, damaged: event.target.checked, ...(event.target.checked ? { raised: false } : {}) },
      })} /> Dermal plating damaged <SourceNote inlineSource={false} source="Dermal plating"
        note="After Shield Block, plating cannot be used for 24 hours while it repairs." /></label>
    </>}
    {secondaryPower && <SourceNote source="Secondary Power Source"
      note="During daily preparations, select up to two installed augmentations with once-per-day activation. Each selected activation can be used twice per day. Verify the item's frequency before selecting it." />}
    {secondaryPower && <button type="button" disabled={!selectedPower.length && !Object.values(c.secondaryPowerUses ?? {}).some(Boolean)}
      onClick={() => save({ secondaryPowerSourceIds: [], secondaryPowerUses: {} })}>Daily preparations</button>}
    {hardpoint && <label>Hardpoint weapon{' '}
      <select aria-label="Hardpoint weapon" value={c.hardpointWeaponId ?? ''} onChange={event => {
        const id = event.target.value
        if (!id || hardpointWeapons.some(weapon => weapon.id === id)) save({
          hardpointWeaponId: id || undefined,
          ...(id && c.weapons?.some(weapon => weapon.id === id && weapon.cheekStored)
            ? { weapons: c.weapons.map(weapon => weapon.id === id ? { ...weapon, cheekStored: false, cheekHolstered: false, stowed: true } : weapon) } : {}),
        })
      }}>
        <option value="">None</option>
        {c.hardpointWeaponId && !hardpointWeapons.some(weapon => weapon.id === c.hardpointWeaponId)
          && <option value={c.hardpointWeaponId} disabled>Unavailable weapon</option>}
        {hardpointWeapons.map(weapon => <option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}
      </select>
      <SourceNote inlineSource={false} source="Hardpoint" note="Only one-handed weapons of light Bulk or less fit (1 Bulk or less with Thresher Ko-1 Frame). While drawn, the weapon is integrated and cannot be disarmed, dropped, or stolen." />
    </label>}
    {apexInstalled.length > 1 && <label>Apex attribute increase{' '}<select aria-label="Apex attribute increase" value={apexActive?.id ?? 'none'}
      onChange={event => save({ apexAugmentationId: event.target.value })}>
      {apexInstalled.map(item => <option key={item.id} value={item.id}>{item.name} ({ABILITY_LABEL[APEX_AUGMENTATIONS[item.name].ability]})</option>)}
      <option value="none">None</option>
    </select></label>}
    {installable.length > 0 && <SearchableSelect label="Augmentation" aria-label="Choose augmentation" value="" primaryDetails
      optionLevel={value => shownOptions.find(entry => entry.id === value)?.level}
      renderDetails={value => {
        const entry = shownOptions.find(option => option.id === value)
        return entry && <span className="picker-spell-name"><EntryDescription name={entry.name} entry={entry} entries={entries}
          character={c} buttonSuffix={` (level ${entry.level})`} deferDetails /></span>
      }}
      filters={installable.some(isApex) && <label><input type="checkbox" checked={apexOnly} onChange={event => setApexOnly(event.target.checked)} /> Apex only</label>} onChange={event => {
      const chosen = installable.find(entry => entry.id === event.target.value)
      if (!chosen) return
      save({ augmentations: [...installed, { id: newId(), entryId: chosen.id, name: chosen.name, slot: augmentationExemption(chosen) ?? 'standard' }] })
    }}>
      <option value="">Add augmentation...</option>
      {shownOptions.map(entry => <option value={entry.id} key={entry.id}>{entry.name} (level {entry.level})</option>)}
    </SearchableSelect>}
  </section>
}

export function BulkLimits({ c, entries }: Pick<SectionProps, 'c' | 'entries'>) {
  const limits = bulkLimits(c, entries)
  return <div aria-label="Bulk limits">
    <p>Encumbered above <b>{limits.encumbered}</b> Bulk; maximum <b>{limits.maximum}</b> Bulk.
      <SourceNote source="Bulk limits" note={`Strength ${signed(limits.strength)}; size ${limits.size}${
        limits.sizeMultiplier !== 1 ? ` (limits ×${limits.sizeMultiplier})` : ''}${
        limits.bonuses.map(bonus => `; ${bonus.source} ${bonus.encumbered === bonus.maximum
          ? signed(bonus.encumbered) : `(encumbered ${signed(bonus.encumbered)}, maximum ${signed(bonus.maximum)})`}`).join('')
      }. Worn-item bonuses and temporary size changes are not tracked.`} /></p>
  </div>
}

type Filter = { label: string; values: (e: ContentEntry) => string[]; fixed?: string[] }

const text = (v: unknown) => (v === undefined || v === '' ? [] : [String(v)])
const damageTypes = (e: ContentEntry) => {
  const types = `${e.data.damage ?? ''} ${e.data.damage_type ?? ''}`.toLowerCase()
  return [...new Set([...types.matchAll(/\b(bludgeoning|piercing|slashing|acid|cold|electricity|fire|force|mental|poison|spirit|vitality|void|b|p|s)\b/g)]
    .map(match => ({ b: 'bludgeoning', p: 'piercing', s: 'slashing' }[match[1]] ?? match[1])))]
}
const CATEGORY = /^(light|medium|heavy)( armor)?$/i
const FILTERS: Record<'weapon' | 'armor' | 'shield', Filter[]> = {
  weapon: [
    { label: 'Proficiencies', values: (e) => [weaponCategory(e)], fixed: ['Advanced', 'Martial', 'Simple', 'Unarmed'] },
    { label: 'Rarities', values: (e) => text(e.data.rarity) },
    { label: 'Types', values: (e) => [isRanged(e) ? 'Ranged' : 'Melee'] },
    { label: 'Groups', values: (e) => text(e.data.weapon_group) },
    { label: 'Hands', values: (e) => text(e.data.hands) },
    { label: 'Dice', values: (e) => text(/\d+(d\d+)/.exec(String(e.data.damage ?? ''))?.[1]) },
    { label: 'Damage types', values: damageTypes },
    { label: 'Traits', values: (e) => e.traits },
  ],
  armor: [
    { label: 'Categories', values: (e) => [armorCategory(e)], fixed: ['Heavy', 'Light', 'Medium', 'Unarmored'] },
    { label: 'Rarities', values: (e) => text(e.data.rarity) },
    { label: 'Groups', values: (e) => text(e.data.armor_group) },
    { label: 'Traits', values: (e) => e.traits.filter((t) => !CATEGORY.test(t)) },
  ],
  shield: [
    { label: 'Rarities', values: (e) => text(e.data.rarity) },
    { label: 'Traits', values: (e) => e.traits },
  ],
}
const TABS = ['Standard', 'Specific', 'All'] as const
const GEAR_SEARCH_PAGE = 100
export const isSpecificGear = (e: ContentEntry) => isMagicItem(e)
  || e.source === 'homebrew' && (e.traits.some(trait => /^magical$/i.test(trait))
    || /specific|magic/i.test(String(e.data.item_subcategory ?? '')))
  || e.kind === 'armor' && e.systems.includes('sf2e') && e.level >= 5
const inTab = (e: ContentEntry, tab: (typeof TABS)[number]) =>
  tab === 'All' || (tab === 'Specific' ? isSpecificGear(e) : !isSpecificGear(e))

function GearAccess({ c, entries, entry, save }: SectionProps & { entry: ContentEntry }) {
  const access = gearAccess(c, entries, entry)
  if (!access || access.automatic || access.approved) return null
  return <div className="col gear-access">
    {!access.approved && <small>Access: {access.requirement} (not met)</small>}
    <label><input type="checkbox" aria-label={`GM approved access to ${entry.name}`} checked={access.approved}
      onChange={event => save({ gearAccessOverrides: event.target.checked
        ? [...new Set([...(c.gearAccessOverrides ?? []), entry.id])]
        : c.gearAccessOverrides?.filter(id => id !== entry.id) })} /> Approve access</label>
  </div>
}

export function Search({ c, entries, save, kind, label, onPick }: SectionProps & {
  entries: ContentEntry[]
  kind: 'weapon' | 'armor' | 'shield'
  label: string
  onPick: (e: ContentEntry) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<(typeof TABS)[number]>('Standard')
  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const [limit, setLimit] = useState(GEAR_SEARCH_PAGE)
  const [sort, setSort] = useState<PickerSortOrder>('name')
  const [system, setSystem] = useState<GearSystem>('both')
  const pickerEntries = useMemo(() => !open ? entries : entries.filter(entry =>
    matchesGearSystem(entry, 'both', c.systems)
    && (kind !== 'weapon' || entry.kind !== 'weapon' || !isLockedWeapon(c, entry.name, entries))), [c, entries, kind, open])
  const pool = useMemo(() => open ? gearPickerEntries(pickerEntries, kind).map(entry => {
    const displayName = equipmentDisplayName(specificMagicItemName(entry))
    return {
      entry,
      displayName,
      searchText: `${entry.name.replace(/[\u2018\u2019]/g, "'")} ${displayName}`.toLowerCase(),
      filterValues: FILTERS[kind].map(filter => filter.values(entry)),
    }
  }).sort((a, b) => a.displayName.localeCompare(b.displayName)) : [], [kind, open, pickerEntries])
  const tabPool = useMemo(() => pool.filter(({ entry }) => inTab(entry, tab)), [pool, tab])
  const filters = useMemo(() => FILTERS[kind].map((filter, index) => ({
    ...filter,
    options: filter.fixed ?? [...new Set(tabPool.flatMap(({ filterValues }) => filterValues[index]))].sort((a, b) => a.localeCompare(b)),
  })), [kind, tabPool])
  const query = q.trim().replace(/[\u2018\u2019]/g, "'").toLowerCase()
  const matches = useMemo(() => {
    const unique = new Map<string, ContentEntry>()
    const activeFilters = FILTERS[kind].flatMap((filter, index) => {
      const values = picked[filter.label] ?? []
      return values.length ? [{ index, values }] : []
    })
    for (const { entry, searchText, filterValues } of tabPool) {
      if (query && !searchText.includes(query)) continue
      if (!matchesGearSystem(entry, system, c.systems)) continue
      if (activeFilters.some(({ index, values }) => !values.every(value => filterValues[index].includes(value)))) continue
      const key = kind === 'weapon' ? combinationName(entries, entry.name) : entry.name
      if (!unique.has(key)) unique.set(key, entry)
    }
    return sortPickerOptions([...unique.values()], sort,
      entry => equipmentDisplayName(specificMagicItemName(entry)), entry => entry.level)
  }, [entries, kind, picked, query, tabPool, sort, system, c.systems])
  if (!open) return <button type="button" className="gear-add" onClick={() => setOpen(true)}>{label}</button>
  const close = () => { setOpen(false); setQ(''); setPicked({}); setSystem('both'); setLimit(GEAR_SEARCH_PAGE) }
  return (
    <div className="col gear-picker">
      <div className="gear-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''}
            onClick={() => { setTab(t); setLimit(GEAR_SEARCH_PAGE) }}>{t}</button>
        ))}
      </div>
      <div className="gear-filters">
        <GearSystemFilter value={system} onChange={value => { setSystem(value); setLimit(GEAR_SEARCH_PAGE) }} />
        {filters.filter((f) => f.options.length > 0).map((f) => (
          kind === 'weapon' && f.label === 'Traits'
            ? <label key={f.label}>Traits{' '}
              <select aria-label="Traits" multiple size={Math.min(5, f.options.length)} value={picked[f.label] ?? []}
                onChange={event => {
                  setPicked({ ...picked, [f.label]: Array.from(event.currentTarget.selectedOptions, option => option.value) })
                  setLimit(GEAR_SEARCH_PAGE)
                }}>
                {f.options.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            : <SearchableSelect key={f.label} aria-label={f.label} value={picked[f.label]?.[0] ?? ''}
              onChange={event => { setPicked({ ...picked, [f.label]: event.target.value ? [event.target.value] : [] }); setLimit(GEAR_SEARCH_PAGE) }}>
              <option value="">All {f.label}</option>
              {f.options.map(option => <option key={option}>{option}</option>)}
            </SearchableSelect>
        ))}
      </div>
      <div className="row">
        <input type="search" aria-label={`Search ${kind}s`} autoFocus placeholder={`Search ${kind}s`} value={q}
          onChange={(e) => { setQ(e.target.value); setLimit(GEAR_SEARCH_PAGE) }} />
        <PickerSort label={`Sort ${kind}s by`} value={sort} onChange={value => { setSort(value); setLimit(GEAR_SEARCH_PAGE) }} />
        <button type="button" onClick={close}>Cancel</button>
      </div>
      <ul className="gear-results">
        {matches.slice(0, limit).map((m) => {
          const access = gearAccess(c, entries, m)
          const blocked = !!access && !access.automatic && !access.approved
          return (
          <li key={m.id}>
            <span><b><EntryDescription name={specificMagicItemName(m, kind === 'weapon' ? combinationName(entries, m.name) : m.name)} entry={m}
              className="equipment-name" /></b>{weaponDamage(m) ? ` (${weaponDamage(m)})` : ''}{m.level ? ` (level ${m.level})` : ''}
              {' '}<small>{m.systems.map(system => system === 'sf2e' ? 'SF2E' : 'PF2E').join(' / ')}</small>
            </span>
            <GearAccess c={c} entries={entries} entry={m} save={save} />
            <button type="button" disabled={blocked} title={blocked ? 'Meet Access or obtain GM approval before adding.' : undefined}
              onClick={() => { if (!blocked) { onPick(m); close() } }}>Add</button>
          </li>
          )
        })}
        {matches.length > limit && <li><button type="button" onClick={() => setLimit(value => value + GEAR_SEARCH_PAGE)}>
          Show more ({matches.length - limit} left)
        </button></li>}
        {matches.length === 0 && <li><small>No {kind}s match.</small></li>}
      </ul>
    </div>
  )
}

function GearTag({ name, entry, onRemove, source = 'Granted by Living Weapon', kind = 'rune' }: {
  name: string; entry?: ContentEntry; onRemove?: () => void; source?: string; kind?: 'rune' | 'material' | 'upgrade'
}) {
  return (
    <div className="rune" title={onRemove ? undefined : source}>
      <EntryDescription name={name} entry={entry} />
      {onRemove && <button type="button" aria-label={`Remove ${name} ${kind}`} onClick={() => confirmRemoval(`"${name}" ${kind}`, onRemove)}>×</button>}
    </div>
  )
}

export function WeaponUpgrades({ entries, weapon, upgrades, limit, onChange, effectiveUpgrades, raptorialEdgeUpgrade, crystals }: {
  entries: ContentEntry[]; weapon: ContentEntry; upgrades: string[]; limit: number | undefined; onChange: (ids: string[]) => void
  effectiveUpgrades?: ContentEntry[]; crystals?: boolean
  raptorialEdgeUpgrade?: { checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }
}) {
  const subcategory = crystals ? 'Orbital Crystal' : 'Weapon Upgrades'
  const catalog = entries.filter(entry => entry.kind === 'item' && !entry.deleted && entry.systems.includes('sf2e')
    && entry.data.item_subcategory === subcategory
    && !(crystals && !/\)$/.test(entry.name) && entries.some(other => other.name.startsWith(`${entry.name} (`) && other.data.item_subcategory === subcategory)))
  const installed = upgrades.map(id => catalog.find(entry => entry.id === id))
  const sameUpgrade = (a: ContentEntry, b: ContentEntry) => a.id === b.id || !!a.data.url && a.data.url === b.data.url
    || a.name.replace(/\s*\([^)]*\)$/, '') === b.name.replace(/\s*\([^)]*\)$/, '')
  const granted = effectiveUpgrades?.filter(item => !installed.some(saved => saved && sameUpgrade(item, saved))) ?? []
  const displayed: Array<{ key: string; name: string; entry?: ContentEntry; index?: number; raptorialEdge?: boolean }> = [
    ...upgrades.map((id, index) => {
      const saved = installed[index]
      const entry = effectiveUpgrades?.find(item => saved && sameUpgrade(item, saved)) ?? saved
      return { key: `${id}:${index}`, name: entry?.name ?? id, entry, index }
    }),
    ...granted.map(entry => ({ key: `granted:${entry.id}`, name: entry.name, entry, index: undefined })),
    ...(raptorialEdgeUpgrade ? [{ key: 'improved-raptorial-edge', name: 'Raptorial Edge (Upgraded)', raptorialEdge: true }] : []),
  ].sort((a, b) => a.name.localeCompare(b.name))
  const usage = (entry: ContentEntry) => String(entry.data.usage ?? '').toLowerCase().replace(/\s+/g, ' ')
  const traits = weapon.traits.map(trait => trait.toLowerCase())
  const options = catalog.filter(entry => {
    const text = usage(entry)
    if (installed.some(item => item && sameUpgrade(item, entry)) || granted.some(item => sameUpgrade(item, entry))) return false
    const part = /\((sight|grip)\)/.exec(text)?.[1]
    if (part && installed.some(item => item && usage(item).includes(`(${part})`))) return false
    if (/without a silencer/.test(text) && installed.some(item => item?.name.toLowerCase().startsWith('silencer'))) return false
    if (/without a loudener/.test(text) && installed.some(item => item?.name.toLowerCase().startsWith('loudener'))) return false
    if (/\branged\b/.test(text) && !isRanged(weapon)) return false
    if (['homebrew:grappling-module', 'homebrew:shoving-module'].includes(entry.id) && !supportsMeleeWeaponUpgrade(weapon)) return false
    if (/\bthrown\b/.test(text) && !traits.some(trait => trait.startsWith('thrown'))) return false
    if (/\barea weapon\b/.test(text) && !traits.some(trait => trait.startsWith('area'))) return false
    if (/kickback trait/.test(text) && !traits.some(trait => trait.startsWith('kickback'))) return false
    if (/one-handed/.test(text) && Number(weapon.data.hands) !== 1) return false
    if (/two-handed/.test(text) && !/grenade launcher or/.test(text) && Number(weapon.data.hands) !== 2) return false
    const damage = `${weapon.data.damage ?? ''} ${weapon.data.damage_type ?? ''}`.toLowerCase()
    if (/deals cold damage/.test(text) && !/\b(cold|c)\b/.test(damage)) return false
    if (/deals acid or fire damage/.test(text) && !/\b(acid|fire|a|f)\b/.test(damage)) return false
    if (/deals acid, cold, fire, or void damage/.test(text) && !/\b(acid|cold|fire|void|a|c|f|v)\b/.test(damage)) return false
    const ammo = String(weapon.data.weapon_ammunition ?? '').toLowerCase()
    if (/uses a battery/.test(text) && !/batter|charge/.test(ammo)) return false
    if (/uses projectiles/.test(text) && (!ammo || /batter|charge/.test(ammo))) return false
    if (/grenade launcher or/.test(text) && !/grenade launcher/i.test(weapon.name)) return false
    return true
  }).sort((a, b) => a.name.localeCompare(b.name) || a.level - b.level)
  return <div className="gear-runes">
    {displayed.map(({ key, name, entry, index, raptorialEdge }) => raptorialEdge && raptorialEdgeUpgrade
      ? <span className="rune" key={key}><label><input type="checkbox" aria-label="Improved Raptorial Edge upgrade"
        checked={raptorialEdgeUpgrade.checked} disabled={raptorialEdgeUpgrade.disabled}
        onChange={event => raptorialEdgeUpgrade.onChange(event.target.checked)} /></label>
        <GearTag name={name} kind="upgrade" source="Automatic weapon upgrade" /></span>
      : <GearTag key={key} name={name} entry={entry}
        kind="upgrade" source="Automatic weapon upgrade"
        onRemove={index === undefined ? undefined : () => onChange(upgrades.filter((_, i) => i !== index))} />)}
    {installed.some(item => !item) && <small role="status">Saved upgrade unavailable. Sync official content to restore its effects.</small>}
    {limit === undefined && <small role="status">Weapon upgrade slots unavailable. Sync official content.</small>}
    {limit !== undefined && upgrades.length + granted.length > limit && <small role="status">Installed upgrades exceed available slots.</small>}
    {limit !== undefined && upgrades.length + granted.length < limit && options.length > 0 && <SearchableSelect aria-label={crystals ? 'Add orbital crystal' : 'Add weapon upgrade'} value=""
      optionLevel={value => options.find(entry => entry.id === value)?.level} onChange={event => {
      if (options.some(entry => entry.id === event.target.value)) onChange([...upgrades, event.target.value])
    }}>
      <option value="">{crystals ? 'Add orbital crystal...' : 'Add weapon upgrade...'}</option>
      {options.map(entry => <option key={entry.id} value={entry.id}>{entry.name} (Level {entry.level})</option>)}
    </SearchableSelect>}
  </div>
}

export function ArmorUpgrades({ entries, upgrades, limit, worn, activeJetpack, energyShieldingTypes, energizedSpikesEnergy,
  onToggleJetpack, onEnergyShieldingTypeChange, onEnergizedSpikesEnergyChange, onChange,
  automaticUpgrades = [], armorName = 'armor' }: {
  entries: ContentEntry[]; upgrades: string[]; limit: number; worn: boolean; activeJetpack?: string
  energyShieldingTypes?: OwnedArmor['energyShieldingTypes']
  energizedSpikesEnergy?: EnergizedSpikesEnergy
  onToggleJetpack: (id: string) => void; onChange: (ids: string[]) => void
  onEnergyShieldingTypeChange: (id: string, type: EnergyShieldingType | undefined) => void
  onEnergizedSpikesEnergyChange?: (energy: EnergizedSpikesEnergy | undefined) => void
  automaticUpgrades?: ContentEntry[]; armorName?: string
}) {
  const catalog = entries.filter(entry => entry.kind === 'item' && !entry.deleted && entry.systems.includes('sf2e')
    && entry.data.item_subcategory === 'Armor Upgrades')
  const installed = upgrades.map(id => catalog.find(entry => entry.id === id))
  const sameUpgrade = (a: ContentEntry, b: ContentEntry) =>
    a.name.replace(/\s*\([^)]*\)$/, '') === b.name.replace(/\s*\([^)]*\)$/, '')
  const automaticFor = (entry?: ContentEntry) => automaticUpgrades.find(automatic => !!entry
    && !isEnergyShieldingUpgrade(automatic) && sameUpgrade(automatic, entry))
  const automaticName = (entry: ContentEntry) => {
    const type = ENERGY_SHIELDING_TYPES.find(candidate => candidate === entry.data.automatic_energy_type)
    return type ? `${entry.name} (${type[0].toUpperCase()}${type.slice(1)})` : entry.name
  }
  const energizedSpikesControl = (entry?: ContentEntry) => {
    if (!entry || entry.name.replace(/\s*\([^)]*\)$/, '') !== 'Energized Spikes') return null
    const dice = entry.name.includes('(Advanced)') ? 8 : entry.name.includes('(Tactical)') ? 5 : 2
    return <>
      <label>Charged by{' '}
        <select aria-label="Energized Spikes charged energy" value={energizedSpikesEnergy ?? ''}
          onChange={event => {
            const energy = ENERGIZED_SPIKES_ENERGIES.find(candidate => candidate === event.target.value)
            onEnergizedSpikesEnergyChange?.(energy)
          }}>
          <option value="">Uncharged (piercing)</option>
          {ENERGIZED_SPIKES_ENERGIES.map(energy =>
            <option key={energy} value={energy}>{energy[0].toUpperCase()}{energy.slice(1)}</option>)}
        </select>
      </label>
      <DamageRoll name="Energized Spikes" damage={{ label: 'Damage', dice, sides: 4,
        type: energizedSpikesEnergy ?? 'piercing' }} toggleResult preserveDamage
        onRoll={() => onEnergizedSpikesEnergyChange?.(undefined)} />
    </>
  }
  const options = catalog.filter(entry => !installed.some(item => item?.id === entry.id)
    && !automaticUpgrades.some(automatic => sameUpgrade(automatic, entry)
      && !(isEnergyShieldingUpgrade(automatic) && isEnergyShieldingUpgrade(entry))))
    .sort((a, b) => a.name.localeCompare(b.name) || a.level - b.level)
  const automaticOnly = automaticUpgrades.filter(automatic => isEnergyShieldingUpgrade(automatic)
    || !installed.some(item => item && sameUpgrade(automatic, item)))
  const displayUpgrades = [
    ...upgrades.map((id, index) => {
      const entry = installed[index]
      const automatic = automaticFor(entry)
      return { kind: 'installed' as const, id, index, entry, automatic,
        name: automatic ? automaticName(automatic) : entry?.name ?? id }
    }),
    ...automaticOnly.map(entry => ({ kind: 'automatic' as const, entry, name: automaticName(entry) })),
  ].sort((a, b) => a.name.localeCompare(b.name))
  const usedEnergyTypes = new Set<EnergyShieldingType>()
  automaticUpgrades.forEach(entry => {
    const type = ENERGY_SHIELDING_TYPES.find(candidate => candidate === entry.data.automatic_energy_type)
    if (isEnergyShieldingUpgrade(entry) && type) usedEnergyTypes.add(type)
  })
  upgrades.forEach((id, index) => {
    const type = energyShieldingTypes?.[id]
    if (installed[index] && isEnergyShieldingUpgrade(installed[index]) && type) usedEnergyTypes.add(type)
  })
  return <div className="gear-runes">
    {displayUpgrades.map(item => {
      if (item.kind === 'automatic') return <span className="rune" key={`automatic:${item.entry.id}`}>
        <GearTag name={`${automaticName(item.entry)}${automaticArmorUpgradeUsesSlot(armorName, item.entry) ? '' : ' *'}`}
          entry={item.entry} kind="upgrade" source={`Built into ${armorName}`} />
        {jetpackSpeed(item.entry) > 0 && <button type="button" className={`spell-action-button${activeJetpack === AUTOMATIC_JETPACK_ID && worn ? ' on' : ''}`}
          aria-label={`${activeJetpack === AUTOMATIC_JETPACK_ID && worn ? 'Dismiss' : 'Activate'} ${item.entry.name}`}
          aria-pressed={activeJetpack === AUTOMATIC_JETPACK_ID && worn} disabled={!worn}
          title={`${activeJetpack === AUTOMATIC_JETPACK_ID && worn ? 'Dismiss' : 'Activate'} jetpack (1 minute; cannot lift while encumbered${jetpackSpeed(item.entry) === 20 ? '; off-guard while hovering' : ''})`}
          onClick={() => onToggleJetpack(AUTOMATIC_JETPACK_ID)}><ActionIcon actions="Single Action" /></button>}
        {energizedSpikesControl(item.entry)}
      </span>
      const { id, index, entry, automatic } = item
      return <span className="rune" key={`${id}:${index}`}>
        <GearTag name={item.name} entry={automatic ?? entry} kind="upgrade"
          onRemove={() => onChange(upgrades.filter((_, i) => i !== index))} />
      {entry && isEnergyShieldingUpgrade(entry) && <label>Damage type{' '}
        <select aria-label={`Energy Shielding type ${entry.name}`} value={energyShieldingTypes?.[id] ?? ''}
          onChange={event => {
            const type = ENERGY_SHIELDING_TYPES.find(candidate => candidate === event.target.value)
            onEnergyShieldingTypeChange(id, type)
          }}>
          <option value="">Choose type...</option>
          {ENERGY_SHIELDING_TYPES.map(type => <option key={type} value={type}
            disabled={type !== energyShieldingTypes?.[id] && usedEnergyTypes.has(type)}>
            {type[0].toUpperCase()}{type.slice(1)}
          </option>)}
        </select>
      </label>}
      {energizedSpikesControl(automatic ?? entry)}
      {jetpackSpeed(automatic ?? entry) > 0 && <button type="button" className={`spell-action-button${activeJetpack === id && worn ? ' on' : ''}`}
        aria-label={`${activeJetpack === id && worn ? 'Dismiss' : 'Activate'} ${automatic?.name ?? entry?.name}`}
        aria-pressed={activeJetpack === id && worn} disabled={!worn || index >= limit}
        title={`${activeJetpack === id && worn ? 'Dismiss' : 'Activate'} jetpack (1 minute; cannot lift while encumbered${jetpackSpeed(automatic ?? entry) === 20 ? '; off-guard while hovering' : ''})`}
        onClick={() => onToggleJetpack(id)}><ActionIcon actions="Single Action" /></button>}
    </span>
    })}
    {installed.some(item => !item) && <small role="status">Saved armor upgrade unavailable. Sync official content to restore its effects.</small>}
    {upgrades.length > limit && <small role="status">Installed upgrades exceed available slots.</small>}
    {upgrades.length < limit && options.length > 0 && <SearchableSelect aria-label="Add armor upgrade" value=""
      optionLevel={value => options.find(entry => entry.id === value)?.level} onChange={event => {
      if (options.some(entry => entry.id === event.target.value)) onChange([...upgrades, event.target.value])
    }}>
      <option value="">Add armor upgrade...</option>
      {options.map(entry => <option key={entry.id} value={entry.id}>{entry.name} (Level {entry.level})</option>)}
    </SearchableSelect>}
  </div>
}

function Material({ name, entries, equipment, onRemove, source }: {
  name: string; entries: ContentEntry[]; equipment: 'Weapon' | 'Armor'; onRemove?: () => void; source?: string
}) {
  const base = name.replace(/\s*\([^)]+\)$/, '').replace('Grisantian Hide', 'Grisantian Pelt')
    .replace(/^Cold Siccatite$/, 'Siccatite').replace(/^Dawnsilver$/, 'Silver')
  const grade = /\([^)]+\)$/.exec(name)?.[0]
  const items = entries.filter((entry) => entry.kind === 'item' && !entry.deleted)
  const entry = (grade ? items.find((entry) => entry.name === `${base} ${equipment} ${grade}`) : undefined)
    ?? items.find((entry) => entry.name === `${base} ${equipment}`)
    ?? items.find((entry) => entry.name === base && entry.data.item_category === 'Materials')
  return <GearTag name={name} entry={entry} onRemove={onRemove} source={source} kind="material" />
}

const propertyRuneIndex = new WeakMap<ContentEntry[], Map<string, ContentEntry>>()
function propertyRuneEntries(entries: ContentEntry[]) {
  let index = propertyRuneIndex.get(entries)
  if (!index) {
    index = new Map()
    for (const entry of entries) {
      if (entry.kind !== 'item' || !/(?:Property Runes|Clan Dagger Filigrees)$/.test(String(entry.data.item_subcategory))) continue
      const key = runeName(entry.name)
      if (!index.has(key)) index.set(key, entry)
    }
    propertyRuneIndex.set(entries, index)
  }
  return index
}

function Runes({ runes, options, entries, limit, freeRunes = [], onChange, source }: {
  runes: string[]
  options: { name: string; level?: number }[]
  entries: ContentEntry[]
  limit: number
  freeRunes?: { name: string; source: string }[]
  onChange?: (r: string[]) => void
  source?: string
}) {
  const sortedRunes = [...runes].sort((a, b) => a.localeCompare(b))
  const entryFor = (name: string) => propertyRuneEntries(entries).get(runeName(name).split(':')[0])
  return (
    <div className="gear-runes">
      {sortedRunes.map((r) => (
        <GearTag key={r} name={r} entry={entryFor(r)} source={source} onRemove={onChange ? () => onChange(runes.filter((x) => x !== r)) : undefined} />
      ))}
      {[...freeRunes].sort((a, b) => a.name.localeCompare(b.name)).map((r) => <GearTag key={r.name} name={r.name} entry={entryFor(r.name)} source={r.source} />)}
      {onChange && runes.length < limit && options.some((option) => !runes.includes(option.name)) && (
        <SearchableSelect aria-label="Add property rune" value="" optionLevel={value => options.find(option => option.name === value)?.level} onChange={(e) => {
          if (options.some((option) => option.name === e.target.value) && !runes.includes(e.target.value)) {
            onChange([...runes, e.target.value].sort((a, b) => a.localeCompare(b)))
          }
        }}>
          <option value="">Add rune…</option>
          {options.filter((o) => !runes.includes(o.name)).map((o) => (
            <option key={o.name} value={o.name}>{o.name}{o.level !== undefined ? ` (Level ${o.level})` : ''}</option>
          ))}
        </SearchableSelect>
      )}
    </div>
  )
}

function WeaponFundamentals({ potency, striking, entries }: { potency: number; striking: number; entries: ContentEntry[] }) {
  const runes = [
    ...(potency ? [{ name: `+${potency} Potency`, names: [`Weapon Potency (+${potency})`, `+${potency} Weapon Potency`] }] : []),
    ...(striking ? [{ name: runeName(STRIKING_LABEL[striking]), names: [STRIKING_LABEL[striking]] }] : []),
  ]
  if (!runes.length) return null
  return <div className="gear-traits" role="group" aria-label="Fundamental runes">
    {runes.map(rune => <EntryDescription key={rune.name} name={rune.name} className="gear-trait"
      entry={entries.find(entry => entry.kind === 'item' && !entry.deleted
        && rune.names.some(name => runeName(entry.name) === runeName(name)))} />)}
  </div>
}

function ShieldRune({ rune, granted, locked, entries, onChange }: {
  rune: OwnedShield['reinforcingRune']; granted?: OwnedShield['reinforcingRune']; locked?: boolean; entries: ContentEntry[]; onChange: (rune: OwnedShield['reinforcingRune']) => void
}) {
  const automatic = granted && (!rune || SHIELD_RUNES[granted].level > SHIELD_RUNES[rune].level)
    ? <div className="gear-runes"><span>Blessed Shield</span>
      <GearTag name={`Reinforcing Rune (${granted})`} source="Granted by Blessed Shield"
        entry={entries.find(entry => entry.kind === 'item' && entry.name === `Reinforcing Rune (${granted})`)} />
    </div> : null
  if (rune) {
    const name = `Reinforcing Rune (${rune})`
    return <>{automatic}<div className="gear-runes"><span>Shield rune</span>
      <GearTag name={name} entry={entries.find(entry => entry.kind === 'item' && entry.name === name)}
        source="Protected by Blessed Shield" onRemove={locked ? undefined : () => onChange(undefined)} />
    </div></>
  }
  return <>{automatic}<label>{granted ? 'Installed shield rune' : 'Shield rune'}{' '}<SearchableSelect aria-label="Add shield rune" value=""
    optionLevel={value => Object.entries(SHIELD_RUNES).find(([name]) => name === value)?.[1].level} onChange={event => {
    const choice = (['Minor', 'Lesser', 'Moderate', 'Greater', 'Major', 'Supreme'] as const).find(name => name === event.target.value)
    if (choice) onChange(choice)
  }}>
    <option value="">Add reinforcing rune...</option>
    {Object.entries(SHIELD_RUNES).sort(([a], [b]) => a.localeCompare(b)).map(([name, data]) => <option key={name} value={name}>{name} (Level {data.level})</option>)}
  </SearchableSelect></label></>
}

function Level({ label, value, options, format, onChange, disabled, minimum = 0 }: {
  label: string
  value: number
  options: number[]
  format: (n: number) => string
  onChange: (n: number) => void
  disabled?: boolean
  minimum?: number
}) {
  if (disabled || !options.some(option => option >= minimum && option !== value)) {
    return <span>{label} <b>{format(value)}</b></span>
  }
  return (
    <label>{label}{' '}
      <select value={value} disabled={disabled} onChange={(e) => {
        const next = +e.target.value
        if (!disabled && options.includes(next) && next >= minimum) onChange(next)
      }}>
        {options.map((o) => <option key={o} value={o} disabled={o < minimum}>{format(o)}</option>)}
      </select>
    </label>
  )
}

export function HandwrapsGear({ c, entries, save }: SectionProps) {
  const handwraps = effectiveHandwraps(c, entries)
  const savedHandwraps = c.handwraps ?? (handwraps ? {
    potency: handwraps.potency, striking: handwraps.striking, runes: [],
    ...(handwraps.kind === 'hardlight' ? { kind: 'hardlight' as const, grade: handwraps.grade } : {}),
  } : undefined)
  const updateHandwraps = (patch: Partial<NonNullable<Character['handwraps']>>) => {
    if (!savedHandwraps) return
    const stored = { ...savedHandwraps }
    delete stored.material
    save({ handwraps: { ...stored, ...patch } })
  }
  const automaticKind = classHandwrapKind(c, entries)
  const granted = automaticKind && (handwraps?.kind === 'hardlight' ? 'hardlight' : 'mighty') === automaticKind
  const automatic = automaticWeaponFundamentals(c.level)
  const minimumGrade = automaticHardlightGrade(c.level)
  const item = handwraps?.kind === 'hardlight' ? HARDLIGHT_HANDWRAPS : HANDWRAPS
  const limit = handwraps?.kind === 'hardlight' ? HARDLIGHT_GRADES[handwraps.grade ?? 'Commercial'].upgrades
    : maxPropertyRunes(handwraps?.potency ?? 0, handwraps?.material)
  return (
    <div className="col gear-list">
      {handwraps ? <details className="gear-card" aria-label={item.name} open>
        <summary><strong><EntryDescription name={item.name}
          entry={entries.find(entry => entry.kind === 'item' && entry.name === item.name) ?? item} className="equipment-name" /></strong></summary>
        {handwraps.kind !== 'hardlight' && <WeaponFundamentals {...handwraps} entries={entries} />}
        {handwraps.kind === 'hardlight' ? <>
          {!!handwraps.runes.length && <small role="status">Saved runes are inactive on hardlight handwraps.</small>}
          <WeaponUpgrades entries={entries} weapon={{ ...HARDLIGHT_HANDWRAPS, kind: 'weapon',
            data: { ...HARDLIGHT_HANDWRAPS.data, weapon_type: 'Melee', weapon_group: 'Brawling', bulk: 0.1 } }}
            upgrades={handwraps.upgrades ?? []} limit={limit} effectiveUpgrades={installedHardlightUpgrades(c, entries)}
            onChange={upgrades => updateHandwraps({ upgrades })} />
        </> : <Runes runes={handwraps.runes} entries={entries} options={handwrapRuneOptions(c, entries)} limit={limit}
          onChange={(runes) => updateHandwraps({ runes })} />}
        {!granted && <button type="button" className="spell-remove" aria-label={`Remove ${item.name}`}
          onClick={() => confirmRemoval(`"${item.name}"`, () => save({ handwraps: undefined }))}>×</button>}
      </details> : <div className="row">
        <button type="button" className="gear-add" onClick={() => save({ handwraps: { ...automatic, runes: [] } })}>
        Add {HANDWRAPS.name}
        </button>
        {c.systems.includes('sf2e') && <button type="button" className="gear-add"
          onClick={() => save({ handwraps: { kind: 'hardlight', grade: minimumGrade, ...automatic, runes: [] } })}>
          Add {HARDLIGHT_HANDWRAPS.name}
        </button>}
      </div>}
    </div>
  )
}

export function SimplePoisons({ c, save }: SectionProps) {
  if (!activeFeatsNamed(c, 'Poison Weapon').length) return null
  const total = Math.max(0, Math.floor(c.level))
  const spent = Math.max(0, Math.min(total, Math.floor(c.simplePoisonsSpent ?? 0)))
  const remaining = total - spent
  const active = !!c.poisonWeaponActive
  return <div className="row">
    <label><input type="checkbox" aria-label="Poison Weapon active" checked={active}
      disabled={!active && remaining === 0} onChange={event => {
        if (event.target.checked) {
          if (remaining > 0) save({ simplePoisonsSpent: spent + 1, poisonWeaponActive: true })
        } else save({ poisonWeaponActive: false })
      }} /> <strong>Poison Weapon</strong></label>
    <output aria-label="Poison Weapon uses remaining">{remaining}/{total}</output>
    <button type="button" className="icon-button" aria-label="Reset Poison Weapon uses"
      title="Daily preparations" disabled={spent === 0 && !active} onClick={() => save({
        simplePoisonsSpent: 0, poisonWeaponActive: false,
      })}>↻</button>
  </div>
}

export function Gadgets({ c, entries, save }: SectionProps) {
  const limits = gadgetLimits(c, entries)
  if (!limits) return null
  const known = new Set(knownFormulas(c, entries).map(formula => formulaKey(formula.name)))
  const candidates = [...new Map(entries.filter(entry => entry.kind === 'item' && !entry.deleted
    && entry.systems.some(system => c.systems.includes(system)) && entry.level <= c.level
    && entry.traits.some(trait => trait.toLowerCase() === 'gadget') && known.has(formulaKey(entry.name)))
    .map(entry => [formulaKey(entry.name), entry])).values()].sort((a, b) => a.name.localeCompare(b.name))
  const preparations = c.gadgetPreparations ?? []
  const used = c.gadgetUsed ?? []
  return <div className="col">
    <h4>Gadgets</h4>
    {Array.from({ length: limits.prepared }, (_, index) => {
      const current = preparations[index] ?? ''
      return <div className="row" key={index}>
        <SearchableSelect label={`Gadget ${index + 1}`} aria-label={`Prepared gadget ${index + 1}`} value={current}
          optionLevel={value => candidates.find(entry => entry.name === value)?.level} onChange={event => {
          const value = event.target.value
          if (value && !candidates.some(entry => entry.name === value)) return
          const update = () => {
            const next = [...preparations]
            next[index] = value
            save({ gadgetPreparations: next })
          }
          if (current && current !== value) confirmRemoval(`prepared gadget "${current}"`, update)
          else update()
        }}>
          <option value="">Choose gadget</option>
          {current && !candidates.some(entry => entry.name === current) && <option disabled>{current} (unavailable)</option>}
          {candidates.map(entry => <option key={entry.id} value={entry.name}>{entry.name} (Level {entry.level})</option>)}
        </SearchableSelect>
        <label><input type="checkbox" aria-label={`Prepared gadget ${index + 1} used`} checked={!!used[index]} disabled={!current}
          onChange={event => {
            const next = [...used]
            next[index] = event.target.checked
            save({ gadgetUsed: next })
          }} /> Used</label>
      </div>
    })}
    <button type="button" disabled={!used.slice(0, limits.prepared).some(Boolean)} onClick={() => save({ gadgetUsed: [] })}>Daily preparations</button>
  </div>
}

export function MunitionsCrafter({ c, entries, save }: SectionProps) {
  const limits = munitionsLimits(c)
  if (!limits) return null
  const known = new Set(knownFormulas(c, entries).map(formula => formulaKey(formula.name)))
  const candidates = [...new Map(entries.filter(entry => isMunitionsConsumable(entry)
    && entry.systems.some(system => c.systems.includes(system)) && entry.level <= c.level
    && known.has(formulaKey(entry.name)))
    .map(entry => [formulaKey(entry.name), entry])).values()].sort((a, b) => a.name.localeCompare(b.name))
  const preparations = c.munitionsPreparations ?? []
  const used = c.munitionsUsed ?? []
  return <div className="col">
    <h4>Munitions</h4>
    {Array.from({ length: limits.prepared }, (_, index) => {
      const current = preparations[index] ?? ''
      const selected = candidates.find(entry => entry.name === current)
      const quantity = selected ? isMunitionsAmmunition(selected) ? '4 rounds' : '1 item' : ''
      return <div className="row" key={index}>
        <SearchableSelect label={`Munitions preparation ${index + 1}`} aria-label={`Prepared munition ${index + 1}`} value={current}
          optionLevel={value => candidates.find(entry => entry.name === value)?.level} onChange={event => {
          const value = event.target.value
          if (value && !candidates.some(entry => entry.name === value)) return
          const update = () => {
            const next = [...preparations]
            next[index] = value
            save({ munitionsPreparations: next })
          }
          if (current && current !== value) confirmRemoval(`prepared munition "${current}"`, update)
          else update()
        }}>
          <option value="">Choose bomb or ammunition</option>
          {current && !selected && <option value={current} disabled>{current} (unavailable)</option>}
          {candidates.map(entry => <option key={entry.id} value={entry.name}>
            {entry.name} (Level {entry.level}; {isMunitionsAmmunition(entry) ? '4 rounds' : '1 item'})
          </option>)}
        </SearchableSelect>
        <span>{quantity}</span>
        <label><input type="checkbox" aria-label={`Prepared munition ${index + 1} used`} checked={!!used[index]} disabled={!current}
          onChange={event => {
            const next = [...used]
            next[index] = event.target.checked
            save({ munitionsUsed: next })
          }} /> Used</label>
      </div>
    })}
    <button type="button" disabled={!used.slice(0, limits.prepared).some(Boolean)} onClick={() => save({ munitionsUsed: [] })}>Daily preparations</button>
  </div>
}

export function GrenadeSpecialist({ c, entries, save }: SectionProps) {
  const limits = grenadeLimits(c, entries)
  if (!limits) return null
  const known = new Set(knownFormulas(c, entries).map(formula => formulaKey(formula.name)))
  const candidates = [...new Map(entries.filter(entry => isGrenade(entry)
    && entry.systems.some(system => c.systems.includes(system)) && entry.level <= c.level
    && known.has(formulaKey(entry.name))).map(entry => [formulaKey(entry.name), entry])).values()]
    .sort((a, b) => a.name.localeCompare(b.name))
  const preparations = c.grenadePreparations ?? []
  const used = c.grenadeUsed ?? []
  return <div className="col">
    <h4>Grenade Specialist</h4>
    {Array.from({ length: limits.prepared }, (_, index) => {
      const current = preparations[index] ?? ''
      const grenade = candidates.find(entry => entry.name === current)
      const key = `prepared:${index}`
      return <div className="col" key={index}><div className="row">
        <SearchableSelect label={`Grenade ${index + 1}`} aria-label={`Prepared grenade ${index + 1}`} value={current}
          optionLevel={value => candidates.find(entry => entry.name === value)?.level} onChange={event => {
          const value = event.target.value
          if (value && !candidates.some(entry => entry.name === value)) return
          const update = () => {
            const next = [...preparations]
            next[index] = value
            const nextMods = { ...c.mechanicGrenadeMods }
            delete nextMods[key]
            save({ grenadePreparations: next, mechanicGrenadeMods: nextMods, ...clearItemGlitching(c, 'grenade', key),
              ...(c.mechanicEnduringMod?.kind === 'grenade' && c.mechanicEnduringMod.item === key
                ? { mechanicEnduringMod: undefined } : {}) })
          }
          if (current && current !== value) confirmRemoval(`prepared grenade "${current}"`, update)
          else update()
        }}>
          <option value="">Choose grenade</option>
          {current && !candidates.some(entry => entry.name === current) && <option value={current} disabled>{current} (unavailable)</option>}
          {candidates.map(entry => <option key={entry.id} value={entry.name}>{entry.name} (Level {entry.level})</option>)}
        </SearchableSelect>
        <label><input type="checkbox" aria-label={`Prepared grenade ${index + 1} used`} checked={!!used[index]} disabled={!current}
          onChange={event => {
            const next = [...used]
            next[index] = event.target.checked
            save({ grenadeUsed: next })
          }} /> Used</label>
      </div>
      {grenade && <>
        <EntryDescription name={grenade.name} entry={withBreachingGrenades(c, grenade)} />
        <GrenadeMods c={c} grenade={grenade} itemKey={key} save={save} label={`Prepared grenade ${index + 1}`} />
      </>}
      </div>
    })}
    <button type="button" disabled={!used.slice(0, limits.prepared).some(Boolean)
      && !Array.from({ length: limits.prepared }, (_, index) => c.mechanicGrenadeMods?.[`prepared:${index}`])
        .some(mod => mod && Object.values(mod).some(Boolean))
      && !Array.from({ length: limits.prepared }, (_, index) => c.mechanicGlitching?.[`grenade:prepared:${index}`]).some(Boolean)} onClick={() => {
      const nextMods = { ...c.mechanicGrenadeMods }
      const nextGlitching = { ...c.mechanicGlitching }
      for (let index = 0; index < limits.prepared; index++) delete nextMods[`prepared:${index}`]
      for (let index = 0; index < limits.prepared; index++) delete nextGlitching[`grenade:prepared:${index}`]
      const enduring = c.mechanicEnduringMod
      save({ grenadeUsed: [], mechanicGrenadeMods: nextMods, mechanicGlitching: nextGlitching,
        ...(enduring?.kind === 'grenade' && Array.from({ length: limits.prepared }, (_, index) => `prepared:${index}`).includes(enduring.item)
          ? { mechanicEnduringMod: undefined } : {}) })
    }}>Daily preparations</button>
  </div>
}

export function GrenadeMods({ c, grenade, itemKey, save, label }: {
  c: Character
  grenade: ContentEntry
  itemKey: string
  save: SectionProps['save']
  label: string
}) {
  if (c.className !== 'Mechanic' || !c.systems.includes('sf2e')) return null
  const mods = c.mechanicGrenadeMods?.[itemKey] ?? {}
  const setMods = (patch: Partial<typeof mods>) => {
    const previous = c.mechanicEnduringMod
    const selected = enduringGrenadeMods.find(mod => mod === previous?.mod)
    save({ mechanicGrenadeMods: { ...c.mechanicGrenadeMods, [itemKey]: { ...mods, ...patch } },
      ...(previous?.kind === 'grenade' && previous.item === itemKey
        && (selected && patch[selected] === false
          || previous.mod === 'damageType' && 'damageType' in patch && patch.damageType === undefined
          || previous.mod === 'transmutativeCasing' && 'transmutativeCasing' in patch && patch.transmutativeCasing === undefined
          || previous.mod === 'exploitiveAssault' && 'exploitiveAssault' in patch && patch.exploitiveAssault === undefined)
        ? { mechanicEnduringMod: undefined } : {}) })
  }
  const description = grenade.description ?? ''
  const radius = Number(/(?:burst\s+)?radius\s*(?:is|of|:)?\s*(\d+)\s*(?:feet|foot|ft)/i.exec(description)?.[1]) || undefined
  const damage = /\b(acid|cold|electricity|fire|sonic|bludgeoning|piercing|slashing)\s+damage\b/i.exec(description)?.[1]?.toLowerCase()
  const physical = ['bludgeoning', 'piercing', 'slashing'].includes(damage ?? '')
  const energy = ['acid', 'cold', 'electricity', 'fire', 'sonic'].includes(damage ?? '')
  const damageTypes = physical ? ['bludgeoning', 'piercing', 'slashing'] as const
    : energy ? ['acid', 'cold', 'electricity', 'fire', 'sonic'] as const : []
  return <div className="col" aria-label={`Modify ${label.toLowerCase()}`}>
    <label><input type="checkbox" checked={!!mods.bigBoom} onChange={event => setMods({ bigBoom: event.target.checked })} /> Big Boom</label>
    <label><input type="checkbox" checked={!!mods.longRange} onChange={event => setMods({ longRange: event.target.checked })} /> Long-range Propulsors</label>
    <label><input type="checkbox" checked={!!mods.incapacitant} onChange={event => setMods({ incapacitant: event.target.checked })} /> Incapacitant</label>
    <label><input type="checkbox" checked={!!mods.bunkerBuster} onChange={event => setMods({ bunkerBuster: event.target.checked })} /> Bunker Buster</label>
    <TransmutativeCasing c={c} value={mods.transmutativeCasing} onChange={value => setMods({ transmutativeCasing: value })} />
    <ExploitiveAssault c={c} value={mods.exploitiveAssault} onChange={value => setMods({ exploitiveAssault: value })} />
    {c.level >= 5 && damageTypes.length > 0 && <label>{physical ? 'Physical' : 'Energy'} Versatility{' '}
      <select aria-label={`${label} damage customization`} value={mods.damageType ?? ''} onChange={event => {
        const type = damageTypes.find(option => option === event.target.value)
        if (!event.target.value || type) setMods({ damageType: type })
      }}>
        <option value="">Normal damage</option>
        {mods.damageType && !damageTypes.some(type => type === mods.damageType)
          && <option value={mods.damageType} disabled>Unavailable damage type</option>}
        {damageTypes.map(type => <option key={type}>{type}</option>)}
      </select>
    </label>}
    <small>Thrown range {mods.longRange ? boostingTheBasics(c) ? 130 : 100 : 70} feet; launchers use their own range.
      {radius && ` Burst radius ${radius + (mods.bigBoom ? boostingTheBasics(c) ? 10 : 5 : 0)} feet.`}
      {mods.bigBoom && !radius && ` Increase burst radius by ${boostingTheBasics(c) ? 10 : 5} feet.`}
      {activeFeatsNamed(c, 'Apocalyptic Explosions').length > 0 && ' Apocalyptic Explosions doubles the grenade area.'}
      {mods.incapacitant && ' Nonlethal.'}
      {mods.incapacitant && boostingTheBasics(c) && ' Creatures critically hit or critically failing their save become frightened 1.'}
      {mods.bunkerBuster && ` +${boostingTheBasics(c) ? 10 : 5} damage to objects, structures, vehicles, and creatures with Hardness.`}
      {c.level >= 5 && mods.damageType && damageTypes.some(type => type === mods.damageType) && ` Damage type: ${mods.damageType}.`}</small>
    <small>{mechanicModDuration(c)}</small>
    {itemKey.startsWith('prepared:') && <ItemTroubleshoot c={c} save={save} kind="grenade" id={itemKey} label={label} />}
    {c.level >= 13 && <label>Enduring Mod{' '}
      <select aria-label={`Enduring mod: ${label}`}
        value={c.mechanicEnduringMod?.kind === 'grenade' && c.mechanicEnduringMod.item === itemKey ? c.mechanicEnduringMod.mod : ''}
        onChange={event => {
          const mod = enduringGrenadeMods.find(value => value === event.target.value)
          if (mod) save(setEnduringMod(c, { kind: 'grenade', item: itemKey, mod, label }))
          else if (event.target.value === 'damageType' && mods.damageType && damageTypes.some(type => type === mods.damageType))
            save(setEnduringMod(c, { kind: 'grenade', item: itemKey, mod: 'damageType', value: mods.damageType, label }))
          else if (event.target.value === 'transmutativeCasing' && mods.transmutativeCasing && activeFeatsNamed(c, 'Transmutative Casing').length)
            save(setEnduringMod(c, { kind: 'grenade', item: itemKey, mod: 'transmutativeCasing', value: mods.transmutativeCasing, label }))
          else if (event.target.value === 'exploitiveAssault' && mods.exploitiveAssault && activeFeatsNamed(c, 'Exploitive Assault').length)
            save(setEnduringMod(c, { kind: 'grenade', item: itemKey, mod: 'exploitiveAssault', value: mods.exploitiveAssault, label }))
          else if (!event.target.value && c.mechanicEnduringMod?.kind === 'grenade' && c.mechanicEnduringMod.item === itemKey)
            save(setEnduringMod(c))
        }}>
        <option value="">Not enduring</option>
        <option value="bigBoom">Big Boom</option>
        <option value="bunkerBuster">Bunker Buster</option>
        <option value="incapacitant">Incapacitant</option>
        <option value="longRange">Long-range Propulsors</option>
        {mods.damageType && damageTypes.some(type => type === mods.damageType) && <option value="damageType">Damage Versatility ({mods.damageType})</option>}
        {mods.exploitiveAssault && activeFeatsNamed(c, 'Exploitive Assault').length > 0
          && <option value="exploitiveAssault">Exploitive Assault ({mods.exploitiveAssault})</option>}
        {mods.transmutativeCasing && activeFeatsNamed(c, 'Transmutative Casing').length > 0
          && <option value="transmutativeCasing">Transmutative Casing ({mods.transmutativeCasing})</option>}
      </select>
    </label>}
  </div>
}

export function MechanicWeaponMods({ c, weapon, attack, save, allowUnarmed = false }: {
  c: Character
  weapon: OwnedWeapon
  attack: ReturnType<typeof weaponAttack>
  save: SectionProps['save']
  allowUnarmed?: boolean
}) {
  if (c.className !== 'Mechanic' || !c.systems.includes('sf2e')
    || !attack.entry || !allowUnarmed && weaponCategory(attack.entry) === 'Unarmed') return null
  const mods = c.mechanicWeaponMods?.[weapon.id] ?? {}
  const update = (patch: Partial<typeof mods>) => {
    const previous = c.mechanicEnduringMod
    const selected = enduringWeaponMods.find(mod => mod === previous?.mod)
    save({ mechanicWeaponMods: { ...c.mechanicWeaponMods, [weapon.id]: { ...mods, ...patch } },
      ...(previous?.kind === 'weapon' && previous.item === weapon.id
        && (selected && patch[selected] === false
          || previous.mod === 'damageType' && 'damageType' in patch && patch.damageType === undefined
          || previous.mod === 'transmutativeCasing' && 'transmutativeCasing' in patch && patch.transmutativeCasing === undefined
          || previous.mod === 'exploitiveAssault' && 'exploitiveAssault' in patch && patch.exploitiveAssault === undefined)
        ? { mechanicEnduringMod: undefined } : {}) })
  }
  const originalType = /(\d+)d(\d+)\s*([A-Za-z]+)/.exec(String(attack.entry.data.damage ?? ''))?.[3]?.toLowerCase()
  const physical = ['b', 'p', 's', 'bludgeoning', 'piercing', 'slashing'].includes(originalType ?? '')
  const energy = ['a', 'c', 'e', 'f', 'so', 'acid', 'cold', 'electricity', 'fire', 'sonic'].includes(originalType ?? '')
  const damageTypes = physical ? ['bludgeoning', 'piercing', 'slashing'] as const
    : energy ? ['acid', 'cold', 'electricity', 'fire', 'sonic'] as const : []
  const enduringOptions = [
    { mod: 'bigBoom', label: 'Big Boom', available: attack.entry.traits.some(trait => /^area(?:\s|$)/i.test(trait)) },
    { mod: 'bunkerBuster', label: 'Bunker Buster', available: true },
    { mod: 'explosiveShot', label: 'Explosive Shot', available: activeFeatsNamed(c, 'Explosive Shot').length > 0 },
    { mod: 'glitchPulse', label: 'Glitch Pulse', available: activeFeatsNamed(c, 'Glitch Pulse').length > 0 },
    { mod: 'incapacitant', label: 'Incapacitant', available: true },
    { mod: 'longRange', label: 'Long-range Propulsors', available: attack.range > 0 || attack.thrownRange > 0 },
    { mod: 'pinpointShot', label: 'Pinpoint Shot', available: weapon.id === 'mechanic:turret' && c.subclass === 'Turret' },
    { mod: 'damageType', label: `Damage Versatility (${mods.damageType})`, available: !!mods.damageType && damageTypes.some(type => type === mods.damageType) },
    { mod: 'exploitiveAssault', label: `Exploitive Assault (${mods.exploitiveAssault})`,
      available: !!mods.exploitiveAssault && activeFeatsNamed(c, 'Exploitive Assault').length > 0 },
    { mod: 'transmutativeCasing', label: `Transmutative Casing (${mods.transmutativeCasing})`,
      available: !!mods.transmutativeCasing && activeFeatsNamed(c, 'Transmutative Casing').length > 0 },
  ]
  const currentEnduring = c.mechanicEnduringMod?.kind === 'weapon' && c.mechanicEnduringMod.item === weapon.id
    ? c.mechanicEnduringMod.mod : ''
  return <div className="col" aria-label={`Mechanic mods: ${weapon.name}`}>
    <strong>Modify</strong>
    {attack.entry.traits.some(trait => /^area(?:\s|$)/i.test(trait)) && <label>
      <input type="checkbox" checked={!!mods.bigBoom} onChange={event => update({ bigBoom: event.target.checked })} /> Big Boom
    </label>}
    {mods.bigBoom && attack.entry.traits.some(trait => /^area(?:\s|$)/i.test(trait))
      && <small>Increase burst radius or cone length by {boostingTheBasics(c) ? 10 : 5} feet, or line length by {boostingTheBasics(c) ? 20 : 10} feet.</small>}
    <label><input type="checkbox" checked={!!mods.incapacitant}
      onChange={event => update({ incapacitant: event.target.checked })} /> Incapacitant</label>
    {mods.incapacitant && boostingTheBasics(c) && <small>Creatures critically hit or critically failing their save become frightened 1.</small>}
    {(attack.range > 0 || attack.thrownRange > 0) && <label><input type="checkbox" checked={!!mods.longRange}
      onChange={event => update({ longRange: event.target.checked })} /> Long-range Propulsors</label>}
    <label><input type="checkbox" checked={!!mods.bunkerBuster}
      onChange={event => update({ bunkerBuster: event.target.checked })} /> Bunker Buster</label>
    {mods.bunkerBuster && <small>+{boostingTheBasics(c) ? 10 : 5} damage to objects, structures, vehicles, and creatures with Hardness.</small>}
    <TransmutativeCasing c={c} value={mods.transmutativeCasing} onChange={value => update({ transmutativeCasing: value })} />
    <ExploitiveAssault c={c} value={mods.exploitiveAssault} onChange={value => update({ exploitiveAssault: value })} />
    {activeFeatsNamed(c, 'Glitch Pulse').length > 0 && <>
      <label><input type="checkbox" checked={!!mods.glitchPulse}
        onChange={event => update({ glitchPulse: event.target.checked })} /> Glitch Pulse</label>
      {mods.glitchPulse && <small>On a hit, Fortitude DC {mechanicClassDC(c)}: critical success grants 24-hour immunity;
        failure causes glitching 3 for 1 round to a tech creature or one random tech item, starting with held or wielded items;
        critical failure lasts 1 minute.</small>}
    </>}
    {activeFeatsNamed(c, 'Explosive Shot').length > 0 && <label>
      <input type="checkbox" checked={!!mods.explosiveShot}
        onChange={event => update({ explosiveShot: event.target.checked })} /> Explosive Shot
    </label>}
    {weapon.id === 'mechanic:turret' && c.subclass === 'Turret' && <label>
      <input type="checkbox" checked={!!mods.pinpointShot}
        onChange={event => update({ pinpointShot: event.target.checked })} /> Pinpoint Shot
    </label>}
    {c.level >= 5 && damageTypes.length > 0 && <label>{physical ? 'Physical' : 'Energy'} Versatility{' '}
      <select aria-label={`Damage customization: ${weapon.name}`} value={mods.damageType ?? ''} onChange={event => {
        const type = damageTypes.find(option => option === event.target.value)
        if (!event.target.value || type) update({ damageType: type })
      }}>
        <option value="">Normal damage</option>
        {mods.damageType && !damageTypes.some(type => type === mods.damageType)
          && <option value={mods.damageType} disabled>Unavailable damage type</option>}
        {damageTypes.map(type => <option key={type} value={type}>{type}</option>)}
      </select>
    </label>}
    <small>{mechanicModDuration(c)}</small>
    {!allowUnarmed && <ItemTroubleshoot c={c} save={save} kind="weapon" id={weapon.id} label={weapon.name} />}
    {c.level >= 13 && <label>Enduring Mod{' '}
      <select aria-label={`Enduring mod: ${weapon.name}`}
        value={currentEnduring}
        onChange={event => {
          const mod = enduringWeaponMods.find(value => value === event.target.value
            && enduringOptions.some(option => option.mod === value && option.available))
          if (mod) save(setEnduringMod(c, { kind: 'weapon', item: weapon.id, mod, label: weapon.name }))
          else if (event.target.value === 'damageType' && mods.damageType && damageTypes.some(type => type === mods.damageType))
            save(setEnduringMod(c, { kind: 'weapon', item: weapon.id, mod: 'damageType', value: mods.damageType, label: weapon.name }))
          else if (event.target.value === 'transmutativeCasing' && mods.transmutativeCasing && activeFeatsNamed(c, 'Transmutative Casing').length)
            save(setEnduringMod(c, { kind: 'weapon', item: weapon.id, mod: 'transmutativeCasing', value: mods.transmutativeCasing, label: weapon.name }))
          else if (event.target.value === 'exploitiveAssault' && mods.exploitiveAssault && activeFeatsNamed(c, 'Exploitive Assault').length)
            save(setEnduringMod(c, { kind: 'weapon', item: weapon.id, mod: 'exploitiveAssault', value: mods.exploitiveAssault, label: weapon.name }))
          else if (!event.target.value && c.mechanicEnduringMod?.kind === 'weapon' && c.mechanicEnduringMod.item === weapon.id)
            save(setEnduringMod(c))
        }}>
        <option value="">Not enduring</option>
        {currentEnduring && !enduringOptions.some(option => option.mod === currentEnduring && option.available)
          && <option value={currentEnduring} disabled>Unavailable mod</option>}
        {enduringOptions.filter(option => option.available).map(option =>
          <option value={option.mod} key={option.mod}>{option.label}</option>)}
      </select>
    </label>}
  </div>
}

function WeaponTraits({ attack, entries }: { attack: ReturnType<typeof weaponAttack>; entries: ContentEntry[] }) {
  const thrown = attack.traits.some(trait => /^thrown(?:\s|$)/i.test(trait.trim()))
  const range = thrown ? attack.thrownRange || attack.range : 0
  const traits = range ? attack.traits.map(trait => /^thrown(?:\s|$)/i.test(trait.trim()) ? `Thrown ${range}` : trait) : attack.traits
  return <>
    <GearTraits traits={traits} entries={entries} system={attack.entry?.systems[0]} />
    {thrown && !range && attack.thrownRangeBonus > 0 && <SourceNote source="Strong Arm" note={`Thrown range increases by ${attack.thrownRangeBonus} feet.`} />}
  </>
}

export function WeaponList({ c, entries, save, displayOnly = false, additionalWeapons = [], showAddWeapon = !displayOnly }:
  SectionProps & { displayOnly?: boolean; additionalWeapons?: OwnedWeapon[]; showAddWeapon?: boolean }) {
  const intensified = intensifiedElementDamage(c, entries)
  if (!displayOnly && activeBattleForm(c, entries)) return <WeaponList
    c={withoutBattleForm(c)} entries={entries} save={save} />
  const savedWeapons = ownedWeapons(c, entries)
  const weapons = [...savedWeapons, ...additionalWeapons]
  const gauntlet = armorGauntlet(c, entries)
  const livingSource = weapons.find((weapon) => weapon.livingWeapon && canBeLivingWeapon(c, entries, weapon))
  const saveWeapons = (next: OwnedWeapon[], extra?: Partial<Character>) => save({
    ...(livingSource ? { livingWeaponEnhancements: livingWeaponEnhancements(c, entries, livingSource) } : {}),
    weapons: [...next.filter(weapon => !weapon.attachedTo && !additionalWeapons.some(extraWeapon => extraWeapon.id === weapon.id)
      && !entries.some(entry => entry.kind === 'weapon' && entry.id === weapon.id && entry.data.granted_by_heritage)),
      ...(c.weapons ?? []).filter((weapon) =>
      (isDuplicateVeskAttack(c, entries, weapon) || weapon.id === 'sf2e:soldier:offensive-defense'
        || isAutomaticUnarmed(weapon.name) || weapon.name === HAFT_STRIKER_WEAPON.name || weapon.id === GAUNTLET.id || weapon.id === OVERSIZED_THROW.id)
        && !weapons.some((visible) => visible.id === weapon.id))],
    ...extra,
  })
  const update = (id: string, patch: Partial<OwnedWeapon>) => {
    const weapon = weapons.find((weapon) => weapon.id === id)
    if (weapon && patch.runes && osteoArmamentRune(c, entries, weapon)) {
      const enhanced = effectiveWeapon(c, entries, weapon)
      const hidden = weapon.runes.filter(rune => runeBaseName(rune) === 'Decaying' || !enhanced.runes.includes(rune))
      patch = { ...patch, runes: [...new Set([...patch.runes, ...hidden])] }
    }
    const shieldSource = weapon && shieldAttachmentSource(c, weapon)
    if (weapon && shieldSource) {
      const attachedWeapon = { ...shieldSource.attachedWeapon!, ...patch }
      save(shieldChange(c, shieldSource, { attachedWeapon }))
    } else if (weapon && PLAYING_CARD_WEAPONS.some(card => card.id === id)
      && (patch.potency !== undefined || patch.striking !== undefined || patch.runes !== undefined)) {
      const current = effectiveWeapon(c, entries, weapon)
      save({ playingCardEnhancements: { potency: patch.potency ?? current.potency,
        striking: patch.striking ?? current.striking, runes: patch.runes ?? current.runes } })
    } else if (weapon?.livingWeapon && canBeLivingWeapon(c, entries, weapon)
      && (patch.potency !== undefined || patch.striking !== undefined || patch.runes !== undefined)) {
      const shared = livingWeaponEnhancements(c, entries, weapon)
      save({ livingWeaponEnhancements: {
        potency: patch.potency ?? shared.potency, striking: patch.striking ?? shared.striking, runes: patch.runes ?? shared.runes,
      } })
    } else saveWeapons(weapons.map((w) => (w.id === id ? { ...w, ...patch } : w)))
  }
  const sparkFist = weapons.some(weapon => weapon.name === SPARK_FIST.name)
  const crimsonClaw = weapons.some(weapon => /^Crimson Claw$/i.test(weapon.name))
  const replacedTails = new Set(weapons.flatMap(weapon => tailbladeInheritance(c, entries, weapon).replacedTailIds))
  const sorted = weapons.filter(weapon => !replacedTails.has(weapon.id)
    && (!sparkFist || ![FIST.name, IRON_FIST.name].includes(weapon.name))
    && (!crimsonClaw || weapon.name !== FIST.name && !/^(?:vesk )?claws?$/i.test(weapon.name.trim()))
    && (!weapon.attachedTo || weaponEquipped(c, entries, weapon)))
    .sort((x, y) => equipmentDisplayName(x.name === SPARK_FIST.name ? FIST.name : x.name)
      .localeCompare(equipmentDisplayName(y.name === SPARK_FIST.name ? FIST.name : y.name)))
  const displayNames = new Map<string, string>()
  const handsUsed = equippedHands(c, entries)
  const unknownHands = weapons.some(weapon => !weapon.attachedTo && weapon.name !== HAFT_STRIKER_WEAPON.name
    && weaponEquipped(c, entries, weapon) && weaponHands(entries, weapon, c) === undefined)
  const handLimit = totalHandCapacity(c)
  const handwraps = effectiveHandwraps(c, entries)
  const handwrapItem = handwraps?.kind === 'hardlight' ? HARDLIGHT_HANDWRAPS : HANDWRAPS
  return (
    <div className="col gear-list">
      {displayOnly && (unknownHands || handsUsed > handLimit) && <small role="status">
        {unknownHands ? 'Equipped weapon hands unavailable; unequip it or sync weapon content before equipping more.'
          : `Unequip weapons to use at most ${handLimit} hands in total.`}
      </small>}
      {showAddWeapon && <Search c={c} save={save} entries={entries} kind="weapon" label="Add Weapon"
        onPick={(e) => saveWeapons([...savedWeapons, { id: newId(), name: e.name, potency: 0, striking: 0, runes: [], stowed: true }])} />}
      {sorted.map((w) => {
        const a = weaponAttack(c, entries, w)
        const crimsonClawModes = /^crimson claw\b/i.test(a.entry?.name ?? '') ? (() => {
          const modes = a.entry?.weaponModes ?? []
          const fire = modes.find(mode => mode.damageType.toLowerCase() === 'fire')
          const slashing = modes.find(mode => mode.damageType.toLowerCase() === 'slashing')
          return fire && slashing ? { fire, slashing,
            selected: modes.find(mode => mode.id === w.weaponMode) ?? modes[0] ?? fire } : undefined
        })() : undefined
        const capacity = a.entry?.data.named_weapon_no_ammunition ? 0 : weaponCapacity(a.entry)
        const savedLoaded = w.capacityLoaded
        const loaded = capacity > 0
          ? Math.max(0, Math.min(capacity, typeof savedLoaded === 'number' && Number.isInteger(savedLoaded) ? savedLoaded : capacity))
          : 0
        const enhanced = effectiveWeapon(c, entries, w)
        const runeCapacity = hasWeaponRuneCapacity(c, w, a.entry)
        const alloy = alloyedAttackMaterial(c, entries, enhanced)
        const alloyMaterial = alloy && <div className="gear-runes"><span>Material</span>
          <Material name={alloy} entries={entries} equipment="Weapon" source="Granted by Alloyed Attacks" />
        </div>
        const unarmed = weaponCategory(a.entry) === 'Unarmed'
        const upgradeWeapon = usesWeaponUpgrades(a.entry)
        const family = weaponGradeFamily(a.entry)
        const gradeOptions = upgradeWeapon && family ? entries.filter(entry => entry.kind === 'weapon'
          && !entry.deleted && entry.systems.includes('sf2e') && weaponGradeFamily(entry) === family)
          .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)) : []
        const baseGradeName = upgradeWeapon ? baseItems(gradeOptions)[0]?.name : undefined
        const plainName = enhanced.name === SPARK_FIST.name ? FIST.name
          : enhanced.name === 'Iron Fist' ? 'Fists'
          : enhanced.name === UNTAMED_CLAWS.name ? 'Claws'
            : enhanced.name === 'Untamed Jaws' ? 'Jaws'
            : enhanced.name === CLAN_DAGGER_DEXTERITY.name ? CLAN_DAGGER.name
              : baseGradeName ?? specificMagicItemName(a.entry, combinationName(entries, enhanced.name).replace(/ \(Animal Feature\)$/, ''), true)
        const grantedName = a.entry?.id.startsWith('sf2e:vesk:')
          ? plainName.replace(/\bVesk\b\s*/i, '').replace(/^Claw$/i, 'Claws') : plainName
        const shieldSource = shieldAttachmentSource(c, w)
        const scaleRunes = scaleOfIgroonWeaponRunes(c, shieldSource, w).map(rune =>
          enhanced.runes.find(existing => runeBaseName(existing) === runeBaseName(rune)) ?? rune)
        const clanRunes = clanPistolRunes(c, w).map(rune =>
          enhanced.runes.find(existing => runeBaseName(existing) === runeBaseName(rune)) ?? rune)
        const grantedWeaponRunes = [...scaleRunes, ...clanRunes]
        const sourceWeapon = w.attachedTo ? weapons.find(weapon => weapon.id === w.attachedTo) : undefined
        const attachmentSource = shieldSource ?? sourceWeapon
        const attachmentName = shieldSource ? specificMagicItemName(shieldEntry(entries, shieldSource.name), shieldSource.name, true)
          : sourceWeapon ? specificMagicItemName(withNamedWeaponState(weaponEntry(entries, sourceWeapon.name), sourceWeapon, c.level),
            combinationName(entries, sourceWeapon.name), true).replace(/\bDueling Pistols$/, 'Dueling Pistol') : ''
        const haft = w.name === HAFT_STRIKER_WEAPON.name ? haftStrikerSource(c, entries) : undefined
        const haftName = haft ? specificMagicItemName(weaponEntry(entries, haft.name, haft.id), combinationName(entries, haft.name), true) : ''
        const displayName = `${equipmentDisplayName(adoptedAncestryText(c, grantedName))}${attachmentSource ? ` (Attached to ${equipmentDisplayName(attachmentName)})` : ''}${haft ? ` (from ${equipmentDisplayName(adoptedAncestryText(c, haftName))})` : ''}`
        displayNames.set(w.id, displayName)
        const forms = combinationForms(entries, w.name)
        const activeCombinationForm = forms.length
          ? w.combinationForm === 'Melee' || w.combinationForm === 'Ranged'
            ? w.combinationForm
            : / \(Ranged\)$/.test(w.name) ? 'Ranged' : 'Melee'
          : undefined
        const card = PLAYING_CARD_WEAPONS.some(option => option.id === w.id)
        const strength = hasAnimalStrength(c, entries, w)
        const strengthSources = strength ? animalStrengthRuneSources(c, entries, w) : []
        const strengthOptions = [{ id: '', name: handwraps ? handwrapItem.name : 'No runes' },
          ...strengthSources.map(source => source.weapon)].sort((a, b) => a.name.localeCompare(b.name))
        const strengthSource = animalStrengthSource(c, entries, w)
        const strengthSelection = strengthSource && strengthSources.find(source => source.ids.includes(strengthSource.id))?.weapon.id
        const inherited = !!handwraps && unarmed && !strengthSource
        const shieldBash = !!shieldSource && !shieldSource.attachedWeapon
        const fixed = w.id === OVERSIZED_THROW.id || shieldBash
        const hands = weaponHands(entries, w, c)
        const bowGrip = String(a.entry?.data.hands).trim() === '1+'
        const equipped = weaponEquipped(c, entries, w)
        const linkedSource = shieldSource ? undefined : attachmentSource ?? haft
        const fixedEquipped = hands === 0 || !!linkedSource || !!w.attachedTo
        const legacyPouchWeapon = w.id === `eq-${w.name}` && c.equipment.some(item =>
          item.name === w.name && (item.cheekQty ?? 0) >= item.qty)
        const cannotEquip = !equipped && (shieldSource ? !canEquipShield(c, entries, shieldSource)
          : legacyPouchWeapon || hands === undefined || unknownHands || handsUsed + hands > handLimit)
        const inheritedLivingWeapon = !!haft && !!enhanced.livingWeapon
        const canUseLivingWeapon = !fixed && !attachmentSource && !linkedSource && canBeLivingWeapon(c, entries, w)
        const livingWeapon = canUseLivingWeapon && !!w.livingWeapon
        const shared = livingWeapon ? livingWeaponEnhancements(c, entries, w) : card ? enhanced : w
        const canUseVerdantWeapon = !attachmentSource && canBeVerdantWeapon(c, entries, w)
        const osteoArmament = !!w.osteoArmament && canBeOsteoArmament(c, entries, w)
        const decaying = osteoArmamentRune(c, entries, w)
        const giantWeapon = isGiantWeapon(c, entries, w)
        const canUseInnovation = !attachmentSource && canBeWeaponInnovation(c, entries, w)
        const innovation = canUseInnovation && !!w.inventorInnovation
        const plate = w.id === GAUNTLET.id ? gauntlet?.armor : undefined
        const builtIn = namedWeaponEnhancements(a.entry)
        const namedSource = String(a.entry?.data.named_weapon_source ?? '')
        const automaticFundamentals = hasAutomaticWeaponFundamentals(c, entries, w)
        const solarCrystals = c.systems.includes('sf2e') && isSolarianCrystalWeapon(w)
        const lockFundamentals = automaticFundamentals || solarCrystals || !!plate && isGrantedArmor(plate.id)
          && armorEntry(c, entries, plate.name, plate.id)?.data.automatic_fundamentals !== false
        const automaticBase = automaticFundamentals ? automaticWeaponFundamentals(c.level) : { potency: 0, striking: 0 }
        const automatic = { potency: Math.max(automaticBase.potency, builtIn?.potency ?? 0),
          striking: Math.max(automaticBase.striking, builtIn?.striking ?? 0) }
        const grantedClanWeapon = isGrantedDwarfClanWeapon(c, entries, w)
        const freeShifting = livingWeapon || inheritedLivingWeapon && enhanced.runes.some(rune => runeName(rune) === 'Shifting')
        const blessed = strengthSource ? undefined : blessedArmamentRune(c, entries, { ...enhanced, runes: unarmed ? handwraps?.runes ?? []
          : livingWeapon ? livingWeaponRunes({ ...w, ...shared }) : haft ? enhanced.runes : [...w.runes, ...grantedWeaponRunes] })
        const iruxiGranted = unarmed && c.ancestry === 'Lizardfolk' && activeFeatsNamed(c, 'Iruxi Spirit Strike').length > 0
          && !effectiveWeapon({ ...c, feats: c.feats.filter(feat => feat.name !== 'Iruxi Spirit Strike') }, entries, w)
            .runes.some(rune => runeBaseName(rune) === 'Astral')
        const iruxiRune = c.level >= 15 ? 'Astral (Greater)' : 'Astral'
        const ghostWrangler = !!c.raging && /^fist$/i.test(w.name) && isFeatEffectActive(c, 'Ghost Wrangler')
        const freeRunes = [...(builtIn?.runes.map(name => ({ name, source: `Built into ${String(a.entry?.data.named_weapon_source)}` })) ?? []),
          ...scaleRunes.map(name => ({ name, source: 'Granted by Scale of Igroon' })),
          ...clanRunes.map(name => ({ name, source: 'Granted by Clan Pistol' })),
          ...(freeShifting ? [{ name: 'Shifting', source: 'Granted by Living Weapon' }] : []),
          ...(blessed ? [{ name: blessed, source: 'Granted by Blessed Armament' }] : []),
          ...(iruxiGranted ? [{ name: iruxiRune, source: 'Granted by Iruxi Spirit Strike' }] : []),
          ...(c.raging && c.spiritRage && barbarianInstinct(c, entries) === 'spirit'
            && !enhanced.runes.some(rune => runeName(rune) === 'Ghost Touch')
            ? [{ name: 'Ghost Touch', source: 'Granted by Spirit Rage' }] : []),
          ...(ghostWrangler && !(c.raging && c.spiritRage && barbarianInstinct(c, entries) === 'spirit')
            && !enhanced.runes.some(rune => runeName(rune) === 'Ghost Touch')
            ? [{ name: 'Ghost Touch', source: 'Granted by Ghost Wrangler' }] : []),
          ...(decaying ? [{ name: decaying, source: 'Granted by Osteo Armaments' }] : []),
          ...([CLAN_DAGGER.name, CLAN_DAGGER_DEXTERITY.name].includes(w.name) && c.level >= 5
            ? ["Bolka's Blessing", "Kols's Oath", "Trudd's Strength"].map(name => ({
              name: `${c.level >= 11 ? 'Greater ' : ''}${name}`, source: 'Granted to clan daggers',
            })) : [])]
        const pristineSource = a.pristineWeapon ? 'Pristine Weapon' : a.pristineLivingWeapon ? 'Pristine Living Weapon' : undefined
        const pristineNote = pristineSource
          ? `${pristineSource}: treated as cold iron and silver. Critical hit against a creature with a weakness to cold iron or silver: 1d6 persistent bleed.`
          : undefined
        const inventive = !!activeFeatsNamed(c, 'Inventive Offensive').length && !unarmed
          && !!a.entry && !isRanged(a.entry) && !w.stowed && !w.cheekStored && weaponHeld(c, entries, w)
        const baseTraits = inventive ? weaponAttack({ ...c, inventiveOffensive: undefined }, entries, w).traits : []
        const inventiveOptions = inventiveOffensiveOptions(baseTraits)
        const savedInventive = c.inventiveOffensive?.weaponId === w.id ? c.inventiveOffensive.traits : []
        const firstInventive = inventiveOptions.find(option => option === savedInventive[0]) ?? ''
        const secondOptions = inventiveOffensiveOptions([...baseTraits, ...(firstInventive ? [firstInventive] : [])])
        const secondInventive = secondOptions.find(option => option === savedInventive[1]) ?? ''
        const combinationWeaponForForm = (form: 'Melee' | 'Ranged') => {
          const target = forms.find(entry => entry.name.endsWith(`(${form})`))
          if (!target) return undefined
          const handsHeld = w.handsHeld && weaponCanUseTwoHands(target) ? w.handsHeld : undefined
          return { ...w, name: target.name, combinationForm: form, handsHeld }
        }
        const canUseCombinationForm = (form: 'Melee' | 'Ranged') => {
          const targetWeapon = combinationWeaponForForm(form)
          if (!targetWeapon) return false
          if (!equipped) return true
          const targetHands = weaponHands(entries, targetWeapon, c)
          return !unknownHands && handsUsed - (hands ?? 0) + (targetHands ?? handLimit + 1) <= handLimit
        }
        const legendaryCrafting = inventive && (ranksAt(c, entries).Crafting ?? 0) >= 4
        const compactDamage = (damage: string) => damage.replace(/\b(bludgeoning|piercing|slashing)\b/gi, type => type[0].toUpperCase())
        const untamedPersistent = !a.upgrades.some(upgrade => upgrade.name === 'Merciful')
          && c.level >= 11 && ['Untamed Claws', 'Untamed Jaws'].includes(w.name)
          ? `${c.level >= 19 ? 4 : 2}d6 persistent ${w.name === 'Untamed Claws' ? 'bleed' : 'poison'}` : undefined
        const canThrowMelee = (attack: typeof a) => !attack.range
          && (attack.thrownRange > 0 || attack.traits.some(trait => /^thrown(?:\s|$)/i.test(trait.trim())))
        const oversizedDamage = w.id === OVERSIZED_THROW.id
          ? /^(\d+)d(\d+)([+-]\d+)?\s+(\w+)$/.exec(a.damage) : null
        const oversizedAction = oversizedDamage && <span onClick={event => event.stopPropagation()}>
          <DamageRoll name="Oversized Throw" actions="Two Actions" toggleResult damage={{
            label: 'Damage', dice: Number(oversizedDamage[1]), sides: Number(oversizedDamage[2]),
            bonus: Number(oversizedDamage[3] ?? 0), type: oversizedDamage[4],
          }} />
        </span>
        const dawnJavelin = namedSource === "Hunter's Dawn" ? { ...w, name: "Hunter's Dawn (Javelin)" } : undefined
        const dawnJavelinEntry = dawnJavelin && weaponEntry(entries, dawnJavelin.name, dawnJavelin.id)
        const attackSummaries = (namedSource === 'Coldstar Pistols' && (!w.coldstarForm || w.coldstarForm === 'Paired')
          ? (['Flame', 'Frost'] as const).map(coldstarForm => {
            const formWeapon = { ...w, coldstarForm }
            return { form: `${coldstarForm} pistol`, weapon: effectiveWeapon(c, entries, formWeapon), attack: weaponAttack(c, entries, formWeapon) }
          })
          : forms.length
          ? (['Melee', 'Ranged'] as const).flatMap(form => {
            const formWeapon = combinationWeaponForForm(form)!
            const formAttack = weaponAttack(c, entries, formWeapon)
            const formEnhanced = effectiveWeapon(c, entries, formWeapon)
            return canThrowMelee(formAttack)
              ? [{ form: 'Melee', weapon: formEnhanced, attack: formAttack },
                { form: 'Thrown', weapon: formEnhanced, attack: weaponAttack(c, entries, formWeapon, { thrown: true }) }]
              : [{ form, weapon: formEnhanced, attack: formAttack }]
          })
          : namedSource === "Hunter's Dawn"
          ? [{ form: undefined, weapon: enhanced, attack: a },
            ...(dawnJavelin && dawnJavelinEntry ? [{ form: 'Ranged', weapon: effectiveWeapon(c, entries, dawnJavelin),
              attack: weaponAttack(c, entries, dawnJavelin) }] : [])]
          : canThrowMelee(a)
          ? [{ form: 'Melee', weapon: enhanced, attack: a },
            { form: 'Ranged', weapon: enhanced, attack: weaponAttack(c, entries, w, { thrown: true }) }]
          : [{ form: undefined, weapon: enhanced, attack: a },
            ...(c.raging && activeFeatsNamed(c, 'Raging Thrower').length && a.thrownRange > 0
              ? [{ form: 'Thrown', weapon: enhanced, attack: weaponAttack(c, entries, w, { thrown: true }) }] : [])])
          .map(summary => ({ ...summary, inactive: !!forms.length
            && (summary.form === 'Thrown' ? 'Melee' : summary.form) !== activeCombinationForm,
            attackForm: summary.form ?? (summary.attack.entry
            ? isRanged(summary.attack.entry) ? 'Ranged' : 'Melee' : undefined),
            fulminatingShot: fulminatingShotDamage(c, summary.attack.entry),
            strikeNote: namedWeaponStrikeNote(summary.attack.entry), damageRunes: [
            ...damageRuneSummary(summary.weapon, summary.attack, entries, !!forms.length || card),
            ...upgradeDamageSummary(summary.attack),
            ...mechanicDamageSummary(c, w, summary.attack),
            ...(intensified ? [{ source: 'Intensified Element Stance', value: `${intensified.dice}d6 ${intensified.type} (conditional)`,
              note: `Only against ${intensified.targets}.` }] : []),
          ] }))
        const inlineRange = (summary: (typeof attackSummaries)[number]) =>
          summary.attack.range > 0 && (summary.attackForm === 'Ranged' || summary.attackForm === 'Thrown')
        const attackLine = (summary: (typeof attackSummaries)[number]) => <>
          {summary.attackForm && `${summary.attackForm}${inlineRange(summary) ? ` (${summary.attack.range} feet)` : ''}: `}Attack <WeaponAttackBonuses label={`${displayName} ${summary.form ? `${summary.form} ` : ''}attack`} attack={summary.attack} />
          {summary.attack.damage && <>, Damage {compactDamage(summary.attack.damage)}{summary.strikeNote && <SourceNote
            source={String(summary.attack.entry?.data.named_weapon_source ?? summary.attack.entry?.data.special_weapon_source)}
            note={summary.strikeNote} />}{summary.damageRunes.length > 0 && ' + '}{summary.damageRunes.map((rune, runeIndex) =>
            <Fragment key={`${rune.source}:${runeIndex}`}>{runeIndex > 0 && ' + '}{rune.value}{rune.note
              && <SourceNote source={rune.source} note={rune.note} inlineSource={rune.source === 'Gravity Weapon' || rune.source === 'Pharasma (Moderate Boon)'} />}</Fragment>)}
            {summary.fulminatingShot && ` + ${summary.fulminatingShot}`}{untamedPersistent && ` + ${untamedPersistent}`}</>}{summary.inactive && ' (inactive)'}
        </>
        const avengerNote = rogueRackets(c, entries).includes('Avenger') && isFavoredWeapon(c, entries, w.name)
          ? 'Avenger: sneak attack applies to your prey; critical specialization applies on a critical hit against an off-guard target.' : undefined
        const activeRunes = forms.length || card ? enhanced.runes.filter(rune => weaponRuneApplies(entries, enhanced, rune)) : enhanced.runes
        const activeFreeRunes = freeRunes.filter((rune, index) =>
          (!(forms.length || card) || weaponRuneApplies(entries, enhanced, rune.name))
          && freeRunes.findIndex(other => runeName(other.name) === runeName(rune.name)) === index)
        const crushing = activeRunes.some((rune) => runeName(rune) === 'Crushing (Greater)') ? 2 : activeRunes.includes('Crushing') ? 1 : 0
        const equipControls = <>
            {inventive && <span onClick={event => event.stopPropagation()}>
              <label>Inventive Offensive <ActionIcon actions={(ranksAt(c, entries).Crafting ?? 0) >= 2 ? 'Two Actions' : 'Three Actions'} />{' '}
                <select aria-label={`Inventive Offensive: ${displayName}`} value={firstInventive} onChange={event => {
                  const value = inventiveOptions.find(option => option === event.target.value)
                  const nextSecond = value && secondInventive && inventiveOffensiveOptions([...baseTraits, value]).includes(secondInventive)
                    ? [secondInventive] : []
                  save({ inventiveOffensive: value ? { weaponId: w.id, traits: [value, ...nextSecond] } : undefined })
                }}>
                  <option value="">None</option>
                  {inventiveOptions.map(option => <option key={option}>{option}</option>)}
                </select>
              </label>
              {legendaryCrafting && <label> Second trait{' '}
                <select aria-label={`Inventive Offensive second trait: ${displayName}`} value={secondInventive}
                  disabled={!firstInventive} onChange={event => {
                    if (!firstInventive) return
                    const value = secondOptions.find(option => option === event.target.value)
                    save({ inventiveOffensive: { weaponId: w.id, traits: [firstInventive, ...(value ? [value] : [])] } })
                  }}>
                  <option value="">None</option>
                  {secondOptions.map(option => <option key={option}>{option}</option>)}
                </select>
              </label>}
              <SourceNote source="Inventive Offensive"
                note="Ends after a successful hit that deals damage, or when you stop wielding the weapon. Clear the selection when it ends." />
            </span>}
            {namedSource === 'Briar' && <label>Sharpness Points{' '}
              <input aria-label="Briar Sharpness Points" type="number" min={0} max={BRIAR_MAX_SHARPNESS} step={1} value={briarSharpnessPoints(w.briarSharpness)}
                onChange={event => {
                  const points = event.target.valueAsNumber
                  if (Number.isSafeInteger(points) && points >= 0) update(w.id, { briarSharpness: briarSharpnessPoints(points) })
                }} />
            </label>}
            {namedSource === 'Azlanti Diamond' && <label>Bond duration{' '}
              <select aria-label="Azlanti Diamond bond duration" value={w.azlantiBond ?? 0}
                onChange={event => {
                  const value = Number(event.target.value)
                  if (value === 0 || value === 1 || value === 2) update(w.id, { azlantiBond: value })
                }}>
                <option value={0}>Less than 1 year</option><option value={1}>1 year</option><option value={2}>2+ years</option>
              </select>
            </label>}
            {activeCombinationForm && <label title="Changing combination forms uses an Interact action.">
              <ActionIcon actions="Single Action" />
              <select aria-label={`Combination form: ${displayName}`} value={activeCombinationForm} onChange={event => {
                const form = event.target.value
                const nextWeapon = form === 'Melee' || form === 'Ranged' ? combinationWeaponForForm(form) : undefined
                if ((form !== 'Melee' && form !== 'Ranged') || form === activeCombinationForm
                  || !nextWeapon || !canUseCombinationForm(form)) return
                update(w.id, { combinationForm: form, handsHeld: nextWeapon.handsHeld })
              }}>
                {(['Melee', 'Ranged'] as const).map(form => <option key={form} value={form}
                  disabled={form !== activeCombinationForm && !canUseCombinationForm(form)}>{form}</option>)}
              </select>
            </label>}
            {namedSource === 'Coldstar Pistols' && <label>Form{' '}<ActionIcon actions="Single Action" />
              <select aria-label="Coldstar Pistols form" value={w.coldstarForm ?? 'Paired'} onChange={event => {
                const form = event.target.value
                if (form !== 'Paired' && form !== 'Flame' && form !== 'Frost' && form !== 'Merged') return
                if (equipped && (unknownHands || handsUsed - (hands ?? 0) + (form === 'Paired' ? 2 : 1) > handLimit)) return
                update(w.id, { coldstarForm: form, handsHeld: undefined })
              }}>
                <option value="Paired" disabled={equipped && (unknownHands || handsUsed - (hands ?? 0) + 2 > handLimit)}>Paired pistols (2 hands)</option>
                <option value="Flame">Flame pistol</option><option value="Frost">Frost pistol</option><option value="Merged">Merged (120 ft.)</option>
              </select>
            </label>}
            {a.entry?.weaponModes && a.entry.weaponModes.length > 1 && (crimsonClawModes
              ? <label><input type="checkbox" aria-label={`Crimson Claw mode: ${displayName}`}
                checked={crimsonClawModes.selected.id === crimsonClawModes.fire.id}
                onChange={event => update(w.id, { weaponMode: event.target.checked
                  ? crimsonClawModes.fire.id : crimsonClawModes.slashing.id })} />
                {' '}{crimsonClawModes.selected.id === crimsonClawModes.fire.id ? 'Fire' : 'Slashing'}{' '}
                <ActionIcon actions="Single Action" />
              </label>
              : <label title="Changing modes uses an Interact action. Powered attacks still require ammunition or charges.">Mode{' '}
                <ActionIcon actions="Single Action" />
                <select aria-label={`Mode: ${displayName}`} value={w.weaponMode ?? a.entry.weaponModes[0].id} onChange={event => {
                  if (a.entry?.weaponModes?.some(mode => mode.id === event.target.value)) update(w.id, { weaponMode: event.target.value })
                }}>
                  {w.weaponMode && !a.entry.weaponModes.some(mode => mode.id === w.weaponMode)
                    && <option value={w.weaponMode} disabled>Saved mode unavailable; showing first mode</option>}
                  {a.entry.weaponModes.map(mode => <option key={mode.id} value={mode.id}>
                    {mode.damageType[0].toUpperCase() + mode.damageType.slice(1)}{mode.traits.some(trait => /^powered$/i.test(trait)) ? ' (powered)'
                      : mode.traits.some(trait => /^analog$/i.test(trait)) ? ' (analog)' : ''}
                  </option>)}
                </select>
              </label>)}
            {!fixedEquipped && <label title={legacyPouchWeapon
              ? 'Retrieve this weapon from your cheek pouch first.' : cannotEquip
              ? hands === undefined || unknownHands ? 'Weapon hands unavailable; sync weapon content or unequip the unknown weapon.' : undefined
              : undefined}>
              <input type="checkbox" aria-label={`Equipped ${displayName}`} checked={equipped}
                disabled={cannotEquip}
                onChange={event => {
                  if (event.target.checked && cannotEquip) return
                  update(w.id, { stowed: !event.target.checked, ...(event.target.checked ? { cheekStored: false, cheekHolstered: false } : {}) })
                }} /> Equipped
            </label>}
            {!linkedSource && !shieldSource && hands !== 0 && a.entry && weaponCanUseTwoHands(a.entry) && <label>Hands{' '}
              <select aria-label={`Hands: ${displayName}`} value={hands ?? 1}
                onChange={event => {
                  const next = Number(event.target.value) as 1 | 2
                  if (next !== 1 && next !== 2
                    || equipped && next > (hands ?? 0) && (unknownHands || handsUsed - (hands ?? 0) + next > handLimit)) return
                  update(w.id, { handsHeld: next })
                }}>
                <option value={1}>{bowGrip ? '1 (hold)' : '1'}</option>
                <option value={2} disabled={equipped && (unknownHands || handsUsed - (hands ?? 0) + 2 > handLimit)}>{bowGrip ? '2 (shoot)' : '2'}</option>
              </select>
            </label>}
        </>
        const abilities = namedWeaponAbilities(a.entry)
        const dawnMatch = /^(\d+)d(\d+)([+-]\d+)?/.exec(a.damage)
        const dawnDamage = dawnMatch ? { dice: Number(dawnMatch[1]), sides: Number(dawnMatch[2]), bonus: Number(dawnMatch[3] ?? 0) } : undefined
        const namedWeaponNotes = <>
          {namedSource === 'Serithtial' && w.stowed && <small>Stowed form: Bastard Sword. Selected blade form resumes when wielded.</small>}
          {a.entry?.data.named_weapon_rules_missing && <small role="status">Named weapon enhancement details unavailable. Configure its runes and consult the item rules.</small>}
          {String(a.entry?.data.named_weapon_source ?? '').startsWith('Wintershot') && <SourceNote source="Wintershot"
            note={`Ignores concealment from mist or precipitation; negates strong-wind attack penalties${a.entry?.data.named_weapon_source === 'Wintershot' ? ' up to -2' : ''}. Activations are tracked manually.`} />}
          {String(a.entry?.data.named_weapon_source ?? '').startsWith('Wintershot') && abilities.every(ability => ability.name === 'Summary' || ability.name === 'Senses')
            && <small role="status">Wintershot activation details unavailable. Sync content or open its item description.</small>}
          {abilities.filter(ability => ability.name !== 'Summary').map(ability => <details key={ability.name}>
            <summary>{ability.name} <ActionIcon actions={ability.actions} />
              {namedSource === "Hunter's Dawn" && ability.name === 'Activation 1' && dawnDamage
                && <span onClick={event => event.stopPropagation()}><MultipleDamageRoll name="Hunter's Dawn javelin"
                  actions={ability.actions ?? 'Single Action'} damages={[
                    { label: 'Javelin', dice: dawnDamage.dice, sides: 6, bonus: dawnDamage.bonus, type: 'piercing' },
                    { label: 'Gazelle', dice: 2, sides: 6, bonus: dawnDamage.bonus, type: 'piercing' }]} /></span>}
              {namedSource === "Hunter's Dawn" && ability.name === 'Activation 3'
                && <span onClick={event => event.stopPropagation()}><DamageRoll name="Hunter's Dawn fire" actions={ability.actions ?? 'Single Action'}
                  toggleResult damage={{ label: 'Fire', dice: 6, sides: 6, type: 'fire' }} /></span>}
              {namedSource === 'Briar' && ability.name === 'Oaken Resilience' && <label onClick={event => event.stopPropagation()}>
                {' '}<input type="checkbox" aria-label="Briar Oaken Resilience active" checked={!!w.briarOakenResilienceActive}
                  onChange={event => update(w.id, { briarOakenResilienceActive: event.target.checked })} /> Active
              </label>}
            </summary>
            {ability.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </details>)}
        </>
        const removeWeapon = !attachmentSource && !additionalWeapons.some(extraWeapon => extraWeapon.id === w.id)
          && !isLockedWeapon(c, w.name, entries, w.id) && <button type="button" className="spell-remove"
            aria-label={`Remove ${displayName}`} title="Remove"
            onClick={() => confirmRemoval(`weapon "${displayName}"`, () => saveWeapons(weapons.filter(x => x.id !== w.id),
              { ...(c.mechanicEnduringMod?.kind === 'weapon' && c.mechanicEnduringMod.item === w.id ? setEnduringMod(c) : {}),
                ...clearItemGlitching(c, 'weapon', w.id) }))}>×</button>
        if (displayOnly) return <div key={w.id} className="gear-card">
          <div className="weapon-offense-header">
            <strong><EntryDescription name={displayName} entry={witchAttackEntry(c, entries, w.id, a.entry)} className="equipment-name" /></strong>
            {w.id === OVERSIZED_THROW.id ? oversizedAction : a.entry?.name === 'Offensive Defense' && <> <ActionIcon entry={a.entry} /></>}
            {c.hardpointWeaponId === w.id && hardpointWeaponEligible(c, entries, w) && weaponHeld(c, entries, w)
              && <SourceNote inlineSource={false} source="Hardpoint" note="Integrated weapon: cannot be disarmed, dropped, or stolen until stowed." />}
            {equipControls}
            {removeWeapon}
          </div>
          {cannotEquip && (legacyPouchWeapon || hands === undefined || unknownHands)
            && <small>{legacyPouchWeapon ? 'Retrieve this weapon from your cheek pouch first.' : 'Weapon hands unavailable.'}</small>}
          {attackSummaries.map(summary => <div key={summary.form ?? 'weapon'}>
            <small>{attackLine(summary)}</small>
            {summary.attack.traits.length > 0 && <WeaponTraits attack={summary.attack} entries={entries} />}
          </div>)}
          {(a.criticalNote || typeof a.entry?.data.form_effect === 'string' && a.entry.data.form_effect) && <small>
            {a.criticalNote && <SourceNote source="Cairn Form" note={a.criticalNote} inlineSource={false} />}
            {typeof a.entry?.data.form_effect === 'string' && a.entry.data.form_effect && <SourceNote source="Untamed Form" note={a.entry.data.form_effect} inlineSource={false} />}
          </small>}
          {a.areaAttacks.map(area => <small key={area.name}>{area.name}: DC {area.dc} Reflex, {area.shape}
            <SourceNote source={a.entry?.name === 'Offensive Defense' ? 'Offensive Defense' : 'Suppressing Fire / Primary Target'} note={area.note} /></small>)}
          {capacity > 0 && <small>{loaded}/{capacity} loaded</small>}
          {!upgradeWeapon && !fixed && <Runes
            runes={activeRunes.filter(rune => !activeFreeRunes.some(free => runeName(free.name) === runeName(rune)))}
            entries={entries} options={[]} limit={0} freeRunes={activeFreeRunes}
            source={strengthSource ? `Animal Strength: ${strengthSource.name}`
              : linkedSource ? `Inherited from ${linkedSource.name}` : unarmed ? `Inherited from ${handwrapItem.name}` : undefined} />}
          <AttackUpgrades attack={a} />
          {namedSource !== 'Serithtial' && namedWeaponNotes}
          <MechanicWeaponMods c={c} weapon={w} attack={a} save={save} />
          {attackSummaries.map(summary => summary.attack.range > 0 && !inlineRange(summary) && !summary.attack.traits.some(trait => /^thrown(?:\s|$)/i.test(trait.trim()))
            && <small key={`${summary.form ?? 'weapon'}-range`}>{summary.form ? `${summary.form} range` : 'Range'} {summary.attack.range} feet</small>)}
          {avengerNote && <small>{avengerNote}</small>}
        </div>
        return (
          <details key={w.id} className="gear-card" aria-label={displayName} open={!c.collapsedWeaponIds?.includes(w.id)} onToggle={event => {
            if (event.target !== event.currentTarget) return
            const collapsed = c.collapsedWeaponIds ?? []
            if (event.currentTarget.open === !collapsed.includes(w.id)) return
            save({ collapsedWeaponIds: event.currentTarget.open ? collapsed.filter(id => id !== w.id) : [...collapsed, w.id] })
          }}>
            <summary><strong><EntryDescription name={displayName} entry={witchAttackEntry(c, entries, w.id, a.entry)} className="equipment-name" /></strong>{oversizedAction}
              {attackSummaries.length > 1 ? <div className="weapon-form-summaries">
                {attackSummaries.map(summary => <div key={summary.form ?? 'weapon'}>
                  <small>{attackLine(summary)}</small>
                  {summary.attack.traits.length > 0 && <div onClick={event => event.stopPropagation()}>
                    <WeaponTraits attack={summary.attack} entries={entries} />
                  </div>}
                </div>)}
              </div> : <small>{attackLine(attackSummaries[0])}</small>}
              {(a.criticalNote || typeof a.entry?.data.form_effect === 'string' && a.entry.data.form_effect) && <small>
                {a.criticalNote && <SourceNote source="Cairn Form" note={a.criticalNote} inlineSource={false} />}
                {typeof a.entry?.data.form_effect === 'string' && a.entry.data.form_effect && <SourceNote source="Untamed Form" note={a.entry.data.form_effect} inlineSource={false} />}
              </small>}{capacity > 0 && <small> · {loaded}/{capacity} loaded</small>}</summary>
            <div className="row">{equipControls}</div>
            {!attachmentSource && canAttachWeapon(entries, w) && <label>Attached weapon{' '}
              <select aria-label={`Attached weapon: ${displayName}`} value={w.attachedWeapon ?? ''}
                onChange={event => {
                  const value = event.target.value
                  if (value !== '' && value !== 'Bayonet' && value !== 'Reinforced Stock') return
                  const apply = () => update(w.id, { attachedWeapon: value || undefined })
                  if (w.attachedWeapon && value !== w.attachedWeapon) confirmRemoval(`attached weapon "${w.attachedWeapon}"`, apply)
                  else apply()
                }}>
                <option value="">None</option>
                <option value="Bayonet">Bayonet</option>
                <option value="Reinforced Stock">Reinforced Stock</option>
              </select>
            </label>}
            {capacity > 0 && <div className="row" role="group" aria-label={`${displayName} ammunition`}>
              <button type="button" aria-label={`Decrease ${displayName} loaded ammunition`} disabled={loaded === 0}
                onClick={() => update(w.id, { capacityLoaded: loaded - 1 })}>−</button>
              <span>Loaded {loaded} / {capacity}</span>
              <button type="button" aria-label={`Increase ${displayName} loaded ammunition`} disabled={loaded === capacity}
                onClick={() => update(w.id, { capacityLoaded: loaded + 1 })}>+</button>
            </div>}
            {avengerNote && <small>{avengerNote}</small>}
            {gauntlet && w.id === GAUNTLET.id && <label>Armor gauntlet{' '}
              <select aria-label="Armor gauntlet" value={gauntlet.name} disabled={gauntlet.locked} onChange={(e) => {
                const choice = ARMOR_GAUNTLETS.find((name) => name === e.target.value)
                if (choice) save({ armors: ownedArmors(c, entries).map((armor) => armor.id === gauntlet.armor.id ? { ...armor, gauntlet: choice } : armor) })
              }}>
                {[...ARMOR_GAUNTLETS].sort((a, b) => a.localeCompare(b)).map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>}
            {a.entry && !grantedClanWeapon && <GearAccess c={c} entries={entries} entry={a.entry} save={save} />}
            {attackSummaries.map(summary => <div key={summary.form ?? 'weapon'} className="col">
              {summary.form && <strong>{summary.form}</strong>}
              <div className="gear-stats">
                <span><small>Attack</small><b><TotalBreakdown label={`${displayName} ${summary.form ? `${summary.form} ` : ''}attack`} breakdown={summary.attack.breakdown} signedTotal /></b></span>
                {summary.attack.range > 0 && !inlineRange(summary) && !summary.attack.traits.some(trait => /^thrown(?:\s|$)/i.test(trait.trim()))
                  && <span><small>Range</small><b>{summary.attack.range} feet</b></span>}
                {summary.attack.reach > 0 && <span><small>Reach</small><b>{summary.attack.reach} feet</b></span>}
                {summary.attack.areaAttacks.map(area => <span key={area.name}><small>{area.name}</small>
                  DC {area.dc} Reflex, {area.shape}
                  <SourceNote source={summary.attack.entry?.name === 'Offensive Defense' ? 'Offensive Defense' : 'Suppressing Fire / Primary Target'} note={area.note} /></span>)}
                <span><small>{ABILITY_LABEL[summary.attack.ability]}</small>{signed(summary.attack.mod)}</span>
                <span><small>Proficiency</small>{signed(summary.attack.prof)}</span>
                <span><small>Item</small>{signed(summary.attack.item)}</span>
              </div>
              {attackSummaries.length === 1 && summary.attack.traits.length > 0 && <WeaponTraits attack={summary.attack} entries={entries} />}
            </div>)}
            {!(upgradeWeapon && a.entry && !linkedSource) && <AttackUpgrades attack={a} />}
            {namedWeaponNotes}
            <MechanicWeaponMods c={c} weapon={w} attack={a} save={save} />
            {!!crushing && <small>{`Critical hit: clumsy ${crushing} and enfeebled ${crushing} until the end of your next turn.`}</small>}
            {strength && <>
              {!a.upgrades.some(upgrade => upgrade.name === 'Merciful') && <small>Critical hit: 1d6 persistent bleed (Animal Strength).</small>}
                <SearchableSelect aria-label={`Animal Strength runes: ${displayName}`} value={strengthSelection ?? c.animalStrengthWeapons?.[w.id] ?? ''} onChange={event => {
                  if (event.target.value && !strengthSources.some(source => source.weapon.id === event.target.value)) return
                  const sources = { ...c.animalStrengthWeapons }
                  if (event.target.value) sources[w.id] = event.target.value
                  else delete sources[w.id]
                  save({ animalStrengthWeapons: sources })
                }}>
                  {c.animalStrengthWeapons?.[w.id] && !strengthSource
                    && <option disabled value={c.animalStrengthWeapons[w.id]}>Saved weapon unavailable</option>}
                  {strengthOptions.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}
                </SearchableSelect>
              {c.animalStrengthWeapons?.[w.id] && !strengthSource
                && <small role="status">Saved Animal Strength weapon unavailable; normal unarmed runes apply. Choose another carried weapon.</small>}
            </>}
            {enhanced.runes.includes('Shockwave') && <small>Shockwave splash does not harm you.</small>}
            {haft && <>
              {canBeLivingWeapon(c, entries, haft) && <label>
                <input type="checkbox" aria-label={`Living Weapon: inherited from ${haft.name}`}
                  checked={inheritedLivingWeapon} disabled /> Living Weapon
              </label>}
              {haftStrikerWeapons(c, entries).length > 1 && <span>Haft weapon{' '}
                <SearchableSelect aria-label="Haft weapon" value={haft.id} onChange={(e) => save({ haftStrikerWeaponId: e.target.value })}>
                  {haftStrikerWeapons(c, entries).sort((a, b) => a.name.localeCompare(b.name)).map((weapon) => <option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}
                </SearchableSelect>
              </span>}
            </>}
            {shieldSource ? null : fixed ? enhanced.material && enhanced.material !== 'Orichalcum' && namedSource !== "Hunter's Dawn" ? <div className="gear-runes"><span>Material</span>
              <Material name={enhanced.material} entries={entries} equipment="Weapon"
                source={`Built into ${namedSource || w.name.split(' (')[0]}`} />
            </div> : null : haft ? null : linkedSource ? enhanced.material === 'Orichalcum' ? null
              : <small>Material: {enhanced.material ?? 'Standard'} (from {linkedSource.name})</small>
              : namedSource === "Hunter's Dawn" ? null
            : unarmed ? alloyMaterial : <div className="row">
              {osteoArmament ? null : card ? <small>Material: playing cards</small> : <>
              {grantedClanWeapon ? (enhanced.material ?? 'Orichalcum') === 'Orichalcum' ? null : <div className="gear-runes"><span>Material</span>
                <Material name={enhanced.material ?? 'Orichalcum'} entries={entries} equipment="Weapon" source="Granted Dwarf clan weapon" />
              </div>               : enhanced.material ? enhanced.material === 'Orichalcum' && (livingWeapon || plate || innovation || giantWeapon
                || w.verdantWeapon && canUseVerdantWeapon
                || builtIn?.material === enhanced.material) ? null : <div className="gear-runes"><span>Material{pristineSource && pristineNote
                && <SourceNote source={pristineSource} note={pristineNote} />}</span>
                <Material name={enhanced.material} entries={entries} equipment={plate ? 'Armor' : 'Weapon'}
                  source={plate ? `Inherited from ${plate.name}` : giantWeapon ? 'Granted by Giant Instinct' : innovation ? 'Granted by Weapon Innovation' : livingWeapon ? 'Granted by Living Weapon'
                    : builtIn?.material === enhanced.material ? `Built into ${namedSource}` : 'Granted by Verdant Weapon'}
                  onRemove={livingWeapon || plate || innovation || giantWeapon || w.verdantWeapon && canUseVerdantWeapon || builtIn?.material === enhanced.material ? undefined : () =>
                    update(w.id, { material: undefined, ...(upgradeWeapon ? {} : { runes: w.runes.slice(0, maxPropertyRunes(enhanced.potency, undefined, runeCapacity)) }) })} />
              </div> : plate ? <small>Material: Standard (from {plate.name})</small> : a.entry?.systems.includes('sf2e') ? null : <span>Material{' '}
                <SearchableSelect aria-label="Weapon material" value="" onChange={(e) => {
                  const material = WEAPON_MATERIALS.find((name) => name === e.target.value)
                  if (!material) return
                  update(w.id, { material, ...(upgradeWeapon ? {} : { runes: w.runes.slice(0, maxPropertyRunes(enhanced.potency, material, runeCapacity)) }) })
                }}>
                  <option value="">Add material...</option>
                  {[...WEAPON_MATERIALS].sort((a, b) => a.localeCompare(b)).map((name) => <option key={name}>{name}</option>)}
                </SearchableSelect>
              </span>}
              </>}
              {canUseLivingWeapon && <label><input type="checkbox" aria-label="Living Weapon: grant Shifting rune" checked={!!w.livingWeapon}
                onChange={(e) => update(w.id, { livingWeapon: e.target.checked })} /> Living Weapon</label>}
              {!upgradeWeapon && !lockFundamentals && <Level label="Potency" value={enhanced.potency} options={POTENCY} disabled={!!plate} minimum={plate ? 0 : automatic.potency} format={(n) => (n ? `+${n}` : 'None')}
                onChange={(potency) => update(w.id, { potency, runes: shared.runes
                  .filter(rune => !decaying || runeBaseName(rune) !== 'Decaying' && enhanced.runes.includes(rune))
                  .slice(0, maxPropertyRunes(potency, enhanced.material, runeCapacity)) })} />
              }
              {!upgradeWeapon && !lockFundamentals && <Level label="Striking" value={enhanced.striking} options={POTENCY} disabled={!!plate} minimum={plate ? 0 : automatic.striking} format={(n) => STRIKING_LABEL[n] || 'None'}
                onChange={(striking) => update(w.id, { striking })} />}
            </div>}
            {solarCrystals && a.entry && <div className="gear-runes">
              {solarianCoreCrystals(c.level).potencyGrade && <GearTag name={`Weapon Potency (${solarianCoreCrystals(c.level).potencyGrade})`}
                entry={entries.find(item => item.name === `Weapon Potency (${solarianCoreCrystals(c.level).potencyGrade})` && item.data.item_subcategory === 'Core Crystal')}
                kind="upgrade" source="Core solarian crystal by level" />}
              {solarianCoreCrystals(c.level).strikingGrade && <GearTag name={`Striking (${solarianCoreCrystals(c.level).strikingGrade})`}
                entry={entries.find(item => item.name === `Striking (${solarianCoreCrystals(c.level).strikingGrade})` && item.data.item_subcategory === 'Core Crystal')}
                kind="upgrade" source="Core solarian crystal by level" />}
              <WeaponUpgrades crystals entries={entries} weapon={a.entry} upgrades={w.upgrades ?? []} effectiveUpgrades={a.upgrades}
                limit={solarianCoreCrystals(c.level).potency} onChange={upgrades => update(w.id, { upgrades })} />
            </div>}
            {upgradeWeapon && a.entry && !linkedSource && <>
              {(w.runes.length > 0 || w.potency > 0 || w.striking > 0) && <small role="status">Saved runes are inactive on this weapon.</small>}
              <WeaponUpgrades entries={entries} weapon={a.entry} upgrades={w.upgrades ?? []}
                effectiveUpgrades={a.upgrades}
                limit={typeof a.entry.data.upgrade_slots === 'number' ? Math.max(0, a.entry.data.upgrade_slots - (a.entry.data.raptorial_edge ? 1 : 0)) : undefined}
                raptorialEdgeUpgrade={a.entry.data.raptorial_edge ? {
                  checked: raptorialEdgeImproved(c, w),
                  disabled: getSettings().automaticSfWeaponUpgrades && c.level >= 15,
                  onChange: improved => update(w.id, { raptorialImproved: improved }),
                } : undefined}
                onChange={upgrades => update(w.id, { upgrades })} />
            </>}
            {!fixed && !upgradeWeapon && !(unarmed && handwraps?.kind === 'hardlight' && !iruxiGranted) && <Runes runes={livingWeapon ? shared.runes.filter((rune) => runeName(rune) !== 'Shifting').slice(0, maxPropertyRunes(shared.potency))
              : (forms.length ? w.runes : enhanced.runes).filter((rune) => rune !== blessed && (!freeShifting || rune !== 'Shifting')
                && (!iruxiGranted || runeBaseName(rune) !== 'Astral')
                && (!decaying || runeBaseName(rune) !== 'Decaying')
                && !grantedWeaponRunes.some(grant => runeBaseName(grant) === runeBaseName(rune))
                && !builtIn?.runes.includes(rune))}
              entries={entries} options={unarmed || linkedSource ? [] : eligibleWeaponRunes(entries, { ...w, runes: [...shared.runes, ...enhanced.runes] }).filter((rune) => !freeShifting || rune.name !== 'Shifting')}
              limit={Math.max(0, maxPropertyRunes(enhanced.potency, enhanced.material, runeCapacity) - (builtIn?.runes.length ?? 0) - grantedWeaponRunes.length)} freeRunes={freeRunes}
              source={strengthSource ? `Animal Strength: ${strengthSource.name}` : linkedSource ? `Inherited from ${linkedSource.name}` : inherited ? `Inherited from ${handwrapItem.name}` : undefined}
              onChange={unarmed || linkedSource ? undefined : (runes) => update(w.id, { runes: [
                ...runes, ...w.runes.filter(rune => grantedWeaponRunes.some(grant => runeBaseName(grant) === runeBaseName(rune))),
                ...w.runes.filter(rune => namedSource === 'Debilitating Dart' && runeBaseName(rune) === 'Impactful'
                  && builtIn?.runes.some(built => runeBaseName(built) === 'Impactful')),
                ...w.runes.filter(rune => namedSource === 'Shadowpiercer' && runeBaseName(rune) === 'Astral'
                  && builtIn?.runes.some(built => runeBaseName(built) === 'Astral')),
              ] })} />}
            <div className="row">
              {canUseInnovation && <label><input type="checkbox" aria-label={`Weapon Innovation: ${w.name}`} checked={!!w.inventorInnovation}
                onChange={event => saveWeapons(weapons.map(weapon => ({ ...weapon, inventorInnovation: weapon.id === w.id && event.target.checked })))} /> Weapon Innovation</label>}
              {removeWeapon}
            </div>
            {innovation && <WeaponModifications c={c} weapon={w} entry={a.entry} weaponForms={forms} save={patch => update(w.id, patch)} />}
          </details>
        )
      }).sort((x, y) => (displayNames.get(String(x?.key)) ?? '').localeCompare(displayNames.get(String(y?.key)) ?? ''))}
      <TurretWeapon c={c} entries={entries} save={save} displayOnly={displayOnly} />
    </div>
  )
}

function TurretWeapon({ c, entries, save, displayOnly }: SectionProps & { displayOnly: boolean }) {
  const turret = turretWeapon(c, entries)
  if (!turret) return null
  const { entry, weapon, attack, grade } = turret
  const damageUpgrades = [...upgradeDamageSummary(attack), ...mechanicDamageSummary(c, weapon, attack), ...attack.additionalDamage]
  return <div className="gear-card col" aria-label="Mechanic Turret">
    <strong>Mechanic Turret</strong>
    <small>Attack <TotalBreakdown label="Mechanic Turret attack" breakdown={attack.breakdown} signedTotal />;
      Damage {attack.damage}{damageUpgrades.map(upgrade => <Fragment key={upgrade.source}> + {upgrade.value}
        <SourceNote source={upgrade.source} note={upgrade.note} inlineSource={false} /></Fragment>)}; range {attack.range} feet.</small>
    {attack.traits.length > 0 && <GearTraits traits={attack.traits} entries={entries} system={entry.systems[0]} />}
    <small>{entry.data.weapon_group as string}.</small>
    {displayOnly && <AttackUpgrades attack={attack} />}
    <MechanicWeaponMods c={c} weapon={weapon} attack={attack} save={save} />
    {!displayOnly && <>
      <label>Turret grade{' '}
        <select aria-label="Turret grade" value={grade} onChange={event => {
          const next = TURRET_GRADES.find(option => option === event.target.value)
          if (next) save({ mechanicTurretGrade: next })
        }}>
          {TURRET_GRADES.map(option => <option key={option}>{option}</option>)}
        </select>
      </label>
      <WeaponUpgrades entries={entries} weapon={entry} upgrades={c.mechanicTurretUpgrades ?? []}
        limit={Number(entry.data.upgrade_slots)} onChange={upgrades => save({ mechanicTurretUpgrades: upgrades })} />
    </>}
    <small>Strike from the deployed turret within 150 feet; shares your multiple attack penalty. Cannot Strike while broken.</small>
  </div>
}

function WeaponModifications({ c, weapon, entry, weaponForms = [], save }: {
  c: Character
  weapon: OwnedWeapon
  entry?: ContentEntry
  weaponForms?: ContentEntry[]
  save: (patch: Partial<OwnedWeapon>) => void
}) {
  const slots = weaponModificationSlots(c, weapon, weaponForms[0] ?? entry)
  const optionsForSlot = (slot: WeaponModificationSlot) => {
    const forms = weaponForms.length ? weaponForms : entry ? [entry] : []
    return [...new Map(forms.flatMap(form => weaponModificationOptions(c, weapon, form, slot))
      .map(option => [option.name, option])).values()]
  }
  const settings = weapon.inventorModifications ?? {}
  const set = (patch: Partial<NonNullable<OwnedWeapon['inventorModifications']>>) =>
    save({ inventorModifications: { ...settings, ...patch } })
  const labels: Record<WeaponModificationSlot, string> = {
    initial: 'Initial', breakthrough: 'Breakthrough', revolutionary: 'Revolutionary', manifold: 'Manifold', basic: 'Basic',
  }
  const chosen = slots.flatMap(slot => {
    const name = settings[slot]
    return name ? optionsForSlot(slot).filter(option => option.name === name) : []
  })
  return <div className="col">
    {slots.map(slot => {
      const options = optionsForSlot(slot)
      const choice = settings[slot] ?? ''
      return <label key={slot}>{labels[slot]} modification{' '}
        <select aria-label={`${labels[slot]} weapon modification`} value={choice} onChange={event => {
          if (event.target.value && !options.some(option => option.name === event.target.value)) return
          set({ [slot]: event.target.value || undefined })
        }}>
          <option value="">Choose modification</option>
          {choice && !options.some(option => option.name === choice) && <option value={choice} disabled>{choice} (unavailable)</option>}
          {[...options].sort((a, b) => a.name.localeCompare(b.name)).map(option => <option key={option.name}>{option.name}</option>)}
        </select>
      </label>
    })}
    {chosen.map(option => <small key={option.name}><b>{option.name}:</b> {option.note}</small>)}
    {chosen.some(option => option.name === 'Complex Simplicity')
      && new Set((settings.complexSimplicityTraits ?? []).filter(trait => complexSimplicityTraits().includes(trait))).size < 2
      && <small role="status">Choose two different traits to apply Complex Simplicity.</small>}
    {chosen.some(option => option.name === 'Complex Simplicity')
      && Array.from({ length: 2 }, (_, index) => {
        const traits = settings.complexSimplicityTraits ?? []
        const choices = complexSimplicityTraits()
        const current = traits[index] ?? ''
        return <label key={index}>Complex Simplicity trait {index + 1}{' '}
          <select aria-label={`Complex Simplicity trait ${index + 1}`} value={current} onChange={event => {
            const next = [...traits]
            next[index] = event.target.value
            set({ complexSimplicityTraits: next })
          }}>
            <option value="">Choose trait</option>
            {choices.filter(trait => trait === current || !traits.includes(trait)).sort((a, b) => a.localeCompare(b)).map(trait => <option key={trait}>{trait}</option>)}
          </select>
        </label>
      })}
  </div>
}

function ShieldEquipped({ c, entries, save, shield }: SectionProps & { shield: OwnedShield }) {
  const equipped = equippedShield(c)?.id === shield.id
  const blocked = !equipped && !canEquipShield(c, entries, shield)
  return <label title={blocked ? 'No free hand to equip this shield.' : undefined}>
    <input type="checkbox" aria-label={`Equipped ${shield.name}`} checked={equipped} disabled={blocked}
      onChange={event => {
        if (!event.target.checked || !blocked) save(shieldEquipChange(c, shield, event.target.checked))
      }} /> Equipped
  </label>
}

export function ShieldEquipment({ c, entries, save }: SectionProps) {
  const shields = ownedShields(c)
  if (!shields.length) return null
  return <div className="col">
    {shields.map(shield => <div className="row" key={shield.id}>
      <strong><EntryDescription name={specificMagicItemName(shieldEntry(entries, shield.name), shield.name, true)} entry={shieldEntry(entries, shield.name)}
        className="equipment-name" /></strong><ShieldEquipped c={c} entries={entries} save={save} shield={shield} />
    </div>)}
  </div>
}

export function ShieldAttachment({ c, entries, save, shield }: SectionProps & { shield: OwnedShield }) {
  const current = shield.attachedWeapon
  const options = shieldAttachmentOptions(shield).filter(name => !!weaponEntry(entries, name))
  return <label>Attached weapon{' '}
    <select aria-label={`Attached weapon: ${shield.name}`} value={current?.name ?? ''} onChange={event => {
      const name = options.find(name => name === event.target.value)
      if (event.target.value && !name) return
      if (name === current?.name) return
      const apply = () => {
        const attachedWeapon = name ? { id: newId(), name, potency: 0, striking: 0, runes: [] } : undefined
        save(shieldChange(c, shield, { attachedWeapon }))
      }
      if (current) confirmRemoval(`attached weapon "${current.name}"`, apply)
      else apply()
    }}>
      <option value="">Shield Bash (default)</option>
      {current && !options.some(name => name === current.name) && <option value={current.name} disabled>{current.name} (unavailable)</option>}
      {options.map(name => <option key={name}>{name}</option>)}
    </select>
  </label>
}

function ShieldDurability({ c, entries, shield }: Pick<SectionProps, 'c' | 'entries'> & { shield: OwnedShield }) {
  const stats = shieldStats(shield, c, entries)
  const blessing = blessedShieldBenefit(c, shield, entries)
  return <small>Hardness {stats.hardness}; Hit Points {stats.hp}; Broken Threshold {Math.floor(stats.hp / 2)}.
    {blessing && <>{' '}<SourceNote source="Blessed Shield" note={blessing.rune
      ? `Grants ${blessing.rune} reinforcing rune while this shield is wielded; stronger installed reinforcement remains effective.`
      : 'Matching reinforcing rune or sturdy shield grants +1 Hardness instead.'} /></>}
  </small>
}

export function WarmaskGear({ c, entries }: SectionProps) {
  if (!c.systems.includes('pf2e') || !activeFeatsNamed(c, 'Orc Warmask').length) return null
  const source = warmaskSource(c)
  const feat = activeFeatsNamed(c, 'Orc Warmask')[0]
  const entry = selectedFeatEntry(c, entries, feat.name, feat.sourceId)
  const chosen = source ? `Power source: ${feat.choice} (${source.tradition}). +${warmaskItemBonus(c)} item bonus to ${source.skill} checks.` : undefined
  return <EntryDescription character={c} name="Orc Warmask" choice={feat.choice}
    entry={entry && chosen ? { ...entry, description: `${chosen}\n\n${entry.description}` } : entry}
    descriptionNote={!entry ? chosen : undefined} entries={entries} className="equipment-name" />
}

export function ArmorList({ c, entries, save, part = 'all' }: SectionProps & { part?: 'armor' | 'shield' | 'all' }) {
  const armors = ownedArmors(c, entries)
  const attached = armors.map(armor => armorEntry(c, entries, armor.name, armor.id)).find(entry => entry?.data.attached)
  const saveArmors = (next: OwnedArmor[], extra?: Partial<Character>) => save({ armors: [
    ...(c.armors ?? []).filter(armor => isGrantedArmor(armor.id) && !armors.some(current => current.id === armor.id)),
    ...next.map(armor => {
      const saved = c.armors?.find(saved => saved.id === armor.id)
      const automaticRunes = armor.id === ARMIGER_ARMOR_ID
        ? automaticArmorPropertyRunes(armorEntry(c, entries, armor.name, armor.id)) : []
      const isAutomaticFamily = (rune: string) => automaticRunes.some(automatic => runeBaseName(automatic) === runeBaseName(rune))
      const isInheritorFamily = (rune: string) => scalingBastionRuneFamilies(armor.name).some(family => family === runeBaseName(rune))
      const savedOtherRunes = saved?.runes.filter(rune => !isInheritorFamily(rune)) ?? []
      const visibleOtherRunes = armors.find(current => current.id === armor.id)?.runes.filter(rune => !isInheritorFamily(rune)) ?? []
      const runes = armor.id === BONY_PLATES_ID
        ? saved?.runes ?? []
        : armor.id === ARMIGER_ARMOR_ID
          ? [...armor.runes.filter(rune => !isAutomaticFamily(rune)), ...(saved?.runes.filter(isAutomaticFamily) ?? [])]
          : scalingBastionRuneFamilies(armor.name).length > 0
            ? [...armor.runes.filter(rune => !isInheritorFamily(rune)),
              ...savedOtherRunes.slice(visibleOtherRunes.length), ...(saved?.runes.filter(isInheritorFamily) ?? [])]
          : isAncestralEmbrace(armor.name) && c.level >= 12
            ? [...new Set([...armor.runes.filter(rune => runeBaseName(rune) !== 'Fortification'), ...(saved?.runes ?? [])])]
          : armorEntry(c, entries, armor.name, armor.id)?.systems.includes('sf2e')
            ? saved?.runes ?? armor.runes
          : armor.runes
      return { ...armor, ...(saved && !isGrantedArmor(armor.id)
        && armorEntry(c, entries, saved.name, saved.id)?.systems.includes('sf2e') ? { name: saved.name } : {}),
        ...(saved && armorEntry(c, entries, saved.name, saved.id)?.data.named_armor
          && armorEntry(c, entries, saved.name, saved.id)?.data.automatic_fundamentals === true
          ? { potency: saved.potency, resilient: saved.resilient, material: saved.material } : {}),
        runes, ...(!armor.worn ? { activeJetpack: undefined, activeForceField: false, entrenchMeleeActive: false, inheritorCloakRed: false, immortalSurvivalActive: false } : {}),
        ...(!canWearWithAttachedArmor(armor, attached) ? { worn: saved?.worn ?? armor.worn } : {}) }
    }),
  ], ...(c.activeSpells?.includes(ANCESTRAL_AVATAR) && !next.some(armor => armor.worn && isAncestralEmbrace(armor.name))
    ? spellActiveChange(c, ANCESTRAL_AVATAR, false) : {}), ...extra })
  const update = (id: string, patch: Partial<OwnedArmor>) => saveArmors(armors.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  const shield = c.shield
  const shieldUpgrades = !shield || shieldAllowsUpgrades(shield)
  const grantedShields = ownedShields(c).filter(shield => shield.id !== c.shield?.id)
  const equipped = equippedShield(c)
  const materialOptions = part !== 'armor' && shield && !shield.material ? shieldMaterialOptions(entries, shield, c.systems) : []
  return (
    <div className="col gear-list">
      {part !== 'shield' && <><Search c={c} save={save} entries={entries} kind="armor" label="Add Armor"
        onPick={(e) => saveArmors([...armors, { id: newId(), name: e.name, potency: 0, resilient: 0, runes: [], worn: !armors.some((a) => a.worn) }])} />
      {[...armors].sort((x, y) => x.name.localeCompare(y.name)).map((a) => {
        const entry = armorEntry(c, entries, a.name, a.id)
        const hasShieldBrace = !!entry?.traits.some(trait => trait.toLowerCase() === 'shield brace')
          && !/^(?:(?:Commercial|Tactical|Advanced|Superior|Elite|Ultimate|Paragon) )?Myrmidon Siegebreaker Plate$/i.test(entry.name)
        const braceShields = hasShieldBrace
          ? ownedShields(c).filter(shield => shieldBraceEligible(entries, entry, shield)) : []
        const sf2eArmor = !!entry?.systems.includes('sf2e')
        const originalDisplayEntry = entry?.data.automatic_fundamentals === true && entry.data.named_armor
          ? { ...entry, description: scaledNamedArmorDescription(entry, a) } : entry
        const displayEntry = originalDisplayEntry && sf2eArmor && originalDisplayEntry.data.armor_grade
          ? { ...originalDisplayEntry, description: originalDisplayEntry.description
            .replace(/\bResilient\s*\+\d+\b/gi, '')
            .replace(/\bImprovements\b[\s\S]*?(?=\bArmor Specialization Effects\b|$)/i, '').trim() }
          : originalDisplayEntry
        const displayEntryWithUnit = displayEntry?.name.replace(/^(?:Advanced|Superior|Elite|Ultimate|Paragon) /i, '') === "Drifter's Jacket"
          ? { ...displayEntry, description: [displayEntry.description,
              'Includes a Drift Drive Relay and Maneuvering Unit at no extra cost; neither uses an upgrade slot.'].filter(Boolean).join('\n\n') }
          : displayEntry
        const bonyPlates = a.id === BONY_PLATES_ID
        const body = !!entry?.data.attached
        const wornLocked = body || !!a.strongholdWallActive || !canWearWithAttachedArmor(a, attached)
        const armorTraits = [...new Set((entry?.traits ?? []).filter(trait => !sf2eArmor || !/^resilient\b/i.test(trait)))]
        const displayName = armorDisplayName({ ...a, name: specificMagicItemName(entry, a.name, true) }, entry)
        const labelName = armorDisplayName({ name: a.name }, entry)
        const upgradeSlots = Math.max(0, armorUpgradeSlots(entry)
          + (sf2eArmor && c.heritage === 'Mod Fanatic Android' && entry?.data.upgrades_allowed !== false ? 1 : 0)
          - automaticArmorUpgradeSlotsUsed(entry))
        const runesAllowed = !sf2eArmor && entry?.data.runes_allowed !== false
        const granted = isGrantedArmor(a.id)
        const automaticFundamentals = granted && entry?.data.automatic_fundamentals !== false
          || !!entry?.data.named_armor && entry.data.automatic_fundamentals === true
        const modifications = a.id === INVENTOR_ARMOR_ID ? armorModifications(c) : []
        const capacity = modifications.some(mod => mod.name === 'Rune Capacity') ? 1 : 0
        const namedRuneLimit = namedArmorRuneLimit(entry)
        const runeLimit = (potency: number, material: OwnedArmor['material']) => {
          const limit = maxPropertyRunes(potency, material, capacity > 0)
          return namedRuneLimit === undefined ? limit : Math.min(limit, namedRuneLimit)
        }
        const starfinder = granted && sf2eArmor ? entry : undefined
        const gradeSaveBonus = Number(entry?.data.grade_save_bonus ?? 0)
        const named = namedArmorEnhancements(entry)
        const runePotency = starfinder ? Number(starfinder.data.grade_ac_bonus)
          : automaticFundamentals ? a.potency
          : namedRuneLimit !== undefined ? Math.max(a.potency, named?.potency ?? 0) : a.potency
        const automaticRunes = automaticArmorPropertyRunes(entry)
        const fixedRunes = [...(named?.runes ?? []), ...automaticRunes]
        const automatic = named ?? (granted ? automaticArmorFundamentals(c.level, entry) : { potency: 0, resilient: 0 })
        const strengthRequirement = Number(entry?.data.strength)
        const hasStrengthRequirement = entry?.data.strength !== undefined && entry.data.strength !== null
          && entry.data.strength !== '' && Number.isFinite(strengthRequirement) && strengthRequirement > 0
        const strengthMet = !!entry && armorStrengthMet(c, entry)
        const checkPenalty = parseFloat(String(entry?.data.check_penalty ?? 0)) || 0
        const effectiveCheckPenalty = strengthMet ? 0 : checkPenalty
        const speedPenalty = parseFloat(String(entry?.data.speed_penalty ?? 0)) || 0
        const heavyConstruction = modifications.some(mod => mod.name === 'Heavy Construction')
        const mobility = activeFeatsNamed(c, 'Hellknight Mobility').length > 0 && entry && armorCategory(entry) === 'Heavy'
        const iron = activeFeatsNamed(c, 'Unburdened Iron').length ? 5 : 0
        const enhancer = sf2eArmor && a.worn && upgradeSlots > 0 && (a.upgrades ?? []).slice(0, upgradeSlots)
          .some(id => entries.find(item => item.id === id)?.name === 'Mobility Enhancer') ? 5 : 0
        const effectiveSpeedPenalty = strengthMet && heavyConstruction ? 0
          : Math.min(0, speedPenalty + iron + enhancer + (strengthMet ? mobility ? 10 : 5 : 0))
        const penalty = (value: number) => value === 0 ? '0' : String(value)
        const acRank = entry ? armorProficiencyRank(c, entries, entry) : 0
        const wall = isHighhelmPlate(a.name)
        const inheritor = isInheritorPlate(a.name)
        const immortal = isImmortalBastion(a.name)
        const activations: Record<string, { label: string; active?: boolean; disabled?: boolean; toggle: () => void }> | undefined = wall ? {
          'Activation 1': { label: `${a.strongholdWallActive ? 'Dismiss' : 'Activate'} Highhelm wall`,
            active: a.strongholdWallActive, disabled: !a.strongholdWallActive && (!a.worn || !!a.strongholdWallUsed),
            toggle: () => saveArmors(armors.map(armor => armor.id === a.id
              ? { ...armor, worn: !!a.strongholdWallActive, strongholdWallActive: !a.strongholdWallActive, strongholdWallUsed: true }
              : a.strongholdWallActive ? { ...armor, worn: false } : armor)) },
        } : inheritor ? {
          'Activation 1': { label: `${a.inheritorCloakRed ? 'End' : 'Activate'} red cloak`,
            active: a.inheritorCloakRed, disabled: !a.worn,
            toggle: () => update(a.id, { inheritorCloakRed: !a.inheritorCloakRed, entrenchMeleeActive: false }) },
        } : immortal ? {
          'Activation 1': { label: `${a.immortalSurvivalActive ? 'End' : 'Use'} ${a.name} survival`,
            active: a.immortalSurvivalActive, disabled: !a.worn || !!a.immortalSurvivalUsed && !a.immortalSurvivalActive,
            toggle: () => update(a.id, { immortalSurvivalUsed: true, immortalSurvivalActive: !a.immortalSurvivalActive }) },
          'Activation 2': { label: `Use ${a.name} condition protection`,
            disabled: !a.worn || !!a.immortalConditionUsed,
            toggle: () => update(a.id, { immortalConditionUsed: true }) },
        } : isMountainArmor(a.name) ? {
          'Activation 2': { label: `${a.mountainPoisonImmunityActive ? 'End' : 'Activate'} ${a.name} poison immunity`,
            active: a.mountainPoisonImmunityActive,
            disabled: !a.mountainPoisonImmunityActive && (!a.worn || !!a.mountainPoisonImmunityUsed),
            toggle: () => update(a.id, { mountainPoisonImmunityActive: !a.mountainPoisonImmunityActive,
              ...(!a.mountainPoisonImmunityActive ? { mountainPoisonImmunityUsed: true } : {}) }) },
        } : undefined
        const booster = a.id === INVENTOR_ARMOR_ID && a.worn
          ? speedBonuses(c, entries).find(bonus => /Boosters/.test(bonus.source))
          : undefined
        return (
          <article key={a.id} className="gear-card">
            <header className="row">
              <strong><EntryDescription name={displayName} entry={displayEntryWithUnit} className="equipment-name" /></strong>
              <label><input type="checkbox" aria-label={`Worn ${labelName}`} checked={a.worn} disabled={wornLocked}
                title={body ? 'Attached to character' : wornLocked ? 'Cannot wear armor over attached body armor' : undefined}
                onChange={(e) => {
                  if (wornLocked) return
                  saveArmors(armors.map((x) => ({ ...x, worn: x.id === a.id ? e.target.checked : attached ? x.worn : e.target.checked ? false : x.worn })))
                }} /> Worn</label>
            </header>
            {a.id === INVENTOR_ARMOR_ID && <SearchableSelect label="Innovation armor" aria-label="Inventor armor suit" value={a.name}
              onChange={event => {
                const suit = INVENTOR_SUITS.find(name => name === event.target.value)
                if (suit) save({ inventorArmorSuit: suit })
              }}>
              {[...INVENTOR_SUITS].sort((a, b) => a.localeCompare(b)).map(name => <option key={name}>{name}</option>)}
            </SearchableSelect>}
            {a.id === INVENTOR_ARMOR_ID && <ArmorModifications c={c} entries={entries} save={save} />}
            {c.className === 'Mechanic' && c.systems.includes('sf2e') && <label>
              <input type="checkbox" checked={!!c.mechanicArmorMods?.[a.id]?.magneticLevitators}
                onChange={event => save({ mechanicArmorMods: { ...c.mechanicArmorMods,
                  [a.id]: { ...c.mechanicArmorMods?.[a.id], magneticLevitators: event.target.checked } },
                  ...(!event.target.checked && c.mechanicEnduringMod?.kind === 'armor'
                    && c.mechanicEnduringMod.item === a.id && c.mechanicEnduringMod.mod === 'magneticLevitators'
                    ? { mechanicEnduringMod: undefined } : {}) })} />
              {' '}Magnetic Levitators (Modify)
            </label>}
            {c.className === 'Mechanic' && c.systems.includes('sf2e') && c.level >= 13 && <label>
              <input type="checkbox" aria-label={`Enduring Magnetic Levitators: ${labelName}`}
                checked={c.mechanicEnduringMod?.kind === 'armor' && c.mechanicEnduringMod.item === a.id
                  && c.mechanicEnduringMod.mod === 'magneticLevitators'}
                onChange={event => save(setEnduringMod(c, event.target.checked
                  ? { kind: 'armor', item: a.id, mod: 'magneticLevitators', label: labelName } : undefined))} />
              {' '}Enduring Magnetic Levitators
            </label>}
            {c.mechanicArmorMods?.[a.id]?.magneticLevitators && c.className === 'Mechanic'
              && c.systems.includes('sf2e') && <SourceNote source="Magnetic Levitators"
                note="Land Speed gains hover; Fly Speed 10 feet while worn." />}
            <EnergyNeutralizer c={c} save={save} id={a.id} label={labelName} />
            <ItemTroubleshoot c={c} save={save} kind="armor" id={a.id} label={labelName} />
            {displayEntryWithUnit?.description && !entry?.data.named_armor && <small>{displayEntryWithUnit.description}</small>}
            <NamedArmorAbilities entry={displayEntryWithUnit} inlineSummary activations={activations}
              damageRolls={['Rebounding Breastplate', 'Rebounding Full Plate', 'Rebounding Bastion Plate'].includes(a.name) ? {
                'Kinetic Pulse': { name: 'Kinetic Pulse', damage: { label: 'Damage', dice: 12, sides: 6, type: 'force' },
                  disabled: !a.worn, toggleResult: true },
              } : isIncendiaryArmor(a.name) ? {
                'Living Flame': { name: 'Living Flame', damage: { label: 'Damage', dice: 10, sides: 6, type: 'fire',
                  note: 'DC 40 basic Reflex save' }, disabled: !a.worn && !a.livingFlameActive, toggleResult: true },
              } : undefined} avatar={isAncestralEmbrace(entry?.name) ? {
              active: !!c.activeSpells?.includes(ANCESTRAL_AVATAR) && a.worn,
              disabled: !a.worn,
              toggle: () => save(spellActiveChange(c, ANCESTRAL_AVATAR, !c.activeSpells?.includes(ANCESTRAL_AVATAR))),
            } : undefined} />
            {isBastionNamedArmor(a.name) && <div className="row">
              <button type="button" className={`spell-action-button${a.entrenchMeleeActive ? ' on' : ''}`}
                aria-label={`${a.entrenchMeleeActive ? 'End' : 'Activate'} Entrench Melee: ${labelName}`}
                aria-pressed={!!a.entrenchMeleeActive} disabled={!a.worn || !acRank || !!a.inheritorCloakRed}
                onClick={() => update(a.id, { entrenchMeleeActive: !a.entrenchMeleeActive })}><ActionIcon actions="Single Action" /></button>
              <span>Entrench Melee</span>
              {immortal && a.entrenchMeleeActive && <span>10 temporary HP until your next turn</span>}
              {immortal && a.immortalSurvivalActive && <span>1 HP; 100 temporary HP until your next turn</span>}
              {(a.strongholdWallUsed || a.immortalSurvivalUsed || a.immortalConditionUsed) && <button type="button"
                onClick={() => update(a.id, { strongholdWallUsed: false, immortalSurvivalUsed: false, immortalConditionUsed: false })}>Daily preparations</button>}
            </div>}
            {entry?.data.upgrades_allowed === false && <small>Armor upgrades cannot be installed on this armor.</small>}
            {entry && <GearAccess c={c} entries={entries} entry={entry} save={save} />}
            {entry && armorTraits.length > 0 && <GearTraits traits={armorTraits} entries={entries} system={entry.systems[0]} />}
            {entry?.traits.some(trait => trait.toLowerCase() === 'implacable') && <small>
              Implacable: the first time each turn an action would be lost to stunned or paralyzed, Step or Take Cover instead.
            </small>}
            {hasShieldBrace && <div className="row">
              <label>Shield Brace
                <select aria-label={`Shield Brace: ${labelName}`} value={braceShields.some(shield => shield.id === a.shieldBraceShieldId)
                  ? a.shieldBraceShieldId : ''} onChange={event => {
                    const selected = braceShields.find(shield => shield.id === event.target.value)
                    saveArmors(armors.map(armor => armor.id === a.id
                      ? { ...armor, shieldBraceShieldId: selected?.id } : armor),
                    selected ? shieldEquipChange(c, selected, true) : {})
                  }}>
                  <option value="">No shield installed</option>
                  {braceShields.map(shield => <option key={shield.id} value={shield.id}>{shield.name}</option>)}
                </select>
              </label>
              <small>Install or remove takes 10 minutes. Installed Compact or Retractable shield uses no hand; raising it requires a free hand or one holding a light object.</small>
            </div>}
            {entry && (
              <div className="gear-stats">
                <span><small>Armor Class</small><b>{String(entry.data.ac ?? '—')}</b></span>
                <span><small>Dexterity cap</small>{String(entry.data.dex_cap ?? '—')}</span>
                <span><small>AC proficiency</small>{RANKS[acRank]} ({signed(proficiencyBonus(acRank, c.level))})</span>
                <span><small>Check</small>{hasStrengthRequirement
                  ? `${penalty(checkPenalty)} (${penalty(effectiveCheckPenalty)})`
                  : penalty(checkPenalty)}</span>
                <span><small>Strength</small>{hasStrengthRequirement
                  ? `${signed(strengthRequirement)} (${strengthMet ? 'met' : 'not met'})` : '—'}</span>
                <span><small>Category</small>{String(entry.data.armor_category ?? armorCategory(entry))}</span>
                <span><small>Bulk</small>{String(armorBulk(c, entry, a.worn) ?? '—')}
                  {armorBulk(c, entry, a.worn) !== entry.data.bulk
                    && <SourceNote source="Walking Armory" note="Armor Bulk reduced by 1, minimum 1, because your Strength meets its requirement." />}</span>
                <span><small>Group</small>{String(entry.data.armor_group || '—')}</span>
                <span><small>Speed</small>{hasStrengthRequirement
                  ? `${penalty(speedPenalty)} ft (${penalty(effectiveSpeedPenalty)} ft)`
                  : `${penalty(speedPenalty)} ft`}</span>
                {booster && <span><small>{booster.source.replace(' (status)', '')}</small>{signed(booster.feet)} ft status</span>}
                {starfinder && <span><small>AC increase</small>+{Number(entry.data.grade_ac_bonus)}</span>}
                {sf2eArmor && entry?.data.armor_grade && Number.isFinite(gradeSaveBonus) && gradeSaveBonus > 0
                  && <span><small>Resilient</small>+{gradeSaveBonus}</span>}
              </div>
            )}
            <div className="row">
              {entry?.data.named_armor_material === 'Keep Stone' ? <div className="gear-runes"><span>Material:</span>
                <Material name="Keep Stone" entries={entries} equipment="Armor" source="Built into armor" />
              </div> : isHighhelmPlate(a.name) || isLibraryRobes(a.name) || entry?.data.named_armor_material === 'Orichalcum' ? null
                : entry?.data.named_armor_material ? <span>Material: {String(entry.data.named_armor_material)}</span>
                : a.material === 'Orichalcum' && (body || !!entry?.data.fixed_material || isWoodArmor(entries, a)) ? null
                : a.material ? <div className="gear-runes"><span>Material</span>
                <Material name={a.material} entries={entries} equipment="Armor" source={body ? 'Attached to character'
                  : typeof entry?.data.granted_by === 'string' ? entry.data.granted_by : 'Locked by Wood armor group'}
                  onRemove={body || !!entry?.data.fixed_material || isWoodArmor(entries, a) ? undefined : () =>
                    update(a.id, { material: undefined, runes: a.runes.slice(0, runeLimit(a.potency, undefined)) })} />
              </div> : body || sf2eArmor ? null : <span>Material{' '}
                <SearchableSelect aria-label="Armor material" value="" onChange={(e) => {
                  if (isWoodArmor(entries, a)) return
                  const material = ARMOR_MATERIALS.find((name) => name === e.target.value)
                  if (!material) return
                  update(a.id, { material, runes: a.runes.slice(0, runeLimit(a.potency, material)) })
                }}>
                  <option value="">Add material...</option>
                  {[...ARMOR_MATERIALS].sort((a, b) => a.localeCompare(b)).map((name) => <option key={name}>{name}</option>)}
                </SearchableSelect>
              </span>}
              {sf2eArmor && entry && (upgradeSlots > 0 || !!a.upgrades?.length || automaticSpecificArmorUpgrades(c, entries, entry).length > 0)
                  && entry.data.upgrades_allowed !== false
                && <ArmorUpgrades entries={entries} upgrades={a.upgrades ?? []}
                  limit={upgradeSlots} worn={a.worn} activeJetpack={a.activeJetpack}
                    energyShieldingTypes={a.energyShieldingTypes}
                    energizedSpikesEnergy={a.energizedSpikesEnergy}
                    automaticUpgrades={automaticSpecificArmorUpgrades(c, entries, entry)} armorName={a.name}
                  onToggleJetpack={id => update(a.id, { activeJetpack: a.activeJetpack === id ? undefined : id })}
                    onEnergyShieldingTypeChange={(id, type) => {
                      const energyShieldingTypes = { ...(a.energyShieldingTypes ?? {}) }
                      if (type) energyShieldingTypes[id] = type
                      else delete energyShieldingTypes[id]
                      update(a.id, { energyShieldingTypes })
                    }}
                    onEnergizedSpikesEnergyChange={energy => update(a.id, { energizedSpikesEnergy: energy })}
                    onChange={upgrades => {
                      const energyShieldingTypes = { ...(a.energyShieldingTypes ?? {}) }
                      for (const id of Object.keys(energyShieldingTypes))
                        if (!upgrades.includes(id)) delete energyShieldingTypes[id]
                      const automatic = automaticSpecificArmorUpgrades(c, entries, entry)
                      const hasEnergizedSpikes = upgrades.some(id => entries.find(candidate => candidate.id === id)?.name
                        .replace(/\s*\([^)]*\)$/, '') === 'Energized Spikes')
                        || automatic.some(item => item.name.replace(/\s*\([^)]*\)$/, '') === 'Energized Spikes')
                      update(a.id, { upgrades, energyShieldingTypes,
                      energizedSpikesEnergy: hasEnergizedSpikes ? a.energizedSpikesEnergy : undefined,
                      ...(!upgrades.includes(a.activeJetpack ?? '') && a.activeJetpack !== AUTOMATIC_JETPACK_ID
                        ? { activeJetpack: undefined } : {}),
                      ...(a.activeForceField && !armorUpgradeEntries(c, entries, { ...a, upgrades })
                          .some(upgrade => forceFieldStats(upgrade)) ? { activeForceField: false } : {}) })
                    }} />}
              {runesAllowed && !starfinder && !automaticFundamentals && <Level label="Potency" value={a.potency} options={automatic.potency > 3 ? [...POTENCY, automatic.potency] : POTENCY} minimum={automatic.potency} format={(n) => (n ? `+${n}` : 'None')}
                onChange={(potency) => update(a.id, { potency, runes: a.runes.slice(0, runeLimit(potency, a.material)) })} />}
              {runesAllowed && !starfinder && !automaticFundamentals && <Level label="Resilient" value={a.resilient} options={POTENCY} minimum={automatic.resilient} format={(n) => ['None', 'Resilient', 'Greater', 'Major'][n]}
                onChange={(resilient) => update(a.id, { resilient })} />}
            </div>
            {runesAllowed ? <><Runes runes={bonyPlates ? [] : a.runes.filter(rune => !fixedRunes.includes(rune)
              && (a.id !== ARMIGER_ARMOR_ID || !automaticRunes.some(fixed => runeBaseName(fixed) === runeBaseName(rune)))
              && !scalingBastionRuneFamilies(a.name).some(family => family === runeBaseName(rune)))} entries={entries}
              freeRunes={[...(named?.runes.map(name => ({ name, source: `Built into ${a.name}` })) ?? []),
                ...automaticRunes.map(name => ({ name, source: bonyPlates ? 'Granted by Bony Plates'
                  : `Granted by ${String(entry?.data.granted_by ?? a.name)}` }))]}
              options={bonyPlates ? [] : propertyRunes(entries, 'Armor').filter(rune => !fixedRunes.includes(rune.name)
                && (a.id !== ARMIGER_ARMOR_ID || !automaticRunes.some(fixed => runeBaseName(fixed) === runeBaseName(rune.name)))
                && !scalingBastionRuneFamilies(a.name).some(family => family === runeBaseName(rune.name))
                && (a.id !== BONY_PLATES_ID || !BONY_PLATE_RUNE_FAMILIES.some(base => base === runeBaseName(rune.name))))}
              limit={bonyPlates ? 0 : Math.max(0, runeLimit(runePotency, a.material) - (named?.runes.length ?? 0)
                - (scalingBastionRuneFamilies(a.name).length ? automaticRunes.length : 0))}
              onChange={bonyPlates ? undefined : (runes) => update(a.id, { runes: [...(named?.runes ?? []), ...runes] })} /></>
              : !sf2eArmor && <small>Armor runes cannot be etched onto this shell.</small>}
            {!granted && <button type="button" className="spell-remove" aria-label={`Remove ${labelName}`} title="Remove"
              onClick={() => confirmRemoval(`armor "${labelName}"`, () => saveArmors(armors.filter((x) => x.id !== a.id),
                { ...(c.mechanicEnduringMod?.kind === 'armor' && c.mechanicEnduringMod.item === a.id ? setEnduringMod(c) : {}),
                  ...clearItemGlitching(c, 'armor', a.id) }))}>×</button>}
          </article>
        )
      })}</>}
      {part !== 'armor' && <>{shield ? (
        <article className="gear-card">
          <header className="row">
            <strong><EntryDescription name={specificMagicItemName(shieldEntry(entries, shield.name), shield.name, true)} entry={shieldEntry(entries, shield.name)}
              className="equipment-name" /></strong>
            <ShieldEquipped c={c} entries={entries} save={save} shield={shield} />
            <label title={shieldParagonActive(c) ? 'Always raised by Shield Paragon' : undefined}>
              <input type="checkbox" checked={equipped?.id === shield.id && shieldRaised(c)}
                disabled={equipped?.id !== shield.id || shieldParagonActive(c)
                  || !shieldRaised(c) && !canRaiseShield(c, entries, shield)}
                onChange={(e) => { if (!shieldParagonActive(c)) save(shieldRaisedChange(c, e.target.checked, entries)) }} />
              {isBucklerShield(shield.name) ? 'Raise Buckler' : 'Raised'} (+{shieldAcBonus(c, entries)} AC)</label>
          </header>
          <ShieldAttachment c={c} entries={entries} save={save} shield={shield} />
          {shieldUpgrades && <div className="row">
            {shield.material ? <div className="gear-runes"><span>Material</span>
              <GearTag name={shield.material.name} kind="material"
                entry={entries.find(entry => entry.kind === 'item' && entry.name === shield.material?.name)}
                onRemove={() => save({ shield: { ...shield, material: undefined } })} />
            </div> : <SearchableSelect label="Material" aria-label="Shield material" value=""
              optionLevel={value => materialOptions.find(option => option.id === value)?.level} onChange={event => {
              const entry = materialOptions.find(option => option.id === event.target.value)
              if (entry) save({ shield: { ...shield, material: shieldMaterial(entry) } })
            }}>
              <option value="">Add material...</option>
              {materialOptions.map(entry => <option value={entry.id} key={entry.id}>{entry.name} (Level {entry.level})</option>)}
            </SearchableSelect>}
            <ShieldRune rune={shield.reinforcingRune} entries={entries}
              granted={blessedShieldBenefit(c, shield, entries)?.rune}
              locked={championBlessings(c).includes('Blessed Shield')}
              onChange={reinforcingRune => save({ shield: { ...shield, reinforcingRune } })} />
          </div>}
          {shieldUpgrades && !shield.material && !materialOptions.length && <small>No matching materials available. Sync Archives of Nethys content if needed.</small>}
          {shieldUpgrades && shield.material && (shield.material.hardness === undefined || shield.material.hp === undefined)
            && <small>Material durability unavailable; base shield durability is used.</small>}
          {shieldUpgrades && shield.material && <SourceNote source="Shield material"
            note="Material special effects are not applied automatically." />}
          <div className="row">
            <label>Damage <input type="number" min={0} value={shield.damage} onChange={(e) => save({ shield: { ...shield, damage: Math.max(0, +e.target.value || 0) } })} /></label>
            {isScaleOfIgroonShield(shield.name) && <button type="button"
              aria-label="Recover 4 HP (start of wielder’s turn)" title="Recover 4 HP (start of wielder’s turn)"
              disabled={equipped?.id !== shield.id || shield.damage <= 0}
              onClick={() => save({ shield: { ...shield, damage: Math.max(0, shield.damage - 4) } })}>
              +4 HP
            </button>}
          </div>
          {shield.name === SCALE_OF_IGROON_FORTRESS && !activeFeatsNamed(c, 'Great Shield Mastery').length && <label>
            <input type="checkbox" aria-label="Taking Cover behind Fortress Shield"
              checked={equipped?.id === shield.id && !!shield.takingCover}
              disabled={equipped?.id !== shield.id || !shieldRaised(c)}
              onChange={event => save(shieldChange(c, shield, { takingCover: event.target.checked }))} />
            Take Cover (+1 AC)
          </label>}
          <ShieldDurability c={c} entries={entries} shield={shield} />
          <NamedArmorAbilities entry={shieldEntry(entries, shield.name)} />
          <button type="button" className="spell-remove" aria-label={`Remove ${shield.name}`} title="Remove"
            onClick={() => confirmRemoval(`shield "${shield.name}"`, () => save({ shield: undefined }))}>×</button>
        </article>
      ) : (
        <Search c={c} save={save} entries={entries} kind="shield" label="Add Shield"
          onPick={(e) => {
            const added: OwnedShield = {
              id: newId(), name: e.name, raised: false, damage: 0,
              hardness: parseFloat(String(e.data.hardness)) || 0, hp: parseFloat(String(e.data.hp)) || 0,
            }
            save(shieldEquipChange(c, added, canEquipShield(c, entries, added)))
          }} />
      )}
      {grantedShields.map(grantedShield => <article className="gear-card" key={grantedShield.id}>
        <header className="row"><strong><EntryDescription name={grantedShield.name}
          entry={entries.find(entry => entry.kind === 'shield' && entry.name === grantedShield.name)} className="equipment-name" /></strong>
          {grantedShield.id !== 'granted-shield:chitinous' && <ShieldEquipped c={c} entries={entries} save={save} shield={grantedShield} />}
          <label><input type="checkbox" checked={equipped?.id === grantedShield.id && shieldRaised(c)}
            disabled={equipped?.id !== grantedShield.id || shieldParagonActive(c)
              || !shieldRaised(c) && !canRaiseShield(c, entries, grantedShield)}
            onChange={event => { if (!shieldParagonActive(c)) save(shieldRaisedChange(c, event.target.checked, entries)) }} />
            {grantedShield.id === 'granted-shield:chitinous' ? 'Raise Chitinous Shield'
              : isBucklerShield(grantedShield.name) ? 'Raise Buckler' : 'Raised'} (+{shieldAcBonus(c, entries)} AC)</label>
        </header>
        {grantedShield.id !== 'granted-shield:chitinous' && <ShieldAttachment c={c} entries={entries} save={save} shield={grantedShield} />}
        <ShieldDurability c={c} entries={entries} shield={grantedShield} />
        {grantedShield.id !== 'granted-shield:chitinous' && <ShieldRune rune={grantedShield.reinforcingRune} entries={entries}
          granted={blessedShieldBenefit(c, grantedShield, entries)?.rune}
          locked={grantedShield.id === 'granted-shield:inventor' || championBlessings(c).includes('Blessed Shield')}
          onChange={reinforcingRune => save(shieldChange(c, grantedShield, { reinforcingRune }))} />}
        <label>Damage <input type="number" min={0} value={grantedShield.damage}
          onChange={event => save(shieldChange(c, grantedShield, { damage: Math.max(0, +event.target.value || 0) }))} /></label>
      </article>)}</>}
    </div>
  )
}

function ArmorModifications({ c, save }: SectionProps) {
  const slots = armorModificationSlots(c)
  const settings = c.inventorArmorModifications ?? {}
  const selected = armorModifications(c)
  const has = (name: string) => selected.some(mod => mod.name === name)
  const set = (patch: Partial<NonNullable<Character['inventorArmorModifications']>>) =>
    save({ inventorArmorModifications: { ...settings, ...patch } })
  const initialResistance = selected.filter(mod => ['Harmonic Oscillator', 'Metallic Reactance', 'Phlogistonic Regulator', 'Otherworldly Protection'].includes(mod.name))
  const physicalResistance = selected.filter(mod => ['Dense Plating', 'Layered Mesh', 'Tensile Absorption'].includes(mod.name))
  const target = (label: string, field: 'enhanced' | 'incredible', options: typeof selected) => options.length > 1
    ? <label>{label}{' '}<select aria-label={label} value={settings[field] ?? ''} onChange={event => {
      if (event.target.value && !options.some(mod => mod.name === event.target.value)) return
      set({ [field]: event.target.value || undefined })
    }}><option value="">Choose modification</option>{[...options].sort((a, b) => a.name.localeCompare(b.name)).map(mod => <option key={mod.name}>{mod.name}</option>)}</select></label> : null
  const labels: Record<ArmorModificationSlot, string> = {
    initial: 'Initial', breakthrough: 'Breakthrough', revolutionary: 'Revolutionary', manifold: 'Manifold', basic: 'Basic',
  }
  return <div className="col">
    {slots.map(slot => {
      const options = armorModificationOptions(c, slot)
      const choice = settings[slot] ?? ''
      return <label key={slot}>{labels[slot]} modification{' '}
        <select aria-label={`${labels[slot]} armor modification`} value={choice} onChange={event => {
          if (event.target.value && !options.some(mod => mod.name === event.target.value)) return
          set({ [slot]: event.target.value || undefined })
        }}>
          <option value="">Choose modification</option>
          {choice && !options.some(mod => mod.name === choice) && <option value={choice} disabled>{choice} (unavailable)</option>}
          {[...options].sort((a, b) => a.name.localeCompare(b.name)).map(mod => <option key={mod.name}>{mod.name}</option>)}
        </select>
      </label>
    })}
    {has('Enhanced Resistance') && target('Enhanced resistance', 'enhanced', initialResistance)}
    {has('Incredible Resistance') && target('Incredible resistance', 'incredible', physicalResistance)}
    {has('Otherworldly Protection') && <label><input type="checkbox" checked={!!settings.voidHealing}
      onChange={event => set({ voidHealing: event.target.checked })} /> Void healing</label>}
    {c.className === 'Inventor' && <label><input type="checkbox" checked={!!settings.overdrive}
      onChange={event => set({ overdrive: event.target.checked })} /> Overdrive active</label>}
    {selected.filter(mod => mod.note).map(mod => <small key={mod.name}><b>{mod.name}:</b> {mod.note}</small>)}
  </div>
}

const WITCH_ATTACK_FEATS: Record<string, { choice?: string; names: string[] }> = {
  nails: { choice: 'Eldritch Nails', names: ["Wild Witch's Armaments"] },
  jaws: { choice: 'Iron Teeth', names: ["Wild Witch's Armaments"] },
  hair: { choice: 'Living Hair', names: ["Syu Tak-Nwa's Deadly Hair", "Syu Tak-Nwa's Hexed Locks", "Demon's Hair"] },
  quills: { names: ["Wild Witch's Armaments"] },
}

function witchAttackFeats(c: Character, id: string) {
  const rule = id.startsWith('witch:') ? WITCH_ATTACK_FEATS[id.split(':')[1]] : undefined
  if (!rule) return []
  return [
    ...(rule.choice ? activeFeatsNamed(c, "Witch's Armaments").filter(feat => feat.choice === rule.choice) : []),
    ...rule.names.flatMap(name => activeFeatsNamed(c, name)),
  ]
}

function witchAttackEntry(c: Character, entries: ContentEntry[], id: string, entry?: ContentEntry) {
  if (!entry) return entry
  const sources = witchAttackFeats(c, id).map(feat => selectedFeatEntry(c, entries, feat.name, feat.sourceId))
    .filter((source): source is ContentEntry => !!source?.description)
  if (!sources.length) return entry
  return { ...entry, description: sources.map(source => `**${source.name}**\n\n${source.description}`).join('\n\n---\n\n') }
}
