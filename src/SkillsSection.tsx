import { resistances,
  ABILITY_LABEL, ARMOR_GROUPS, RANKS, WEAPON_GROUPS, abilityMod, activeFeatsNamed, animalSkinBenefits, armorRanks, weaponRanks, backgroundSkills, freeHeartBackground, autoClassSkills, canIncreaseTo, classFeatures, featEffectChange, featLores, isFeatEffectActive, senses, movementSpeeds, speedBonuses, ragingAthleteBenefits, magneticLevitatorsActive, armorSpecialization,
  ancestralSkills, trainedFeatLores, FAVORED_TERRAINS, INITIATE_TRAINING, MASTERMIND_SKILLS, favoredTerrainBenefits, favoredTerrainChange, selectedFavoredTerrain, selectedSubclass, featTakenLevel, hitPointBonuses, isPioneerHuman, maxHp, terrainExpertiseBenefits,
  proficiencyBonus, untrainedSkillProficiency, ranksAt, skillDownload, normalizeLongevitySkills, normalizeConditionalSkillChoices, longevityExpertLevel, LONGEVITY_EXPERT_SLOT, officerEducationSlots, mechanicIngenuitySlots, armorSaveBonus, armorClassBreakdown, savingThrowBreakdown, perceptionItemBonus, perceptionCircumstance, researchedSpellResistance, savingThrowCircumstance, signed, skillIncreaseLevels, skillRankBudget, statDefs, isSpellActive, oakenResilience, clanDaggerFiligreeBonus, starfinderArmorPenalties, testSubjectAdaptation, ownedWeapons, weaponEquipped, installedWeaponUpgrades, type SectionProps,
} from './builder'
import { killerBeltBonus, wildwoodInkBonus, tradecraftTattooBonus, giantWeaponClumsy } from './builder'
import { ShieldEquipment, WeaponList } from './GearSection'
import { SourceNote } from './Info'
import { droneCustomizationSlots, droneStats } from './drone'
import { TotalBreakdown } from './TotalBreakdown'
import { warmaskSource, warmaskItemBonus } from './warmask'
import { armorModifications, armorOverdriveActive } from './inventorArmor'
import { INVENTOR_ARMOR_ID } from './grantedArmor'
import { wornArmor } from './builder'
import { confirmRemoval } from './confirmRemoval'
import { getSettings } from './settings'
import { skillRankAllocations, skillRankRequirements, skillTokenPayment, skillTokenPurchase, skillTokenState } from './builder'
import { characterHeritages } from './heritages'
import { divineIntercessionWeaknesses, hasDivineIntercession } from './divineIntercessions'

const RANK_LETTERS = ['T', 'E', 'M', 'L']
const COMMON_LORES = [...new Set([
  // https://2e.aonprd.com/Skills.aspx?ID=41
  'Academia', 'Accounting', 'Architecture', 'Art', 'Astronomy', 'Carpentry', 'Circus', 'Driving',
  'Engineering', 'Farming', 'Fishing', 'Fortune-Telling', 'Games', 'Genealogy', 'Gladiatorial',
  'Guild', 'Heraldry', 'Herbalism', 'Hunting', 'Labor', 'Legal', 'Library', 'Military',
  'Abadar', 'Erastil', 'Iomedae', 'Demon', 'Giant', 'Vampire', 'Astral Plane', 'Heaven', 'Outer Rifts',
  'Hellknights', 'Pathfinder Society', 'Absalom', 'Magnimar', 'Mountain', 'River',
  'Alcohol', 'Baking', 'Butchering', 'Cooking', 'Tea', 'Mercantile', 'Midwifery', 'Milling',
  'Mining', 'Piloting', 'Sailing', 'Scouting', 'Scribing', 'Stabling', 'Tanning', 'Theater',
  'Underworld', 'Warfare',
  // https://2e.aonsrd.com/skills/9-lore
  'Corporate', 'Piracy', 'Necrovite', 'Apostae', 'Heaven',
].map(topic => `${topic} Lore`))].sort((a, b) => a.localeCompare(b))

const RESISTANCE_NOTES: Record<string, string> = {
  'Poison Resistance': '+1 status bonus to saving throws against poisons.',
  'Harden Flesh': 'Physical resistance except against adamantine. Lasts until the beginning of your next turn; clear the active toggle when it ends.',
  'Heart of the Kaiju': "Physical resistance applies only while in kaiju form. This toggle does not apply the form's other statistics.",
  'Primal Aegis': 'Resistance equals your positive Wisdom modifier.',
  'Radiation Resistant': 'Poison resistance applies only to damage from radiation effects.',
}

function FeatEffectToggle({ c, save, name, label, title, ariaLabel = label }: Pick<SectionProps, 'c' | 'save'> & {
  name: string; label: string; title: string; ariaLabel?: string
}) {
  if (!activeFeatsNamed(c, name).length || name === 'Favored Terrain' && activeFeatsNamed(c, 'Terrain Master').length) return null
  return <label title={title}><input type="checkbox" aria-label={ariaLabel} checked={isFeatEffectActive(c, name)}
    onChange={(event) => save(featEffectChange(c, name, event.target.checked))} /> {label}</label>
}

function ProficiencyBadges({ groups, ranks, labels }: { groups: readonly string[]; ranks: Record<string, number>; labels?: Record<string, string> }) {
  return (
    <div className="prof-badges">
      {[...groups].sort((a, b) => a.localeCompare(b)).map((group) => (
        <span key={group} title={RANKS[ranks[group]]}>
          <b className={`prof-badge${ranks[group] > 0 ? ' trained' : ''}`}>{ranks[group] > 0 ? RANK_LETTERS[ranks[group] - 1] : 'U'}</b>
          {labels?.[group] ?? group}
        </span>
      ))}
    </div>
  )
}

export function ArmorProficiency({ c, entries }: Pick<SectionProps, 'c' | 'entries'>) {
  return <ProficiencyBadges groups={ARMOR_GROUPS} ranks={armorRanks(c, entries)} />
}

export function SkillsSummary({ c, entries }: Pick<SectionProps, 'c' | 'entries'>) {
  return <summary className="character-section-summary">
    <strong>Skills</strong>
    <span aria-label="Skill allocations">{skillRankAllocations(c, entries)
      .map(({ rank, used, total }) => `${used}/${total} ${rank}`).join(', ')}</span>
  </summary>
}

export function RageToggle({ c, save, summary = false }: Pick<SectionProps, 'c' | 'save'> & { summary?: boolean }) {
  if (c.className !== 'Barbarian' && !activeFeatsNamed(c, 'Barbarian Dedication').length) return null
  const toggle = <label><input type="checkbox" aria-label={summary ? 'Rage active' : 'Rage active (defense)'} checked={!!c.raging}
    onChange={(event) => save({ raging: event.target.checked })} /> Rage active</label>
  return summary
    ? <span className="combat-summary-toggles" onClick={(event) => event.stopPropagation()}>{toggle}</span>
    : toggle
}

export function SkillsSection({ c: original, entries, save: saveOriginal, part = 'skills' }: SectionProps & { part?: 'skills' | 'offense' | 'defense' }) {
  const editingSkills = part === 'skills'
  const c = editingSkills ? normalizeConditionalSkillChoices(normalizeLongevitySkills(original), entries) : original
  const save: SectionProps['save'] = patch => saveOriginal(c === original ? patch : {
    feats: c.feats, skillPicks: c.skillPicks, skillIncreases: c.skillIncreases, warmask: c.warmask, lores: c.lores, ...patch,
  })
  const stats = statDefs(c)
  const klass = editingSkills ? entries.find((e) => e.kind === 'class' && e.name === c.className) : undefined
  const bg = editingSkills ? entries.find((e) => e.kind === 'background' && e.name === c.background) : undefined
  const extraBackgroundSkills = editingSkills ? backgroundSkills(freeHeartBackground(c, entries)) : []
  const permanentRanks = ranksAt(c, entries)
  const heritages = new Set(characterHeritages(c, entries).map(heritage => heritage.name))
  const downloaded = skillDownload(c, entries)
  const ranks = downloaded ? { ...permanentRanks, [downloaded.skill]: Math.max(permanentRanks[downloaded.skill] ?? 0, downloaded.rank) } : permanentRanks
  const trainedLores = trainedFeatLores(c)
  const lores = editingSkills ? [...new Set([...c.lores.map((l) => l.name), ...featLores(c, entries), ...trainedLores.map(grant => grant.name), ...autoClassSkills(c, entries).filter((s) => / lore$/i.test(s)), ...activeFeatsNamed(c, "Officer's Medical Training").flatMap(feat => feat.choice && /.+\s+lore$/i.test(feat.choice) && (ranks[feat.choice] ?? 0) > 0 ? [feat.choice] : []), ...backgroundSkills(bg).filter((s) => /lore$/i.test(s)), ...extraBackgroundSkills.filter(s => /lore$/i.test(s))])] : []
  const picks = c.skillPicks ?? []
  const budget = editingSkills ? skillRankBudget(c, entries) : { trained: 0, expert: 0, master: 0, legendary: 0 }
  const remaining = budget.trained
  const downloadFeat = activeFeatsNamed(c, 'Skill Download')[0]
  const downloadRank = c.level >= 17 ? 3 : c.level >= 9 ? 2 : 1
  const ancestrySkills = editingSkills ? ancestralSkills(c, entries) : []
  const heritageSkills = editingSkills && isPioneerHuman(c) ? ['Survival'] : []
  const grantedTraining = [...ancestrySkills, ...heritageSkills]
  const fixed = new Set(editingSkills ? [...autoClassSkills(c, entries), ...backgroundSkills(bg), ...extraBackgroundSkills, ...grantedTraining] : [])
  const terrainExpertise = terrainExpertiseBenefits(c)
  const wasteland = activeFeatsNamed(c, 'Wasteland Warrior').length > 0
  const hazardNote = 'Disable environmental hazards using Survival instead of Athletics or Thievery. '
    + ((ranks.Survival ?? 0) >= 3
      ? 'Master Survival satisfies Athletics or Thievery requirements of Master or lower, but not Legendary.'
      : 'Check the hazard\'s proficiency requirements. At Master Survival, you qualify for requirements of Master or lower in Athletics or Thievery.')
  const skills = [
    ...stats.filter((stat) => stat.kind === 'skill'),
    ...lores.map((name) => ({ name, ability: 'int' as const, kind: 'skill' as const })),
  ].sort((a, b) => a.name.localeCompare(b.name))
  const skillNames = new Set(skills.map((stat) => stat.name))
  const tokenState = editingSkills && (getSettings().skillTokenConversion || c.skillTokenUpgrades?.length)
    ? skillTokenState(c, entries) : undefined
  const requirements = editingSkills ? skillRankRequirements(c, entries, [...skillNames]) : undefined
  const hasTokenPurchase = (name: string) => !!tokenState?.active.some(item => item.purchase.skill === name)
  const canRefundTokens = (name: string, target: number) => !!tokenState?.active.some(item =>
    item.purchase.skill === name && item.purchase.rank > target)
  const refundTokens = (name: string, rank: number) => confirmRemoval(
    `${name} ${RANKS[rank]} token upgrade and higher token upgrades for this skill`,
    () => save({ skillTokenUpgrades: c.skillTokenUpgrades?.filter(item => item.skill !== name || item.rank < rank) }))
  const offense = stats.filter((stat) => stat.kind === 'perception')
  const defense = stats.filter((stat) => stat.kind === 'save').sort((a, b) => a.name.localeCompare(b.name))
  const maxRank = c.level >= 15 ? 4 : c.level >= 7 ? 3 : c.level >= 3 ? 2 : 1
  const noPaidIncreases = { ...c, skillIncreases: {}, rankOverrides: undefined, skillTokenUpgrades: undefined }
  const baseRanks = editingSkills ? ranksAt(noPaidIncreases, entries, 99, false) : ranks
  const rankGrants = (editingSkills ? ['Technomagical Scrapper', ...Object.keys(INITIATE_TRAINING), 'Ancestral Skills', ...new Set(trainedLores.map(grant => grant.source))] : []).flatMap(name => {
    const feat = activeFeatsNamed(c, name).sort((a, b) => featTakenLevel(a) - featTakenLevel(b))[0]
    return feat ? [{ level: featTakenLevel(feat), without: ranksAt({
      ...noPaidIncreases, feats: c.feats.filter(feat => feat.name !== name),
    }, entries, 99, false) }] : []
  })
  const canSpendAt = (name: string, level: number) => rankGrants.every(grant =>
    (baseRanks[name] ?? 0) <= (grant.without[name] ?? 0) || level > grant.level)
  const improvisation = untrainedSkillProficiency(c)
  const armorBonus = part === 'defense' ? armorSaveBonus(c, entries) : 0
  const armorCheck = starfinderArmorPenalties(c, entries).check
  const saveCircumstance = part === 'defense' ? savingThrowCircumstance(c, entries) : undefined
  const assignRank = (name: string, target: number) => {
    if (hasTokenPurchase(name)) return undefined
    let rank = baseRanks[name] ?? 0
    const next = Object.fromEntries(Object.entries(c.skillIncreases ?? {}).filter(([, skill]) => skill !== name))
    if (target <= rank) return next
    if (rank < 1) return undefined
    const expertLevel = longevityExpertLevel(c)
    const expertSlots = [
      ...(expertLevel === undefined ? [] : [{ key: LONGEVITY_EXPERT_SLOT, level: expertLevel }]),
      ...officerEducationSlots(c),
    ].sort((a, b) => a.level - b.level)
    const canUseExpertSlot = (level: number) => canSpendAt(name, level)
      && (ranksAt({ ...c, level, skillIncreases: next, rankOverrides: undefined }, entries, level + 1, false)[name] ?? 0) === 1
    const expert = target === 2 && rank === 1
      ? expertSlots.find(slot => !next[slot.key] && !tokenState?.used.has(slot.key) && canUseExpertSlot(slot.level)) : undefined
    if (expert) {
      next[expert.key] = name
      return next
    }
    const slots = skillIncreaseLevels(c).map(level => ({ key: String(level), level, expertOnly: false, restricted: false }))
    slots.push(...expertSlots.map(slot => ({ ...slot, expertOnly: true, restricted: true })))
    if (name === 'Computers' || name === 'Crafting')
      slots.push(...mechanicIngenuitySlots(c).map(slot => ({ ...slot, expertOnly: false, restricted: true })))
    slots.sort((a, b) => a.level - b.level || Number(b.restricted) - Number(a.restricted))
    for (const slot of slots) {
      if (next[slot.key] || tokenState?.used.has(slot.key) || !canSpendAt(name, slot.level)
        || (slot.expertOnly ? rank !== 1 || !canUseExpertSlot(slot.level) : !canIncreaseTo(slot.level, rank))) continue
      next[slot.key] = name
      if (++rank >= target) return next
    }
    return undefined
  }
  const canReachRank = (name: string, target: number) => !!assignRank(name, target)
    || !!tokenState && !!skillTokenPurchase(c, entries, name, target, false, tokenState)
  const setRank = (name: string, r: number) => {
    if (!skillNames.has(name)) return
    const currentRank = permanentRanks[name] ?? 0
    const base = baseRanks[name] ?? 0
    const temporary = downloaded?.skill === name && downloaded.rank > currentRank
    const permanentAvailable = r === 1 ? currentRank === 0 && remaining > 0
      : r > currentRank && canReachRank(name, r)
    if (downloadFeat && r === downloadRank && (temporary || currentRank < r && (!downloaded || !permanentAvailable))) {
      save({ feats: c.feats.map(feat => feat === downloadFeat
        ? { ...feat, choice: temporary ? undefined : name } : feat) })
      return
    }
    if (r === 1 && currentRank === 0) {
      if (remaining > 0) save({ skillPicks: [...picks, name] })
      return
    }
    if (r === 1 && currentRank === 1) {
      if (picks.includes(name)) save({ skillPicks: picks.filter((pick) => pick !== name) })
      return
    }
    const target = currentRank === r ? r - 1 : r
    if (target < base || target > maxRank || (target > currentRank && !canReachRank(name, target))) return
    if (target < currentRank && canRefundTokens(name, target)) {
      refundTokens(name, target + 1)
      return
    }

    const next = assignRank(name, target)
    if (!next) {
      const purchases = tokenState && skillTokenPurchase(c, entries, name, target, false, tokenState)
      if (purchases) save({ skillTokenUpgrades: purchases })
      return
    }
    const overrides = { ...c.rankOverrides }
    delete overrides[name]
    save({ skillIncreases: next, rankOverrides: overrides })
  }
  const filigree = clanDaggerFiligreeBonus(c, entries)
  const clumsy = giantWeaponClumsy(c, entries)
  const droneSlots = droneCustomizationSlots(c)
  const assistantSkill = c.mechanicDroneAssistantActive && droneSlots
    ? (c.mechanicDroneCustomizations?.Tactical ?? []).slice(0, droneSlots.Tactical)
      .find(item => item.name === 'Assistant')?.choice : undefined
  const droneSkillRanks = assistantSkill ? droneStats(c, entries)?.ranks : undefined
  const sights = [...new Map(ownedWeapons(c, entries).filter(weapon => weaponEquipped(c, entries, weapon))
    .flatMap(weapon => installedWeaponUpgrades(c, entries, weapon))
    .filter(upgrade => /^(?:Truesight Sight|Sniper's Scope)(?:\s*\(|$)/i.test(upgrade.name))
    .map(upgrade => [upgrade.id, upgrade])).values()]
  const renderRows = (rows: typeof stats) => rows.map((s) => {
    const rank = ranks[s.name] ?? 0
    const permanentRank = permanentRanks[s.name] ?? 0
    const baseRank = baseRanks[s.name] ?? 0
    const medicalTraining = s.name === 'Medicine' && activeFeatsNamed(c, "Officer's Medical Training").length > 0
    const ability = medicalTraining && c.abilities.int > c.abilities.wis ? 'int' : s.ability
    const abil = abilityMod(c.abilities[ability])
    const armorPenalty = s.kind === 'skill' && (ability === 'str' || ability === 'dex') ? armorCheck : 0
    const improvised = s.kind === 'skill' && rank === 0 ? improvisation : undefined
    const prof = improvised?.bonus ?? proficiencyBonus(rank, c.level)
    const warmaskBonus = warmaskSource(c)?.skill === s.name ? warmaskItemBonus(c) : 0
    const filigreeItem = ['Athletics', 'Diplomacy', 'Society'].includes(s.name) ? filigree : 0
    const belt = s.name === 'Intimidation' ? killerBeltBonus(c, entries) : undefined
    const ink = s.name === 'Stealth' ? wildwoodInkBonus(c, entries) : undefined
    const tattoo = s.name === 'Crafting' ? tradecraftTattooBonus(c, entries) : undefined
    const item = s.name === 'Perception' ? perceptionItemBonus(c)
      : s.kind === 'save' ? armorBonus : Math.max(warmaskBonus, filigreeItem, belt?.value ?? 0, ink?.value ?? 0, tattoo?.value ?? 0)
    const status = s.name === 'Deception' && isSpellActive(c, entries, 'Imitate Fauna') ? 4 : 0
    const modification = s.name === 'Athletics' ? 'Muscular Exoskeleton' : s.name === 'Stealth' ? 'Subtle Dampeners' : ''
    const armorSkill = modification && armorOverdriveActive(c) && wornArmor(c, entries)?.id === INVENTOR_ARMOR_ID
      && armorModifications(c).some(mod => mod.name === modification)
      ? { source: modification, value: (ranks.Crafting ?? 0) >= 3 ? 2 : 1 } : undefined
    const craftingRecall = s.name === 'Crafting' && isFeatEffectActive(c, 'Eye for Treasure')
      ? { source: 'Eye for Treasure', value: 1 } : undefined
    const assistant = assistantSkill === s.name && rank > 0 && (droneSkillRanks?.[s.name] ?? 0) > 0
      ? { source: 'Drone Assistant', value: 1 } : undefined
    const circumstance = s.kind === 'perception' ? perceptionCircumstance(c)
      : s.kind === 'save' ? saveCircumstance
        : [craftingRecall, armorSkill, assistant].filter((bonus): bonus is { source: string; value: number } => !!bonus)
          .sort((a, b) => b.value - a.value)[0]
    const clumsyPenalty = ability === 'dex' ? clumsy : 0
    const total = abil + prof + item + status + armorPenalty + (circumstance?.value ?? 0) - clumsyPenalty
    const conditionalTotal = (bonus: number) => signed(total + Math.max(circumstance?.value ?? 0, bonus) - (circumstance?.value ?? 0))
    const forestIncrease = ink ? Math.max(item, ink.value + 1) - item : 0
    return (
      <div key={s.name} className={`skill-row${rank > 0 ? ' trained' : ''} with-item`} role="row">
        <span className="skill-name">{s.name} {editingSkills && c.lores.some(lore => lore.name === s.name)
          && <button type="button" className="lore-remove" aria-label={`Remove ${s.name}`} onClick={() => confirmRemoval(`"${s.name}"`, () => {
            const skillIncreases = Object.fromEntries(Object.entries(c.skillIncreases ?? {}).filter(([, skill]) => skill !== s.name))
            const rankOverrides = { ...c.rankOverrides }
            delete rankOverrides[s.name]
            const withoutLore = { ...c, lores: c.lores.filter(lore => lore.name !== s.name),
              skillPicks: picks.filter(pick => pick !== s.name), skillIncreases, rankOverrides }
            const stillGranted = [...featLores(c, entries), ...trainedLores.map(grant => grant.name), ...autoClassSkills(c, entries), ...backgroundSkills(bg), ...extraBackgroundSkills].includes(s.name)
              || activeFeatsNamed(c, "Officer's Medical Training").some(feat => feat.choice === s.name)
                && (ranksAt(withoutLore, entries)[s.name] ?? 0) > 0
            save({ lores: c.lores.filter(lore => lore.name !== s.name),
              ...(!stillGranted ? { skillPicks: picks.filter(pick => pick !== s.name), skillIncreases, rankOverrides,
                skillTokenUpgrades: c.skillTokenUpgrades?.filter(purchase => purchase.skill !== s.name) } : {}) })
          })}>×</button>}<b>{s.kind === 'save' && (s.name === 'Fortitude' || s.name === 'Reflex' || s.name === 'Will')
          ? <TotalBreakdown label={s.name} breakdown={savingThrowBreakdown(c, entries, s.name, ranks)} signedTotal />
          : signed(total)}{!!armorPenalty
          && <SourceNote inlineSource={false} source="Armor check penalty" note={`${armorPenalty} to Strength and Dexterity skill checks and DCs, except actions with the attack trait.`} />}{!!status
          && <SourceNote inlineSource={false} source="Imitate Fauna" note="+4 status bonus when using Impersonate as an animal." />}
          {!!clumsyPenalty && <SourceNote source="Giant Instinct: clumsy 1" note="-1 status penalty to Dexterity-based checks and DCs while wielding the oversized weapon, even outside Rage." />}
          {ink && <SourceNote inlineSource={false} source={ink.source}
            note={`Stealth ${signed(total + forestIncrease)} in forests`} />}
          {!!filigreeItem && <SourceNote inlineSource={false} source="Clan dagger filigree" note={`+${filigreeItem} item bonus from ${s.name === 'Athletics' ? "Trudd's Strength" : s.name === 'Society' ? "Kols's Oath" : "Bolka's Blessing"}.`} />}
          {!!filigree && s.name === 'Perception' && <SourceNote inlineSource={false} source="Bolka's Blessing" note={`+${filigree} item bonus to Sense Motive.`} />}
          {s.name === 'Perception' && sights.map(sight => {
            const grade = /\(([^)]+)\)$/.exec(sight.name)?.[1]?.toLowerCase()
            const bonus = sight.name.startsWith('Truesight') ? grade === 'tactical' ? 2 : 1
              : grade === 'superior' ? 3 : grade === 'advanced' ? 2 : grade === 'tactical' ? 1 : 0
            return bonus > 0 && <SourceNote key={sight.id} inlineSource={false} source={sight.name}
              note={`+${bonus} item bonus to visual Seek checks through the sight; item bonuses do not stack.`} />
          })}
          {!!filigree && s.name === 'Intimidation' && <SourceNote inlineSource={false} source="Trudd's Strength" note={`+${filigree} item bonus to Coerce.`} />}
          {medicalTraining && <SourceNote inlineSource={false} source="Officer's Medical Training" note="You can use Intelligence instead of Wisdom for Medicine checks." />}
          {downloaded?.skill === s.name && downloaded.rank > permanentRank && <SourceNote inlineSource={false}
            source="Skill Download" note="Temporary proficiency until daily preparations; cannot qualify for skill increases or permanent options." />}
          {s.name === 'Fortitude' && !!activeFeatsNamed(c, 'Radiation Resistant').length && <SourceNote inlineSource={false}
            source="Radiation Resistant" note="+1 circumstance bonus to Fortitude saves against radiation effects." />}
          {s.name === 'Crafting' && !!activeFeatsNamed(c, 'Tinkering Fingers').length && <SourceNote inlineSource={false}
            source="Tinkering Fingers" note="Repair without a toolkit without the penalty; +1 circumstance to Repair checks with a repair toolkit." />}
          {s.name === 'Nature' && !!activeFeatsNamed(c, 'Rider').length && <SourceNote inlineSource={false}
            source="Rider" note={`${conditionalTotal(1)} to Command an Animal checks for your own animal companion, if a check is required.`} />}
          {s.name === 'Diplomacy' && !!activeFeatsNamed(c, 'Extended Family').length && <SourceNote inlineSource={false}
            source="Extended Family" note="+1 circumstance to Make an Impression or Request against ysoki." />}
          {s.name === 'Diplomacy' && hasDivineIntercession(c, 'Sarenrae', 'major-boon') && <SourceNote inlineSource={false}
            source="Sarenrae (Major Boon)" note="Request: a success becomes a critical success. Creatures other than fiends, undead, and mindless creatures allow one chance to speak and request before combat. Exploiting this for a combat advantage revokes the boon." />}
          {s.name === 'Deception' && !!activeFeatsNamed(c, 'Round Ears').length && <SourceNote inlineSource={false}
            source="Round Ears" note={`${conditionalTotal(4)} to Impersonate someone who is not aiuvarin (+4 circumstance). No observer circumstance bonus or personal circumstance penalty for impersonating a full-blooded human.`} />}
          {s.name === 'Performance' && !!activeFeatsNamed(c, 'Earned Glory').length && <SourceNote inlineSource={false}
            source="Earned Glory" note="Make an Impression on an elf: a critical failure becomes a failure (Impressive Performance)." />}
          {['Arcana', 'Nature', 'Occultism', 'Religion'].includes(s.name) && heritages.has('Seer Elf') && <SourceNote inlineSource={false}
            source="Seer Elf" note={`${conditionalTotal(1)} to Identify Magic and Decipher Writing of a magical nature (+1 circumstance).`} />}
          {s.name === 'Perception' && heritages.has('Whisper Elf') && <SourceNote inlineSource={false}
            source="Whisper Elf" note={`${conditionalTotal(2)} to Seek hidden or undetected creatures within 30 feet (+2 circumstance). When you can hear a creature capable of making sound, targeting it uses flat DC 3 if concealed or 9 if hidden.`} />}
          {s.name === 'Athletics' && heritages.has('Woodland Elf') && <SourceNote inlineSource={false}
            source="Woodland Elf" note="Climb trees, vines, or foliage at half your Speed on a success and full Speed on a critical success; Quick Climb allows full Speed on a success. No effect on a climb Speed. You can always Take Cover in forest terrain." />}
          {trainedLores.filter(grant => grant.name === s.name).map(grant => <SourceNote key={grant.source} inlineSource={false}
            source={grant.source} note="Free trained Lore; does not use a skill training pick." />)}
          {s.name === 'Intimidation' && !!activeFeatsNamed(c, 'Pick On Someone My Size').length && <SourceNote inlineSource={false}
            source="Pick On Someone My Size" note="+1 circumstance to Demoralize a larger creature that attacked an ally since the start of your last turn." />}
          {s.name === 'Perception' && !!activeFeatsNamed(c, 'Enhanced Olfactory System').length && <SourceNote inlineSource={false}
            source="Enhanced Olfactory System" note="+2 circumstance to Seek a creature or object within scent range." />}
          {s.kind === 'save' && !!activeFeatsNamed(c, 'Pain Tolerance').length && <SourceNote inlineSource={false}
            source="Pain Tolerance" note="+1 circumstance bonus against effects that would make you clumsy, drained, or enfeebled." />}
          {s.kind === 'save' && hasDivineIntercession(c, 'Cayden Cailean', 'moderate-boon') && <SourceNote inlineSource={false}
            source="Cayden Cailean (Moderate Boon)" note={`Against fear effects, a success becomes a critical success.${classFeatures(entries, c).some(feature => feature.name === 'Bravery') ? ' With fighter Bravery, a critical failure becomes a failure.' : ''}`} />}
          {s.kind === 'skill' && hasDivineIntercession(c, 'Kazutal', 'major-boon') && <SourceNote inlineSource={false}
            source="Kazutal (Major Boon)" note="When you Aid, or another creature Aids you, the helper can automatically succeed. If rolling, a success becomes a critical success granting +4 circumstance, regardless of proficiency. Applies only to Aid, not ordinary checks." />}
          {armorSkill && <SourceNote inlineSource={false} source={armorSkill.source} note={`+${armorSkill.value} circumstance bonus during Overdrive.`} />}
          {['Deception', 'Diplomacy', 'Intimidation', 'Performance'].includes(s.name) && !!activeFeatsNamed(c, 'Shiny').length
            && <SourceNote inlineSource={false} source="Shiny" note={`${s.name} ${conditionalTotal(3)} when using Aid.`} />}
          {s.name === 'Survival' && wasteland && <SourceNote inlineSource={false} source="Wasteland Warrior" note={hazardNote} />}
          {s.name === 'Survival' && terrainExpertise && <SourceNote inlineSource={false} source="Terrain Expertise"
            note={`${conditionalTotal(1)} to Survival in ${terrainExpertise.terrains.join(', ')} terrain.`} />}
          </b></span>
        <span className="rank-dots" role="group" aria-label={`${s.name} proficiency`}>
          {RANK_LETTERS.map((letter, i) => {
            const target = permanentRank === i + 1 ? i : i + 1
            const temporary = downloaded?.skill === s.name && downloaded.rank > permanentRank
            const downloadAvailable = !!downloadFeat && i + 1 === downloadRank
              && (temporary || permanentRank < downloadRank)
            const trainedDisabled = i === 0 && (
              permanentRank === 0 ? remaining <= 0
                : permanentRank === 1 ? !picks.includes(s.name)
                  : baseRank > 1
            )
            const disabled = s.kind !== 'skill' || i + 1 > maxRank || (!downloadAvailable && (i === 0
              ? trainedDisabled
              : target < baseRank || (target > permanentRank && !canReachRank(s.name, target))))
              || hasTokenPurchase(s.name) && target < permanentRank && !canRefundTokens(s.name, target)
            const required = requirements?.get(s.name)?.get(i + 1)
            return (
              <span className="rank-choice" key={letter}>
              <button
                type="button"
                className={rank >= i + 1 ? 'on' : ''}
                aria-pressed={rank === i + 1}
                aria-label={`${s.name} ${RANKS[i + 1]}`}
                disabled={disabled}
                title={temporary && i + 1 === downloadRank ? 'Skill Download: temporary proficiency' : s.kind !== 'skill' ? 'Set by class and features' : i === 0 && grantedTraining.includes(s.name)
                  ? picks.includes(s.name) ? `Refund redundant training choice; ${heritageSkills.includes(s.name) ? 'Pioneer Human' : 'Ancestral Skills'} keeps this skill trained`
                    : `Trained granted by ${heritageSkills.includes(s.name) ? 'Pioneer Human' : 'Ancestral Skills'}`
                  : i === 0 && fixed.has(s.name) ? picks.includes(s.name) ? 'Refund redundant training choice' : 'Trained granted by class or background' : RANKS[i + 1]}
                onClick={() => setRank(s.name, i + 1)}
              >{letter}</button>{!!required?.length && <SourceNote inlineSource={false}
                source={`${s.name} ${RANKS[i + 1]} prerequisites`}
                note={`${required.join('; ')}. Current rank: ${RANKS[permanentRank]}.`} />}
              </span>
            )
          })}
        </span>
        <span className="skill-part"><small>{ABILITY_LABEL[ability]}</small>{signed(abil)}</span>
        <span className="skill-part"><small>Proficiency</small>{signed(prof)}</span>
        <span className="skill-part"><small>Item</small>{signed(item)}</span>
        {circumstance && <span className="skill-part skill-circumstance"><small>Circumstance</small>{signed(circumstance.value)} <small>({circumstance.source})</small></span>}
      </div>
    )
  })

  const hazardToggle = <FeatEffectToggle c={c} save={save} name="Hazard Finder" label="Hazard checks active"
    ariaLabel={`Hazard checks active (${part})`}
    title="Only for Perception checks to find traps and hazards, AC against their attacks, and saves against their effects. Does not affect initiative." />

  if (part === 'offense') {
    const athlete = ragingAthleteBenefits(c, entries)
    const terrain = favoredTerrainBenefits(c, entries)
    const characterSenses = senses(c, entries)
    return (
      <>
        <div className="skill-grid" role="table" aria-label="Offense">
          {renderRows(offense)}
        </div>
        <small>Senses: {characterSenses.map((s) => `${s.value} (${s.source})`).join(', ') || 'No special senses'}</small>
        {hazardToggle}
        <FeatEffectToggle c={c} save={save} name='Eye for Treasure' label="Crafting Recall Knowledge active"
          title="Apply Eye for Treasure's +1 circumstance bonus only to Crafting Recall Knowledge checks." />
        <FeatEffectToggle c={c} save={save} name="Favored Terrain" label="In favored terrain"
          title="Apply favored terrain benefits only while you are in that terrain." />
        {!!activeFeatsNamed(c, 'Gg-os Frame').length && <FeatEffectToggle c={c} save={save} name="Uncanny Dash" label="Uncanny Dash active"
          title="Apply the speed bonus only during Uncanny Dash." />}
        {isFeatEffectActive(c, 'Favored Terrain') && !terrain
          && <small role="status">Choose a Favored Terrain in your class feats before applying its benefits.</small>}
        {!!activeFeatsNamed(c, 'Terrain Master').length && !!activeFeatsNamed(c, 'Favored Terrain').length && <label>Favored Terrain{' '}
          <select aria-label="Favored Terrain" value={selectedFavoredTerrain(c) ?? ''} onChange={event => {
            if (!FAVORED_TERRAINS.includes(event.target.value)) return
            save(favoredTerrainChange(c, event.target.value))
          }}>
            {FAVORED_TERRAINS.map(name => <option key={name}>{name}</option>)}
          </select>
        </label>}
        {terrain && <small>Favored Terrain ({terrain.terrain}): ignore non-magical difficult terrain.
          {terrain.enhanced && (['Arctic', 'Desert'].includes(terrain.terrain)
            ? ` Eat and drink one-tenth as much; ignore severe/extreme ${terrain.terrain === 'Arctic' ? 'cold' : 'heat'}; cross ${terrain.terrain === 'Arctic' ? 'ice and snow' : 'sand'} at full Speed without Balance.`
            : terrain.terrain === 'Swamp' ? ' Cross bogs at full Speed, including deep bogs normally requiring Swim or causing greater difficult terrain.' : '')}
        </small>}
        <small>Speed: {movementSpeeds(c, entries).map((movement, index) => {
          const bonuses = movement.name === 'Land' ? speedBonuses(c, entries) : []
          return <span key={movement.name}>
            {index > 0 && '; '}{movement.name !== 'Land' && `${movement.name === 'Climb' ? 'Climbing' : movement.name} `}{movement.feet} ft.
            {movement.name === 'Land' && magneticLevitatorsActive(c, entries) && ' (hover; Magnetic Levitators)'}
            {movement.source && ` (${movement.source})`}
            {bonuses.length > 0 && ` (${bonuses.map((bonus) => `+${bonus.feet} ${bonus.source}`).join(', ')})`}
          </span>
        })}{hasDivineIntercession(c, 'Cayden Cailean', 'major-boon') && <SourceNote inlineSource={false}
          source="Cayden Cailean (Major Boon)" note="At the end of each turn, end one effect making you immobilized as a free action, including grabbing or restraining effects." />}</small>
        {athlete && <small>Raging Athlete: High/Long Jump DCs {athlete.jumpDCAdjustment}; successful Long Jump +{athlete.longJumpExtra} ft.; Leap {athlete.verticalLeap} ft. vertical{athlete.horizontalLeap && ` / ${athlete.horizontalLeap} ft. horizontal`}.</small>}
        <ProficiencyBadges groups={WEAPON_GROUPS} ranks={weaponRanks(c, entries)} />
        {testSubjectAdaptation(c) === 'Radioactive' && <label>
          <input type="checkbox" checked={!!c.ysokiDailyUses?.contaminate}
            onChange={event => save({ ysokiDailyUses: { ...c.ysokiDailyUses, contaminate: event.target.checked } })} />
          {' '}<a href="https://2e.aonsrd.com/actions/232-contaminate" target="_blank" rel="noreferrer">Contaminate</a> used
        </label>}
        {activeFeatsNamed(c, 'Rat Retinal HUD').length > 0 && <label>
          <input type="checkbox" checked={!!c.ysokiDailyUses?.retinalHud}
            onChange={event => save({ ysokiDailyUses: { ...c.ysokiDailyUses, retinalHud: event.target.checked } })} />
          {' '}<a href="https://2e.aonsrd.com/feats/1217-rat-retinal-hud" target="_blank" rel="noreferrer">Rat Retinal HUD</a> daily use
        </label>}
        {['Sensor Mask', 'Fire Crystal Beam'].filter(name => activeFeatsNamed(c, name).length > 0).map(name => <label key={name}>
          <input type="checkbox" checked={!!c.dailyFeatUses?.[name]}
            onChange={event => save({ dailyFeatUses: { ...c.dailyFeatUses, [name]: event.target.checked } })} />
          {' '}{name} used
        </label>)}
        {["Grandmother's Curse", 'Slip From Sight', 'Wormhole Warren', 'Dense Weave Musculature',
          'Flying Rocket Punch', 'Uncanny Dash'].filter(name => activeFeatsNamed(c, name).length > 0).map(name => <label key={name}>
          <input type="checkbox" checked={!!c.hourlyFeatUses?.[name]}
            onChange={event => save({ hourlyFeatUses: { ...c.hourlyFeatUses, [name]: event.target.checked } })} />
          {' '}{name} used <SourceNote inlineSource={false} source={name} note="Once per hour. Clear after an hour has passed." />
        </label>)}
        <WeaponList c={c} entries={entries} save={save} displayOnly />
      </>
    )
  }
  if (part === 'defense') {
    const res = [...resistances(c, entries).reduce((highest, resistance) => {
      const key = resistance.damage.toLowerCase()
      const existing = highest.get(key)
      if (!existing || resistance.value > existing.value) highest.set(key, resistance)
      return highest
    }, new Map<string, ReturnType<typeof resistances>[number]>()).values()]
      .sort((a, b) => a.damage.localeCompare(b.damage) || a.source.localeCompare(b.source))
    const spec = armorSpecialization(c, entries)
    const skin = animalSkinBenefits(c, entries)
    const researched = researchedSpellResistance(c, entries)
    const hpBonuses = hitPointBonuses(c)
    const oaken = oakenResilience(c, entries)
    const divineWeaknesses = divineIntercessionWeaknesses(c)
    return (
      <>
        <div className="defense-summary">
          <span><small>Armor Class</small><b><TotalBreakdown label="Armor Class" breakdown={armorClassBreakdown(c, entries)} /></b></span>
          <span><small>Hit Points</small><b>{maxHp(c, entries)}{hpBonuses.length > 0
            && <small> ({hpBonuses.map(bonus => `${signed(bonus.value)} ${bonus.source}`).join(', ')})</small>}</b></span>
        </div>
        <ShieldEquipment c={c} entries={entries} save={save} />
        {!!activeFeatsNamed(c, 'Thresher Ko-1 Frame').length && <label>
          <input type="checkbox" checked={!!c.dermalPlating?.raised && !c.dermalPlating.damaged}
            disabled={!!c.dermalPlating?.damaged} onChange={event => save({
              dermalPlating: { ...c.dermalPlating, raised: event.target.checked },
            })} /> Dermal plating raised
        </label>}
        {!!activeFeatsNamed(c, 'Machine Heart').length && <label>
          <input type="checkbox" checked={!!c.dailyFeatUses?.['Machine Heart']}
            onChange={event => save({ dailyFeatUses: { ...c.dailyFeatUses, 'Machine Heart': event.target.checked } })} />
          {' '}Machine Heart used <SourceNote inlineSource={false} source="Machine Heart"
            note={`The first time each day you would die, you instead regain ${c.level} Hit Points without increasing wounded from losing dying. You no longer age or need sleep, food, drink, or air.`} />
        </label>}
        {!!activeFeatsNamed(c, "Grandmother's Favorite").length && <label>
          <input type="checkbox" checked={!!c.monthlyFeatUses?.["Grandmother's Favorite"]}
            onChange={event => save({ monthlyFeatUses: { ...c.monthlyFeatUses, "Grandmother's Favorite": event.target.checked } })} />
          {' '}Grandmother's Favorite used <SourceNote inlineSource={false} source="Grandmother's Favorite"
            note="Once per month when you would die, you disperse as rats and return to life at maximum Hit Points in 1d6 days at a safe place chosen by the GM." />
        </label>}
        <RageToggle c={c} save={save} />
        {skin && <small>Animal Skin: +{skin.itemBonus} item AC; Dexterity cap +{skin.dexCap}.</small>}
        {hazardToggle}
        <FeatEffectToggle c={c} save={save} name="Stonemason's Eye" label="Stonework Perception active"
          title="Apply the +2 circumstance bonus only to notice unusual stonework and stonework traps." />
        {isPioneerHuman(c) && (c.pioneerEnvironment === 'Cold' || c.pioneerEnvironment === 'Heat')
          && <small>Pioneer Human: {c.pioneerEnvironment.toLowerCase()} environmental effects are one step less extreme. This is not damage resistance.</small>}
        {researched && <>
          <FeatEffectToggle c={c} save={save} name="Researched Spell Resistance" label="Researched spell resistance active"
            title={`Only against spells and effects with these tradition traits: ${researched.traditions.join(', ')}.`} />
          <small>Researched Spell Resistance: +1 circumstance to saves only against {researched.traditions.join(', ')} spells and effects. Enable only for a matching effect.</small>
        </>}
        <FeatEffectToggle c={c} save={save} name="Harden Flesh" label="Harden Flesh active"
          title="Until the beginning of your next turn. Clear this when the effect ends." />
        <FeatEffectToggle c={c} save={save} name="Heart of the Kaiju" label="Kaiju form resistance active"
          title="Physical resistance 5 only while in kaiju form. This control does not apply the form's other statistics." />
        <div className="skill-grid" role="table" aria-label="Defense">
          {renderRows(defense)}
        </div>
        {spec ? <small>Armor Specialization: {spec.group}{spec.summary && `, ${spec.summary}`}<SourceNote
          source={`${spec.armor}${spec.feat ? ` via ${spec.feat} feat` : spec.feature ? ` via ${spec.feature} class feature` : ''}`}
          note={spec.effect} />{spec.group === 'Plate' && ' Plate resistance applies to all slashing damage, not only critical hits.'}
          {spec.group === 'Chain' && ' Chain reduction applies only when you are critically hit.'}</small> : <small>Armor Specialization: None</small>}
        <small>Resistances: {res.length ? res.map((r, index) => {
          const note = spec && r.source === `${spec.group} Armor Specialization` ? spec.effect
            : activeFeatsNamed(c, r.source).length ? RESISTANCE_NOTES[r.source] : undefined
          return <span key={`${r.damage}:${r.source}`}>{index > 0 && ', '}{r.damage} {r.value}{note
            ? <SourceNote source={r.source} note={note} /> : ` (${r.source})`}</span>
        }) : 'None'}</small>
        {divineWeaknesses.length > 0 && <small>Weaknesses: {divineWeaknesses.map(weakness =>
          `${weakness.damage} ${weakness.value} (${weakness.source})`).join(', ')}. Weaknesses to the same damage type don’t stack; apply only the highest.</small>}
        {testSubjectAdaptation(c) === 'Radioactive' && <small>Immunity: sickened from radiation sickness (Test-Subject Ysoki)</small>}
        {oaken && <small>Weakness: Fire {oaken.fireWeakness} (Oaken Resilience)</small>}
      </>
    )
  }

  return (
    <>
      {!klass && <small>Pick a class to fill in class proficiencies.</small>}
      {c.className === 'Rogue' && selectedSubclass(c, entries) === 'Mastermind' && <label>Mastermind skill{' '}
        <select aria-label="Mastermind racket skill" value={c.rogueRacketSkills?.Mastermind ?? ''} onChange={event => {
          const skill = event.target.value
          if (skill && !MASTERMIND_SKILLS.includes(skill)) return
          save({ rogueRacketSkills: { ...c.rogueRacketSkills, Mastermind: skill } })
        }}>
          <option value="">Choose skill</option>
          {MASTERMIND_SKILLS.map(skill => <option key={skill}>{skill}</option>)}
        </select>
      </label>}
      <div className="skill-rank-budget" aria-label="Remaining skill selections">
        {(['trained', 'expert', 'master', 'legendary'] as const).map((rank, index) => (
          <span key={rank} title={`${RANKS[index + 1]} selections remaining`}>
            <b>{RANK_LETTERS[index]}</b>{budget[rank] + Number(!!downloadFeat && !downloaded && downloadRank === index + 1)}
          </span>
        ))}
      </div>
      {!!c.skillTokenUpgrades?.length && <details className="skill-token-exchange">
        <summary>Converted skill upgrades</summary>
        <ul>
          {c.skillTokenUpgrades.map((purchase, index) => {
            const inactive = tokenState?.inactive.find(item => item.index === index)
            return <li key={`${purchase.skill}:${purchase.rank}:${index}`}>
              {purchase.skill}: {RANKS[purchase.rank]} (level {purchase.level})
              {inactive ? <span role="status"> — {inactive.reason}</span>
                : <> — spent {skillTokenPayment(purchase.payment, c, entries)}</>}
              {' '}<button type="button" aria-label={`Refund ${purchase.skill} ${RANKS[purchase.rank]} token upgrade`}
                onClick={() => refundTokens(purchase.skill, purchase.rank)}>Refund</button>
            </li>
          })}
        </ul>
      </details>}
      <details className="lore-add">
        <summary aria-label="Add Lore skill" title="Add Lore skill">+</summary>
        <form aria-label="Add Lore" onSubmit={event => {
          event.preventDefault()
          const form = event.currentTarget
          const input = form.elements.namedItem('lore')
          if (!(input instanceof HTMLInputElement)) return
          const value = input.value.trim().replace(/\s+/g, ' ')
          const name = /(?:^|\s)lore$/i.test(value) ? value : `${value} Lore`
          if (!value || /^lore$/i.test(value)) {
            input.setCustomValidity('Enter a Lore specialty.')
          } else if (lores.some(lore => lore.toLowerCase() === name.toLowerCase())) {
            input.setCustomValidity('This Lore skill already exists.')
          }
          if (!input.reportValidity()) return
          save({ lores: [...c.lores, { name, rank: 0 }] })
          form.reset()
          form.closest('details')?.removeAttribute('open')
        }}>
          <label className="lore-options">Common Lore
            <select aria-label="Common Lore" size={8} defaultValue="" onChange={event => {
              const control = event.currentTarget
              const form = control.form
              const input = form?.elements.namedItem('lore')
              if (!form || !(input instanceof HTMLInputElement)) return
              input.value = control.value
              input.setCustomValidity('')
            }}>
              <option value="" disabled>Choose Lore</option>
              {COMMON_LORES.filter(name => !lores.some(existing => existing.toLowerCase() === name.toLowerCase()))
                .map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>Lore specialty <input name="lore" aria-label="Lore specialty" required
            onInput={event => event.currentTarget.setCustomValidity('')} /></label>
          <button type="submit">Add Lore</button>
        </form>
      </details>
      <div className="skill-grid" role="table" aria-label="Skills">
        {renderRows(skills)}
      </div>
      {!!activeFeatsNamed(c, 'Ancestral Skills').length && !ancestrySkills.length
        && <small role="status">Ancestral Skills training unavailable. Sync official content for your ancestry.</small>}
    </>
  )
}
