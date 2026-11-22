import { resistances, activeBattleForm,
  ABILITY_LABEL, ARMOR_GROUPS, RANKS, WEAPON_GROUPS, abilityMod, activeFeatsNamed, animalSkinBenefits, armorRanks, weaponRanks, backgroundSkills, freeHeartBackground, autoClassSkills, canIncreaseTo, classDifficultyClass, classFeatures, commonLoreOptions, featEffectChange, featLores, isFeatEffectActive, senses, movementSpeeds, speed, speedBonuses, ragingAthleteBenefits, magneticLevitatorsActive, armorSpecialization,
  ancestralSkills, trainedFeatLores, deityGrantedLores, FAVORED_TERRAINS, EXPERT_GRANT_FEATS, hellknightArmorWorn, signiferExpertSlots, backgroundLoreIncreaseSlots, MASTERMIND_SKILLS, favoredTerrainBenefits, favoredTerrainChange, selectedFavoredTerrain, selectedSubclass, featTakenLevel, hitPointBonuses, isPioneerHuman, maxHp, terrainExpertiseBenefits,
  proficiencyBonus, untrainedSkillProficiency, ranksAt, temporarySkillTrainings, normalizeLongevitySkills, normalizeConditionalSkillChoices, longevityExpertLevel, LONGEVITY_EXPERT_SLOT, officerEducationSlots, mechanicIngenuitySlots, armorSaveBonus, armorClassBreakdown, savingThrowBreakdown, perceptionItemBonus, perceptionCircumstance, raisedShieldBonus, shieldRaised, signed, skillIncreaseLevels, skillRankBudget, statDefs, isSpellActive, oakenResilience, clanDaggerFiligreeBonus, starfinderArmorPenalties, testSubjectAdaptation, offensiveDefenseAttack, ownedWeapons, weaponEquipped, installedWeaponUpgrades, conditionPenalty, conditionValue, type SectionProps,
} from './builder'
import { killerBeltBonus, wildwoodInkBonus, tradecraftTattooBonus, voyagerPackBonus, barbarianInstinct, giantWeaponClumsy, giantStatureSize, effectiveWeapon, weaponEntry, weaponHeld } from './builder'
import { ArmorList, ShieldEquipment, WeaponList } from './GearSection'
import { SourceNote } from './Info'
import { CONDITIONAL_BONUSES } from './conditionalBonuses'
import { droneCustomizationSlots, droneStats } from './drone'
import { TotalBreakdown } from './TotalBreakdown'
import { warmaskSource, warmaskItemBonus } from './warmask'
import { armorModifications, armorOverdriveActive } from './inventorArmor'
import { INVENTOR_ARMOR_ID } from './grantedArmor'
import { apexSkillBonus, wornArmor } from './builder'
import { confirmRemoval } from './confirmRemoval'
import { getSettings } from './settings'
import { backgroundLoreChoiceOptions, backgroundLoreSlots, backgroundSkillSlots, chosenLoreFeats, normalizeGrantedSkillSpending, skillRankAllocations, skillRankRequirements, skillTokenPurchase, skillTokenState } from './builder'
import { SearchableSelect } from './SearchableSelect'
import { PROFESSION_LORES } from './backgrounds'
import { characterHeritages } from './heritages'
import { divineIntercessionWeaknesses, hasDivineIntercession } from './divineIntercessions'
import { artifactItemSkillBonus, hunterArrowheadBonus } from './builder'
import { ERUDITE_LORE_KEY, eruditeWarrior, isSoldier, soldierStyle } from './soldier'
import { isWitchwarper } from './witchwarper'
import { hellknightBenefitActive, hellknightSkillNotes, hellknightTrainingBenefits } from './hellknight'

const RANK_LETTERS = ['T', 'E', 'M', 'L']
const LABORER_LORES = PROFESSION_LORES.filter(lore => !['First Ones Lore', 'Underworld Lore'].includes(lore))
export { commonLoreOptions } from './builder'

const RESISTANCE_NOTES: Record<string, string> = {
  'Poison Resistance': '+1 status bonus to saving throws against poisons.',
  'Heart of the Kaiju': "Physical resistance applies only while in kaiju form. This toggle does not apply the form's other statistics.",
  'Primal Aegis': 'Resistance equals your positive Wisdom modifier.',
  'Radiation Resistant': 'Poison resistance applies only to damage from radiation effects.',
  'Armor Storm': 'Applies only to damage from attacks made by suppressed creatures.',
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

export function WeaponProficiency({ c, entries }: Pick<SectionProps, 'c' | 'entries'>) {
  return <ProficiencyBadges groups={WEAPON_GROUPS} ranks={weaponRanks(c, entries)} />
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

export function SensesAndSpeed({ c, entries, save }: SectionProps) {
  const athlete = ragingAthleteBenefits(c, entries)
  const form = activeBattleForm(c, entries)
  const terrain = favoredTerrainBenefits(c, entries)
  const characterSenses = senses(c, entries)
  const speeds = movementSpeeds(c, entries)
  const dashSpeeds = activeFeatsNamed(c, 'Uncanny Dash').length && activeFeatsNamed(c, 'Gg-os Frame').length
    ? movementSpeeds(c, entries, { includeUncannyDash: true }) : undefined
  const uplifting = activeFeatsNamed(c, 'Uplifting Winds').length
    ? movementSpeeds(c, entries, { includeUpliftingWinds: true }).find(movement => movement.name === 'Fly') : undefined
  return <>
    <SkillsSection c={c} entries={entries} save={save} part="senses" />
    <small>Senses: {characterSenses.length ? characterSenses.map((sense, index) => <span key={`${sense.value}:${sense.source}`}>
      {index > 0 && ', '}{sense.value}{sense.source && <SourceNote source={sense.source} note={`Grants ${sense.value}.`} />}
    </span>) : 'No special senses'}
      {!!activeFeatsNamed(c, 'Sense Allies').length && <SourceNote source="Sense Allies"
        note="Willing allies you are aware of within 60 feet are hidden instead of undetected; DC 5 flat check to target a hidden willing ally within 60 feet." />}
      {!!activeFeatsNamed(c, 'Fire Lung').length && <SourceNote source="Fire Lung"
        note="Breathe normally in ash and smoke; ignore concealment from smoke. Recover from persistent fire on DC 10, or DC 5 with particularly effective assistance." />}
      {c.raging && !!activeFeatsNamed(c, 'Supernatural Senses').length && <SourceNote source="Supernatural Senses"
        note="When targeting a concealed or hidden opponent, the flat check DC is 3 or 9, respectively." />}</small>
    <small>Speed: {speeds.map((movement, index) => {
      const bonuses = movement.name === 'Land' ? speedBonuses(c, entries) : []
      return <span key={movement.name}>
        {index > 0 && '; '}{movement.name !== 'Land' && `${movement.name === 'Climb' ? 'Climbing' : movement.name} `}{movement.feet} ft.
        {movement.name === 'Land' && magneticLevitatorsActive(c, entries) && ' (hover)'}
        {(movement.source || bonuses.length > 0) && <SourceNote source={`${movement.name} Speed`}
          note={[movement.source, ...(movement.name === 'Land' && form?.source === 'Ancestral Embrace Avatar' ? [form.note] : []),
            ...bonuses.map(bonus => `+${bonus.feet} ${bonus.source}`)].filter(Boolean).join('; ')} />}
      </span>
    })}{dashSpeeds && <SourceNote source="Uncanny Dash"
      note={`During Uncanny Dash, your conditional Speeds are ${dashSpeeds.map(movement => `${movement.name} ${movement.feet} feet`).join('; ')}.`} />}
      {athlete && <SourceNote source="Raging Athlete"
        note={`High/Long Jump DCs ${athlete.jumpDCAdjustment}; successful Long Jump +${athlete.longJumpExtra} ft.; Leap ${athlete.verticalLeap} ft. vertical${athlete.horizontalLeap ? ` / ${athlete.horizontalLeap} ft. horizontal` : ''}.`} />}
      {c.systems.includes('sf2e') && c.ancestry === 'Vesk' && !!activeFeatsNamed(c, 'Close the Gap').length
        && <SourceNote source="Close the Gap"
          note="Once per hour, spend 1 action to Stride once or 2 actions to Stride twice; gain a +10-foot status bonus to Speed for these Strides." />}
      {c.systems.includes('sf2e') && c.ancestry === 'Vesk' && !!activeFeatsNamed(c, 'Eager Combatant').length
        && <SourceNote source="Eager Combatant"
          note="When rolling Athletics or Intimidation for initiative, you can use a free action to Stride in a straight line directly toward an enemy." />}
      {c.systems.includes('sf2e') && c.className === 'Operative' && !!activeFeatsNamed(c, 'Kick it into Overdrive').length
        && <SourceNote source="Kick it into Overdrive"
          note="Once per hour at the start of your turn, become quickened through the turn and use the extra action only to Stride. You can extend it through your next turn, then become fatigued for 2 rounds." />}
      {c.systems.includes('sf2e') && c.className === 'Operative' && !!activeFeatsNamed(c, 'Destructive Dash').length
        && <SourceNote source="Destructive Dash"
          note="In a suitable environment, spend 2 actions to Stride up to your Speed; squares you pass through become difficult terrain until cleared with Interact by a creature within reach." />}
      {c.systems.includes('sf2e') && c.className === 'Operative' && !!activeFeatsNamed(c, 'Tactical Advance').length
        && <SourceNote source="Tactical Advance"
          note={`If not encumbered, spend 1 action to Stride up to ${speed(c, entries)} feet without triggering reactions. ${activeFeatsNamed(c, 'Unhindered Advance').length ? 'Ignore difficult and greater difficult terrain during this movement.' : ''}`} />}
      {!!activeFeatsNamed(c, 'Sudden Charge').length && <SourceNote source="Sudden Charge"
        note={`Move twice, then make a melee Strike if an enemy is within reach. Maximum distances: ${speeds.map(movement => `${movement.name} ${movement.feet * 2} feet`).join('; ')}.`} />}
      {c.raging && !!activeFeatsNamed(c, 'No Escape').length && <SourceNote source="No Escape"
        note={`When an enemy within reach attempts to move away, follow it as a reaction, keeping it in reach until it stops or you have moved your full Speed: ${speeds.map(movement => `${movement.name} ${movement.feet} feet`).join('; ')}.`} />}
      {c.raging && !!activeFeatsNamed(c, "Predator's Pounce").length && <SourceNote source="Predator's Pounce"
        note={`While unarmored or wearing light armor, Stride up to ${speed(c, entries)} feet, then Strike.`} />}
      {!!activeFeatsNamed(c, 'Sudden Leap').length && <SourceNote source="Sudden Leap"
        note={`Leap, High Jump, or Long Jump and make a melee Strike during the jump. High and Long Jump use Long Jump distance rules, up to ${speed(c, entries) * 2} feet.`} />}
      {c.raging && !!activeFeatsNamed(c, 'Furious Sprint').length && <SourceNote source="Furious Sprint"
        note={`Stride in a straight line up to ${speed(c, entries) * 5} feet with two actions or ${speed(c, entries) * 8} feet with three actions. Balance can replace a Stride using Athletics.`} />}
      {c.raging && !!activeFeatsNamed(c, 'Determined Dash').length && <SourceNote source="Determined Dash"
        note={`Ignore Speed penalties and difficult or greater difficult terrain while Striding up to ${speed(c, entries, { ignorePenalties: true }) * 2} feet with two actions or ${speed(c, entries, { ignorePenalties: true }) * 3} feet with three actions. Balance can use Athletics.`} />}
      {uplifting && <SourceNote source="Uplifting Winds"
        note={`When flying and casting an air or electricity spell, Fly Speed ${uplifting.feet} feet (+10 status, nonstacking); immediately Fly up to half that Speed.`} />}
      {c.systems.includes('sf2e') && !!activeFeatsNamed(c, 'Frilled Vesk Glide').length
        && <SourceNote source="Frilled Vesk Glide"
          note="One action: glide up to 25 feet forward while descending 5 feet. If you spend at least one action gliding each round and have not reached the ground, remain airborne at the end of your turn." />}
      {c.systems.includes('sf2e') && !!activeFeatsNamed(c, 'Nimble Tail').length
        && <SourceNote source="Nimble Tail"
          note="In zero gravity, Push Off without a free hand; while untethered, ignore clumsy and off-guard penalties." />}
      {c.systems.includes('sf2e') && !!activeFeatsNamed(c, 'Zero-G Tail').length
        && <SourceNote source="Zero-G Tail"
          note="When using Nimble Tail to Push Off, Float up to your Speed instead of half your Speed; while Floating, you can react to Grab an Edge when passing adjacent to an object." />}
      {!!activeFeatsNamed(c, 'Shore Step').length && <SourceNote source="Shore Step" note="Ignore difficult terrain caused by shallow water." />}
      {!!activeFeatsNamed(c, 'Forest Passage').length && <SourceNote source="Forest Passage" note="Ignore difficult terrain caused by plants and fungi." />}
      {hasDivineIntercession(c, 'Cayden Cailean', 'major-boon') && <SourceNote inlineSource={false}
      source="Cayden Cailean (Major Boon)" note="At the end of each turn, end one effect making you immobilized as a free action, including grabbing or restraining effects." />}</small>
    <FeatEffectToggle c={c} save={save} name="Favored Terrain" label="In favored terrain"
      title="Apply favored terrain benefits only while you are in that terrain." />
    <FeatEffectToggle c={c} save={save} name="Briny Beverage" label="Briny Beverage active"
      title="Once per day for 1 minute; wavesense works only in the body of water you drank from." />
    {c.raging && <FeatEffectToggle c={c} save={save} name="Dragon's Rage Wings" label="Dragon's Rage Wings active"
      title="One action; wings last until Rage ends." />}
    {c.raging && isFeatEffectActive(c, "Dragon's Rage Wings") && <SourceNote source="Dragon's Rage Wings"
      note="If flying when Rage ends, fall without taking damage and land standing." />}
    {hellknightTrainingBenefits(c).some(benefit => benefit.name === 'Trailblazing Stride') && <>
      <label><input type="checkbox" aria-label="Trailblazing Stride active" checked={hellknightBenefitActive(c, 'Trailblazing Stride')}
        onChange={event => save(featEffectChange(c, 'Trailblazing Stride', event.target.checked))} /> Trailblazing Stride</label>
      <SourceNote source="Trailblazing Stride"
        note="Ignore land-based difficult terrain caused by plants, fungi, or uneven ground. Activate +10-foot circumstance bonus to all Speeds after successfully Recalling Knowledge about an animal, beast, fungus, or plant; ends with your turn." />
    </>}
    {!!activeFeatsNamed(c, "Implement's Flight").length && <FeatEffectToggle c={c} save={save} name="Implement's Flight" label="Implement's Flight active"
      title="Fly while holding your implement." />}
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
    {terrain && <SourceNote source={`Favored Terrain (${terrain.terrain})`} note={`ignore non-magical difficult terrain.${
      terrain.enhanced ? (['Arctic', 'Desert'].includes(terrain.terrain)
        ? ` Eat and drink one-tenth as much; ignore severe/extreme ${terrain.terrain === 'Arctic' ? 'cold' : 'heat'}; cross ${terrain.terrain === 'Arctic' ? 'ice and snow' : 'sand'} at full Speed without Balance.`
        : terrain.terrain === 'Swamp' ? ' Cross bogs at full Speed, including deep bogs normally requiring Swim or causing greater difficult terrain.' : '') : ''}`} />}
  </>
}

export function SkillsSection({ c: original, entries, save: saveOriginal, part = 'skills', deityLores }: SectionProps & {
  part?: 'skills' | 'offense' | 'defense' | 'senses'; deityLores?: string[]
}) {
  const editingSkills = part === 'skills'
  const c = editingSkills ? normalizeGrantedSkillSpending(normalizeConditionalSkillChoices(normalizeLongevitySkills(original), entries), entries) : original
  const save: SectionProps['save'] = patch => saveOriginal(c === original ? patch : {
    feats: c.feats, skillPicks: c.skillPicks, skillIncreases: c.skillIncreases, skillTokenUpgrades: c.skillTokenUpgrades,
    warmask: c.warmask, lores: c.lores, ...patch,
  })
  const stats = statDefs(c)
  const bg = editingSkills ? entries.find((e) => e.kind === 'background' && e.name === c.background) : undefined
  const extraBackground = editingSkills ? freeHeartBackground(c, entries) : undefined
  const extraBackgroundSkills = backgroundSkills(extraBackground, c)
  const permanentRanks = ranksAt(c, entries)
  const heritages = new Set(characterHeritages(c, entries).map(heritage => heritage.name))
  const temporaryTrainings = temporarySkillTrainings(c, entries)
  const ranks = temporaryTrainings.reduce((result, training) => training.skill
    ? { ...result, [training.skill]: Math.max(result[training.skill] ?? 0, training.rank) } : result, permanentRanks)
  const trainedLores = trainedFeatLores(c)
  const lores = editingSkills ? [...new Set([...c.lores.map((l) => l.name), ...featLores(c, entries), ...trainedLores.map(grant => grant.name), ...deityGrantedLores(c), ...autoClassSkills(c, entries).filter((s) => / lore$/i.test(s)), ...activeFeatsNamed(c, "Officer's Medical Training").flatMap(feat => feat.choice && /.+\s+lore$/i.test(feat.choice) && (ranks[feat.choice] ?? 0) > 0 ? [feat.choice] : []), ...backgroundSkills(bg, c).filter((s) => /lore$/i.test(s)), ...extraBackgroundSkills.filter(s => /lore$/i.test(s))])] : []
  const picks = c.skillPicks ?? []
  const budget = editingSkills ? skillRankBudget(c, entries) : { trained: 0, expert: 0, master: 0, legendary: 0 }
  const remaining = budget.trained
  const backgroundTraining = editingSkills ? backgroundSkillSlots(c, entries) : []
  const backgroundLores = editingSkills ? backgroundLoreSlots(c, entries) : []
  const loreFeats = editingSkills ? chosenLoreFeats(c) : []
  const erudite = editingSkills ? eruditeWarrior(c) : undefined
  const eruditeChoice = (name: string) => !!erudite && / lore$/i.test(name)
    && (!erudite.lore || erudite.lore === name)
  const trainingChoice = (name: string) => backgroundTraining.find(slot => slot.value === name)
    ?? backgroundTraining.find(slot => !slot.value && slot.options.includes(name))
  const ancestrySkills = editingSkills ? ancestralSkills(c, entries) : []
  const heritageSkills = editingSkills && isPioneerHuman(c) ? ['Survival'] : []
  const grantedTraining = [...ancestrySkills, ...heritageSkills]
  const fixed = new Set(editingSkills ? [...autoClassSkills(c, entries), ...backgroundSkills(bg, c), ...extraBackgroundSkills, ...grantedTraining] : [])
  const terrainExpertise = terrainExpertiseBenefits(c, entries)
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
  const memoriesOfValor = editingSkills && c.systems.includes('sf2e') && c.ancestry === 'Vesk'
    && c.heritage === 'Enshrined Vesk' ? activeFeatsNamed(c, 'Memories of Valor').find(feat => feat.choice) : undefined
  const memoriesHourly = !!activeFeatsNamed(c, 'No Memory Left Behind').length
  const tokenState = editingSkills && (getSettings().skillTokenConversion || c.skillTokenUpgrades?.length)
    ? skillTokenState(c, entries) : undefined
  const requirements = editingSkills ? skillRankRequirements(c, entries, [...skillNames]) : undefined
  const hasTokenPurchase = (name: string) => !!tokenState?.active.some(item => item.purchase.skill === name)
  const canRefundTokens = (name: string, target: number) => !!tokenState?.active.some(item =>
    item.purchase.skill === name && item.purchase.rank > target)
  const refundTokens = (name: string, rank: number) => confirmRemoval(
    `${name} ${RANKS[rank]} token upgrade and higher token upgrades for this skill`,
    () => save({ skillTokenUpgrades: c.skillTokenUpgrades?.filter(item => item.skill !== name || item.rank < rank) }))
  const perception = stats.filter((stat) => stat.kind === 'perception')
  const defense = stats.filter((stat) => stat.kind === 'save').sort((a, b) => a.name.localeCompare(b.name))
  const maxRank = c.level >= 15 ? 4 : c.level >= 7 ? 3 : c.level >= 3 ? 2 : 1
  const noPaidIncreases = { ...c, skillIncreases: {}, rankOverrides: undefined, skillTokenUpgrades: undefined }
  const baseRanks = editingSkills ? ranksAt(noPaidIncreases, entries, 99, false) : ranks
  const rankGrants = (editingSkills ? ['Technomagical Scrapper', ...Object.keys(EXPERT_GRANT_FEATS), 'Ancestral Skills', ...new Set(trainedLores.map(grant => grant.source))] : []).flatMap(name => {
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
  const hazardFinder = activeFeatsNamed(c, 'Hazard Finder').length > 0
  const assignRank = (name: string, target: number) => {
    if (hasTokenPurchase(name)) return undefined
    let rank = baseRanks[name] ?? 0
    const next = Object.fromEntries(Object.entries(c.skillIncreases ?? {}).filter(([, skill]) => skill !== name))
    if (target <= rank) return next
    if (rank < 1) return undefined
    const expertLevel = longevityExpertLevel(c)
    const expertSlots: { key: string; level: number; skills?: string[] }[] = [
      ...(expertLevel === undefined ? [] : [{ key: LONGEVITY_EXPERT_SLOT, level: expertLevel }]),
      ...officerEducationSlots(c),
      ...signiferExpertSlots(c),
    ].sort((a, b) => a.level - b.level)
    const canUseExpertSlot = (level: number) => canSpendAt(name, level)
      && (ranksAt({ ...c, level, skillIncreases: next, rankOverrides: undefined }, entries, level + 1, false)[name] ?? 0) === 1
    const expert = target === 2 && rank === 1
      ? expertSlots.find(slot => (!slot.skills || slot.skills.includes(name)) && !next[slot.key] && !tokenState?.used.has(slot.key) && canUseExpertSlot(slot.level)) : undefined
    if (expert) {
      next[expert.key] = name
      return next
    }
    const slots: { key: string; level: number; expertOnly: boolean; restricted: boolean; skills?: string[] }[] = skillIncreaseLevels(c).map(level => ({ key: String(level), level, expertOnly: false, restricted: false }))
    slots.push(...expertSlots.map(slot => ({ ...slot, expertOnly: true, restricted: true })))
    slots.push(...backgroundLoreIncreaseSlots(c, entries).map(slot => ({ ...slot, expertOnly: false, restricted: true })))
    if (name === 'Computers' || name === 'Crafting')
      slots.push(...mechanicIngenuitySlots(c).map(slot => ({ ...slot, expertOnly: false, restricted: true })))
    slots.sort((a, b) => a.level - b.level || Number(b.restricted) - Number(a.restricted))
    for (const slot of slots) {
      if (next[slot.key] || tokenState?.used.has(slot.key) || !canSpendAt(name, slot.level)
        || !!slot.skills && !slot.skills.includes(name)
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
    if (r === 1 && eruditeChoice(name)) {
      save({ subclassSkillChoices: { ...c.subclassSkillChoices,
        [ERUDITE_LORE_KEY]: erudite?.lore === name ? '' : name } })
      return
    }
    const backgroundChoice = r === 1 && trainingChoice(name)
    if (backgroundChoice) {
      save({ backgroundSkillChoices: { ...c.backgroundSkillChoices,
        [backgroundChoice.background.name]: backgroundChoice.value ? '' : name } })
      return
    }
    const currentRank = permanentRanks[name] ?? 0
    const base = baseRanks[name] ?? 0
    const temporary = temporaryTrainings.find(training => training.skill === name && training.rank === r)
    const permanentAvailable = r === 1 ? currentRank === 0 && remaining > 0
      : r > currentRank && canReachRank(name, r)
    const availableTraining = temporaryTrainings.find(training => training.rank === r
      && (training.skill === undefined || !permanentAvailable)
      && (training.feat.name !== 'Eclectic Obsession' || /.+\s+lore$/i.test(name))
      && (training.feat.name !== 'Consult the Stars'
        || ['cha', 'int', 'wis'].includes(skills.find(skill => skill.name === name)?.ability ?? (/ lore$/i.test(name) ? 'int' : ''))))
    if (temporary || availableTraining && currentRank < r) {
      const selected = temporary ?? availableTraining!
      save({ feats: c.feats.map(feat => feat === selected.feat
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
  const professionalTools = c.systems.includes('sf2e') ? ownedWeapons(c, entries)
    .filter(weapon => weaponHeld(c, entries, weapon))
    .map(weapon => {
      const enhanced = effectiveWeapon(c, entries, weapon)
      const entry = weaponEntry(entries, enhanced.name, enhanced.id)
      return { name: weapon.name, skills: String(entry?.data.professional_skills ?? '').split(';'), bonus: enhanced.potency }
    }).filter(tool => tool.bonus > 0) : []
  const shadowpiercer = part === 'defense' && ownedWeapons(c, entries).some(weapon => weaponHeld(c, entries, weapon)
    && weaponEntry(entries, weapon.name)?.data.named_weapon_source === 'Shadowpiercer')
  const artifactSaves: Record<string, string> = {
    Serithtial: '+4 status to saves against death and void effects created by followers of Zon-Kuthon; void resistance 10, suppressed doomed, and unfettered movement apply only against those followers.',
    Ridill: '+2 circumstance to saves against fear; +4 instead if the effect is from a dragon. Does not stack with other circumstance bonuses.',
    'Kortos Diamond': '+2 item to saves against mental effects; does not stack with resilient or other item bonuses.',
    'Soulcutter (Artifact)': '+3 item to saves against mental effects; +5 against possession effects.',
  }
  const artifactNotes = part === 'defense' ? [...new Set(ownedWeapons(c, entries)
    .filter(weapon => {
      const source = String(weaponEntry(entries, weapon.name)?.data.named_weapon_source ?? '')
      return !!artifactSaves[source] && (source === 'Soulcutter (Artifact)' || weaponHeld(c, entries, weapon))
    }).map(weapon => String(weaponEntry(entries, weapon.name)?.data.named_weapon_source ?? '')))] : []
  const dwarvenAxe = ownedWeapons(c, entries).some(weapon =>
    weaponEntry(entries, weapon.name)?.data.named_weapon_source === 'Axe of the Dwarven Lords')
  const renderRows = (rows: typeof stats) => rows.map((s) => {
    const rank = ranks[s.name] ?? 0
    const permanentRank = permanentRanks[s.name] ?? 0
    const baseRank = baseRanks[s.name] ?? 0
    const medicalTraining = s.name === 'Medicine' && activeFeatsNamed(c, "Officer's Medical Training").length > 0
    const ability = medicalTraining && c.abilities.int > c.abilities.wis ? 'int' : s.ability
    const abil = abilityMod(c.abilities[ability])
    const form = activeBattleForm(c, entries)
    const armorPenalty = !form && s.kind === 'skill' && (ability === 'str' || ability === 'dex') ? armorCheck : 0
    const improvised = s.kind === 'skill' && rank === 0 ? improvisation : undefined
    const prof = improvised?.bonus ?? proficiencyBonus(rank, c.level)
    const warmaskBonus = warmaskSource(c)?.skill === s.name ? warmaskItemBonus(c) : 0
    const filigreeItem = ['Athletics', 'Diplomacy', 'Society'].includes(s.name) ? filigree : 0
    const belt = s.name === 'Intimidation' ? killerBeltBonus(c, entries) : undefined
    const ink = s.name === 'Stealth' ? wildwoodInkBonus(c, entries) : undefined
    const tattoo = s.name === 'Crafting' ? tradecraftTattooBonus(c, entries) : undefined
    const artifact = artifactItemSkillBonus(c, entries, s.name)
    const arrowhead = s.name === 'Survival' ? hunterArrowheadBonus(c, entries) : undefined
    const pack = s.name === 'Survival' ? voyagerPackBonus(c, entries) : undefined
    const item = s.name === 'Perception' ? perceptionItemBonus(c, entries)
      : s.kind === 'save' ? armorBonus : Math.max(warmaskBonus, filigreeItem, belt?.value ?? 0, ink?.value ?? 0, tattoo?.value ?? 0, artifact?.value ?? 0, pack?.value ?? 0, apexSkillBonus(c, s.name))
    const athleticRush = s.name === 'Athletics' && isSpellActive(c, entries, 'Athletic Rush')
    const ferocious = s.name === 'Athletics' && form?.source === 'Untamed Form' && !!activeFeatsNamed(c, 'Ferocious Shape').length
    const status = athleticRush ? 2 : ferocious ? 1 : s.name === 'Deception' && isSpellActive(c, entries, 'Imitate Fauna') ? 4 : 0
    const modification = s.name === 'Athletics' ? 'Muscular Exoskeleton' : s.name === 'Stealth' ? 'Subtle Dampeners' : ''
    const armorSkill = modification && armorOverdriveActive(c) && wornArmor(c, entries)?.id === INVENTOR_ARMOR_ID
      && armorModifications(c).some(mod => mod.name === modification)
      ? { source: modification, value: (ranks.Crafting ?? 0) >= 3 ? 2 : 1 } : undefined
    const assistant = assistantSkill === s.name && rank > 0 && (droneSkillRanks?.[s.name] ?? 0) > 0
      ? { source: 'Drone Assistant', value: 1 } : undefined
    const preferment = s.name === 'Intimidation' && activeFeatsNamed(c, 'Hellknight Preferment').length && hellknightArmorWorn(c, entries)
      ? { source: 'Hellknight Preferment', value: 1 } : undefined
    const circumstance = s.kind === 'perception' ? perceptionCircumstance(c)
      : s.kind === 'save' ? undefined
        : [armorSkill, assistant, preferment].filter((bonus): bonus is { source: string; value: number } => !!bonus)
          .sort((a, b) => b.value - a.value)[0]
    const clumsyPenalty = ability === 'dex' ? clumsy : 0
    const statusPenalty = Math.max(conditionPenalty(c, ability), clumsyPenalty)
    const pest = !!form && 'pest' in form && form.pest
    const ownTotal = abil + prof + (pest && ['Acrobatics', 'Athletics', 'Stealth'].includes(s.name) ? 0 : item) + armorPenalty
    const formSkill = pest && ['Acrobatics', 'Stealth'].includes(s.name) ? 10
      : s.name === 'Athletics' && form && form.source !== 'Animal Rage' ? form.athletics : undefined
    const total = s.kind === 'save' && (s.name === 'Fortitude' || s.name === 'Reflex' || s.name === 'Will')
      ? savingThrowBreakdown(c, entries, s.name, ranks).total
      : (pest && s.name === 'Athletics' ? -4 : Math.max(ownTotal, formSkill ?? ownTotal))
        - statusPenalty + status + (circumstance?.value ?? 0)
    const conditionalTotal = (bonus: number) => signed(total + Math.max(circumstance?.value ?? 0, bonus) - (circumstance?.value ?? 0))
    const itemTotal = (bonus: number) => signed(total + Math.max(0, bonus - item))
    const forestIncrease = ink ? Math.max(item, ink.value + 1) - item : 0
    return (
      <div key={s.name} className={`skill-row${rank > 0 ? ' trained' : ''} with-item`} role="row">
        <span className="skill-name">{s.name} {editingSkills && c.lores.some(lore => lore.name === s.name)
          && <button type="button" className="lore-remove" aria-label={`Remove ${s.name}`} onClick={() => confirmRemoval(`"${s.name}"`, () => {
            const skillIncreases = Object.fromEntries(Object.entries(c.skillIncreases ?? {}).filter(([, skill]) => skill !== s.name))
            const rankOverrides = { ...c.rankOverrides }
            delete rankOverrides[s.name]
            const subclassSkillChoices = erudite?.lore === s.name
              ? { ...c.subclassSkillChoices, [ERUDITE_LORE_KEY]: '' } : c.subclassSkillChoices
            const withoutLore = { ...c, lores: c.lores.filter(lore => lore.name !== s.name),
              skillPicks: picks.filter(pick => pick !== s.name), skillIncreases, rankOverrides, subclassSkillChoices }
            const stillGranted = [...featLores(c, entries), ...trainedLores.map(grant => grant.name), ...deityGrantedLores(c), ...autoClassSkills(withoutLore, entries), ...backgroundSkills(bg, c), ...extraBackgroundSkills].includes(s.name)
              || activeFeatsNamed(c, "Officer's Medical Training").some(feat => feat.choice === s.name)
                && (ranksAt(withoutLore, entries)[s.name] ?? 0) > 0
            save({ lores: c.lores.filter(lore => lore.name !== s.name), subclassSkillChoices,
              ...(!stillGranted ? { skillPicks: picks.filter(pick => pick !== s.name), skillIncreases, rankOverrides,
                skillTokenUpgrades: c.skillTokenUpgrades?.filter(purchase => purchase.skill !== s.name) } : {}) })
          })}>×</button>}<b>{s.kind === 'save' && (s.name === 'Fortitude' || s.name === 'Reflex' || s.name === 'Will')
          ? <TotalBreakdown label={s.name} breakdown={savingThrowBreakdown(c, entries, s.name, ranks)} signedTotal />
          : signed(total)}{formSkill !== undefined && (pest && s.name === 'Athletics' || formSkill > ownTotal)
          && <SourceNote source={form?.source ?? ''} note={`${s.name} ${signed(formSkill)}${pest && s.name === 'Athletics' ? '.' : ' unless your own modifier is higher.'}`} />}{!!armorPenalty
          && <SourceNote inlineSource={false} source="Armor check penalty" note={`${armorPenalty} to Strength and Dexterity skill checks and DCs, except actions with the attack trait.`} />}{!!status
          && <SourceNote inlineSource={false} source={athleticRush ? 'Athletic Rush' : ferocious ? 'Ferocious Shape' : 'Imitate Fauna'}
            note={athleticRush ? '+2 status bonus to Athletics checks.' : ferocious ? '+1 status bonus to Athletics checks.' : '+4 status bonus when using Impersonate as an animal.'} />}
          {circumstance?.source === 'Hellknight Preferment' && <SourceNote source={circumstance.source}
            note={`+${circumstance.value} circumstance bonus to Intimidation while wearing Hellknight armor.`} />}
          {!!clumsyPenalty && <SourceNote source={giantStatureSize(c, entries) ? "Giant's Stature: clumsy 1" : 'Giant Instinct: clumsy 1'}
            note={giantStatureSize(c, entries) ? '-1 status penalty to Dexterity-based checks and DCs until Rage ends; status penalties do not stack.'
              : '-1 status penalty to Dexterity-based checks and DCs while wielding the oversized weapon, even outside Rage; status penalties do not stack.'} />}
          {s.kind !== 'save' && !!conditionPenalty(c, ability) && <SourceNote source="Conditions"
            note={`-${statusPenalty} status penalty to this check; status penalties do not stack.`} />}
          {s.name === 'Athletics' && c.raging && !!activeFeatsNamed(c, 'Furious Bully').length
            && <SourceNote source="Furious Bully" note={`${conditionalTotal(2)} for Athletics attack actions (+2 circumstance; circumstance bonuses do not stack).`} />}
          {s.name === 'Athletics' && c.raging && !!activeFeatsNamed(c, 'Brutal Bully').length
            && <SourceNote source="Brutal Bully" note={`On a successful Disarm, Grapple, Reposition, Shove, or Trip, deal bludgeoning damage equal to your Strength modifier (${signed(abilityMod(c.abilities.str))}); add it to critical Trip damage.`} />}
          {s.name === 'Athletics' && c.raging && !!activeFeatsNamed(c, 'Adrenaline Rush').length
            && <SourceNote source="Adrenaline Rush" note={`${signed(total + Math.max(0, 1 - status))} to lift heavy objects, Escape, and Force Open (+1 status; status bonuses do not stack).`} />}
          {s.name === 'Athletics' && !!activeFeatsNamed(c, 'Bashing Charge').length
            && <SourceNote source="Bashing Charge" note={`${conditionalTotal(1)} to Force Open an obstacle during Bashing Charge (+1 circumstance; circumstance bonuses do not stack).`} />}
          {s.name === 'Athletics' && !!activeFeatsNamed(c, 'Unbalancing Sweep').length
            && <SourceNote source="Unbalancing Sweep" note={`${c.raging && activeFeatsNamed(c, 'Furious Bully').length ? conditionalTotal(2) : signed(total)} to Shove or Trip up to three enemies within reach. Roll separately; multiple attack penalty increases after all attempts.`} />}
          {s.name === 'Athletics' && c.raging && !!activeFeatsNamed(c, 'Tangle of Battle').length
            && <SourceNote source="Tangle of Battle" note={`${activeFeatsNamed(c, 'Furious Bully').length ? conditionalTotal(2) : signed(total)} to Grapple an adjacent enemy as a reaction after critically hitting it.`} />}
          {s.name === 'Athletics' && c.raging && !!activeFeatsNamed(c, 'Embrace the Pain').length
            && <SourceNote source="Embrace the Pain" note={`${activeFeatsNamed(c, 'Furious Bully').length ? conditionalTotal(2) : signed(total)} to Grapple a creature within reach or Disarm its weapon as a reaction when its melee attack damages you.`} />}
          {s.name === 'Athletics' && c.raging && !!activeFeatsNamed(c, 'Inner Strength').length
            && <SourceNote source="Inner Strength" note="Spend one action to reduce your enfeebled condition by 1." />}
          {s.kind === 'skill' && s.ability === 'str' && c.raging && isFeatEffectActive(c, 'Ghost Wrangler')
            && <SourceNote source="Ghost Wrangler" note="Can use Strength-based skill checks against incorporeal creatures until the beginning of your next turn." />}
          {s.kind !== 'save' && hellknightSkillNotes(c, s.name).map(benefit =>
            <SourceNote key={`${benefit.feat.slot ?? benefit.feat.name}:${benefit.name}`} source={benefit.name} note={benefit.description} />)}
          {isWitchwarper(c) && c.witchwarper?.anchor === 'Tangible Object' && ['Perception', 'Will'].includes(s.name)
            && <SourceNote source="Tangible Object" note={`${conditionalTotal(1)} against illusions and holograms (+1 circumstance).`} />}
          {isSoldier(c) && c.level >= 3 && ['Athletics', 'Intimidation'].includes(s.name)
            && <SourceNote source="Fearsome Bulwark" note={`${signed(total - armorPenalty + Math.max(0, abilityMod(c.abilities.con) - abil + statusPenalty - conditionPenalty(c, 'con')))} to ${
              s.name === 'Athletics' ? 'Reposition or Shove' : 'Coerce or Demoralize'} using Constitution instead of ${ABILITY_LABEL[ability]}.`} />}
          {s.name === 'Athletics' && soldierStyle(c)?.name === 'Armor Storm'
            && <SourceNote source="Armor Storm" note={`${signed(total - armorPenalty + Math.max(0, 1 - status))} to Disarm, Grapple, Reposition, Shove, or Trip suppressed foes (+1 status).
              ${c.level >= 3 ? `Reposition or Shove using Fearsome Bulwark: ${signed(total - armorPenalty + Math.max(0, 1 - status) + Math.max(0, abilityMod(c.abilities.con) - abil + statusPenalty - conditionPenalty(c, 'con')))}.` : ''}
              No free hand required; success suppresses until your next turn.`} />}
          {ink && <SourceNote inlineSource={false} source={ink.source}
            note={`Stealth ${signed(total + forestIncrease)} in forests`} />}
          {artifact && <SourceNote inlineSource={false} source={artifact.source} note={`+${artifact.value} item bonus while carried; item bonuses do not stack.`} />}
          {professionalTools.filter(tool => tool.skills.includes(s.name)).map(tool =>
            <SourceNote key={tool.name} source={tool.name}
              note={`${itemTotal(tool.bonus)} when used as a toolkit (+${tool.bonus} item; item bonuses do not stack).`} />)}
          {s.name === 'Crafting' && dwarvenAxe && <SourceNote inlineSource={false} source="Axe of the Dwarven Lords"
            note={`${itemTotal(4)} to Craft armor, jewelry, metalwork, stonework, snares, traps, and weapons while carrying the axe (+4 item; item bonuses do not stack).`} />}
          {arrowhead && <SourceNote inlineSource={false} source={arrowhead.source}
            note={`Survival ${signed(total + Math.max(0, arrowhead.value - item))} against your Hunt Prey target (+${arrowhead.value} item bonus; item bonuses do not stack).`} />}
          {!!filigreeItem && <SourceNote inlineSource={false} source="Clan dagger filigree" note={`+${filigreeItem} item bonus from ${s.name === 'Athletics' ? "Trudd's Strength" : s.name === 'Society' ? "Kols's Oath" : "Bolka's Blessing"}.`} />}
          {!!filigree && s.name === 'Perception' && <SourceNote inlineSource={false} source="Bolka's Blessing" note={`${itemTotal(filigree)} to Sense Motive (+${filigree} item bonus).`} />}
          {s.name === 'Perception' && sights.map(sight => {
            const grade = /\(([^)]+)\)$/.exec(sight.name)?.[1]?.toLowerCase()
            const bonus = sight.name.startsWith('Truesight') ? grade === 'tactical' ? 2 : 1
              : grade === 'superior' ? 3 : grade === 'advanced' ? 2 : grade === 'tactical' ? 1 : 0
            return bonus > 0 && <SourceNote key={sight.id} inlineSource={false} source={sight.name}
              note={`${itemTotal(bonus)} to visual Seek checks through the sight (+${bonus} item bonus; item bonuses do not stack).`} />
          })}
          {!!filigree && s.name === 'Intimidation' && <SourceNote inlineSource={false} source="Trudd's Strength" note={`${itemTotal(filigree)} to Coerce (+${filigree} item bonus).`} />}
          {medicalTraining && <SourceNote inlineSource={false} source="Officer's Medical Training" note="You can use Intelligence instead of Wisdom for Medicine checks." />}
          {temporaryTrainings.filter(training => training.skill === s.name && training.rank > permanentRank).map(training =>
            <SourceNote key={`${training.feat.name}:${s.name}`} inlineSource={false} source={training.feat.name}
              note={training.feat.name === 'Eclectic Obsession'
                ? 'Temporary proficiency for 10 minutes or until you critically fail a check with this Lore; cannot qualify for skill increases or permanent options.'
                : 'Temporary proficiency until daily preparations; cannot qualify for skill increases or permanent options.'} />)}
          {s.name === 'Fortitude' && !!activeFeatsNamed(c, 'Radiation Resistant').length && <SourceNote inlineSource={false}
            source="Radiation Resistant" note={`${conditionalTotal(1)} against radiation effects (+1 circumstance).`} />}
          {s.name === 'Crafting' && !!activeFeatsNamed(c, 'Tinkering Fingers').length && <SourceNote inlineSource={false}
            source="Tinkering Fingers" note={`Repair without a toolkit without the penalty; ${conditionalTotal(1)} to Repair checks with a repair toolkit (+1 circumstance).`} />}
          {s.name === 'Crafting' && !!activeFeatsNamed(c, 'Eye for Treasure').length && <SourceNote inlineSource={false}
            source="Eye for Treasure" note={`${conditionalTotal(1)} to Recall Knowledge using Crafting (+1 circumstance; circumstance bonuses do not stack).`} />}
          {s.name === 'Nature' && !!activeFeatsNamed(c, 'Rider').length && <SourceNote inlineSource={false}
            source="Rider" note={`${conditionalTotal(1)} to Command an Animal checks for your own animal companion, if a check is required.`} />}
          {CONDITIONAL_BONUSES.filter(b => b.stats.includes(s.name) && activeFeatsNamed(c, b.feat).length > 0).map(b => <SourceNote key={b.feat} inlineSource={false}
            source={b.feat} note={`${b.type === 'status' ? signed(total + b.bonus) : conditionalTotal(b.bonus)} ${b.text} (+${b.bonus} ${b.type}).`} />)}
          {s.name === 'Diplomacy' && !!activeFeatsNamed(c, 'Extended Family').length && <SourceNote inlineSource={false}
            source="Extended Family" note={`${conditionalTotal(1)} to Make an Impression or Request against ysoki (+1 circumstance).`} />}
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
          {s.kind === 'perception' && !!activeFeatsNamed(c, "Stonemason's Eye").length && <SourceNote inlineSource={false}
            source="Stonemason's Eye" note={`${conditionalTotal(2)} to notice unusual stonework and stonework traps (+2 circumstance; circumstance bonuses do not stack).`} />}
          {hazardFinder && (s.kind === 'perception' || s.kind === 'save') && <SourceNote inlineSource={false}
            source="Hazard Finder" note={`${conditionalTotal(1)} ${s.kind === 'perception'
              ? 'to find traps and hazards; does not affect initiative' : 'against hazard effects'} (+1 circumstance; circumstance bonuses do not stack).`} />}
          {c.systems.includes('sf2e') && s.kind === 'perception' && !!activeFeatsNamed(c, 'Danger Awareness').length
            && <SourceNote inlineSource={false} source="Danger Awareness"
              note={`${conditionalTotal(1)} to find traps and hidden, undetected, or unnoticed creatures (+1 circumstance). Check for traps even without Searching; win initiative ties against opponents.`} />}
          {c.systems.includes('sf2e') && s.kind === 'save' && !!activeFeatsNamed(c, 'Danger Awareness').length
            && <SourceNote inlineSource={false} source="Danger Awareness"
              note={`${conditionalTotal(1)} against traps (+1 circumstance; circumstance bonuses do not stack).`} />}
          {c.systems.includes('sf2e') && c.ancestry === 'Vesk' && c.heritage === 'Fork-Tongued Vesk' && s.kind === 'save'
            && <SourceNote inlineSource={false} source="Fork-Tongued Vesk"
              note={`${conditionalTotal(1)} against disease and poison (+1 circumstance; circumstance bonuses do not stack). Immune to poison damage from fork-tongued vesk jaws.`} />}
          {c.systems.includes('sf2e') && c.ancestry === 'Vesk' && c.heritage === 'Venomthought Vesk' && s.name === 'Occultism'
            && <SourceNote inlineSource={false} source="Venomthought Vesk"
              note={`${conditionalTotal(1)} to Recall Knowledge about psychic traditions and philosophies (+1 circumstance).`} />}
          {s.name === 'Athletics' && heritages.has('Woodland Elf') && <SourceNote inlineSource={false}
            source="Woodland Elf" note="Climb trees, vines, or foliage at half your Speed on a success and full Speed on a critical success; Quick Climb allows full Speed on a success. No effect on a climb Speed. You can always Take Cover in forest terrain." />}
          {s.name === 'Athletics' && !!activeFeatsNamed(c, 'Athletic Might').length && <SourceNote source="Athletic Might"
            note="On an Athletics check to Climb or Swim, a success becomes a critical success." />}
          {s.name === 'Athletics' && !form && isSpellActive(c, entries, 'Untamed Form')
            && !!activeFeatsNamed(c, 'Ferocious Shape').length && <SourceNote source="Ferocious Shape"
              note="+1 status to Athletics when the chosen Untamed Form grants a specific Athletics modifier; status bonuses do not stack." />}
          {['Acrobatics', 'Athletics'].includes(s.name) && !!activeFeatsNamed(c, 'Shore Step').length && <SourceNote source="Shore Step"
            note={s.name === 'Acrobatics' ? 'A success to Balance on a slippery or wet surface becomes a critical success.' : 'A success to Swim becomes a critical success.'} />}
          {s.name === 'Acrobatics' && !!activeFeatsNamed(c, 'Steadying Stone').length && <SourceNote source="Steadying Stone"
            note="A success to Balance on uneven earth or rock becomes a critical success." />}
          {s.kind === 'save' && !!activeFeatsNamed(c, 'Steadying Stone').length && <SourceNote source="Steadying Stone"
            note={`${conditionalTotal(heritages.has('Rock Dwarf') ? 3 : 2)} against spells or effects that would knock you prone while on the ground (+${heritages.has('Rock Dwarf') ? 3 : 2} circumstance). Fortitude and Reflex DCs gain the same bonus against Shove or Trip.`} />}
          {s.kind === 'save' && shieldRaised(c) && !!activeFeatsNamed(c, 'Necromantic Deflection').length && <SourceNote source="Necromantic Deflection"
            note={`${conditionalTotal(raisedShieldBonus(c, entries))} against necromancy spells while your shield is raised (+${raisedShieldBonus(c, entries)} circumstance). If you have Shield Block, it can also prevent nonphysical damage from necromancy spells.`} />}
          {s.kind === 'save' && !!activeFeatsNamed(c, 'Haughty Obstinacy').length && <SourceNote source="Haughty Obstinacy"
            note="Against mental effects that directly control your actions, a successful save becomes a critical success." />}
          {s.kind === 'save' && !!activeFeatsNamed(c, 'Grim Insight').length && <SourceNote source="Grim Insight"
            note="Against fear, a success becomes a critical success and the source is off-guard to you until the end of your next turn." />}
          {s.name === 'Perception' && !!activeFeatsNamed(c, 'Illusion Sense').length && <SourceNote source="Illusion Sense"
            note="Within 10 feet of an illusion that can be disbelieved, the GM rolls a secret check to disbelieve it, even without interacting." />}
          {s.name === 'Perception' && !!activeFeatsNamed(c, 'Spiritual Guides').length && <SourceNote source="Spiritual Guides"
            note="Once per day, react to a failed (not critically failed) Perception or skill check to reroll it, using the second result even if worse." />}
          {s.name === 'Will' && !!activeFeatsNamed(c, "Cavalier's Banner").length && <SourceNote source="Cavalier's Banner"
            note={`${conditionalTotal(1)}, DC ${10 + total + Math.max(0, 1 - (circumstance?.value ?? 0))} against fear while within 30 feet of your mount's banner (+1 circumstance; applies to allies too). If the banner is destroyed or removed, allies within 30 feet become frightened 1.${activeFeatsNamed(c, 'Stalwart Standard').length ? ' Allies benefiting from the banner gain +1 circumstance to Fortitude and Reflex DCs against Disarm, Grapple, Shove, and Trip, and +1 status to attacks against creatures that damaged a lower-level innocent within the last round. Summoned creatures, companions, and creatures deliberately endangered by you or your allies do not count as innocents.' : ''}`} />}
          {s.kind === 'skill' && !!activeFeatsNamed(c, 'Rising to the Challenge').length && <SourceNote source="Rising to the Challenge"
            note="Once per day outside combat, when you critically fail a skill check, reroll it and use the second result." />}
          {s.name === 'Intimidation' && !!activeFeatsNamed(c, 'Haughty Obstinacy').length && <SourceNote source="Haughty Obstinacy"
            note="A creature's failure to Coerce you becomes a critical failure; it cannot Coerce you again for 1 week." />}
          {s.name === 'Intimidation' && c.systems.includes('sf2e') && c.ancestry === 'Vesk'
            && !!activeFeatsNamed(c, 'Opening Roar').length && <SourceNote source="Opening Roar"
              note="At the start of combat, if aware of foes and not Sneaking or Hiding, use Intimidation for initiative and apply its result to Demoralize one observed foe." />}
          {s.name === 'Intimidation' && c.systems.includes('sf2e') && c.ancestry === 'Vesk'
            && !!activeFeatsNamed(c, 'Menacing Snarl').length && <SourceNote source="Menacing Snarl"
              note="Once per hour when you frighten a creature, use a free action to verbally menace it and increase its frightened value by 1 (maximum 3)." />}
          {s.name === 'Intimidation' && c.systems.includes('sf2e') && c.ancestry === 'Vesk'
            && !!activeFeatsNamed(c, 'Terrifying Bravado').length && <SourceNote source="Terrifying Bravado"
              note="When you critically succeed at a save against a creature's fear effect, or a creature fails or critically fails to Demoralize you, react to attempt to Demoralize that creature." />}
          {s.name === 'Intimidation' && c.systems.includes('sf2e') && c.className === 'Operative'
            && !!activeFeatsNamed(c, 'Stop Them In Their Tracks').length && <SourceNote source="Stop Them In Their Tracks"
              note="Demoralize your mark without the –4 circumstance penalty for not sharing a language; on a critical success, also immobilize it for 1 round." />}
          {s.kind === 'save' && s.name === 'Reflex' && c.systems.includes('sf2e') && c.className === 'Operative'
            && !!activeFeatsNamed(c, 'Swift Reposition').length && <SourceNote source="Swift Reposition"
              note="Before rolling a Reflex save, react to Step or Leap and gain +2 circumstance to the save; still roll even if movement takes you out of the effect's range." />}
          {s.name === 'Athletics' && c.systems.includes('sf2e') && c.ancestry === 'Vesk'
            && !!activeFeatsNamed(c, 'Wriggling Tail').length && <SourceNote source="Wriggling Tail"
              note="When you become grabbed, react to drop part of your tail, end grabbed, then Step. Until the tail regrows (1 day or regeneration), you cannot use it and take –2 circumstance to Balance." />}
          {trainedLores.filter(grant => grant.name === s.name).map(grant => <SourceNote key={grant.source} inlineSource={false}
            source={grant.source} note="Free trained Lore; does not use a skill training pick." />)}
          {s.name === 'Intimidation' && !!activeFeatsNamed(c, 'Pick On Someone My Size').length && <SourceNote inlineSource={false}
            source="Pick On Someone My Size" note={`${conditionalTotal(1)} to Demoralize a larger creature that attacked an ally since the start of your last turn (+1 circumstance).`} />}
          {s.name === 'Intimidation' && c.raging && !!activeFeatsNamed(c, 'Terrifying Howl').length && <SourceNote source="Terrifying Howl"
            note={`${signed(total)} to Demoralize each enemy within 30 feet, without a penalty for not sharing a language. Each target is immune to your Terrifying Howl for 1 minute.`} />}
          {s.name === 'Perception' && !!activeFeatsNamed(c, 'Enhanced Olfactory System').length && <SourceNote inlineSource={false}
            source="Enhanced Olfactory System" note={`${conditionalTotal(2)} to Seek a creature or object within scent range (+2 circumstance).`} />}
          {s.kind === 'save' && !!activeFeatsNamed(c, 'Pain Tolerance').length && <SourceNote inlineSource={false}
            source="Pain Tolerance" note={`${conditionalTotal(1)} against effects that would make you clumsy, drained, or enfeebled (+1 circumstance).`} />}
          {s.name === 'Fortitude' && c.raging && !!activeFeatsNamed(c, 'Shake It Off').length && <SourceNote source="Shake It Off"
            note={`Reduce frightened by 1, then attempt a Fortitude save at ${signed(savingThrowBreakdown({ ...c, conditions: {
              ...c.conditions, frightened: Math.max(0, conditionValue(c, 'frightened') - 1) } }, entries, 'Fortitude', ranks).total)} against sickened: reduce sickened by 1 on failure, 2 on success, or 3 on critical success; no reduction on critical failure.`} />}
          {s.name === 'Will' && !!activeFeatsNamed(c, 'Creature Comforts').length && <SourceNote source="Creature Comforts"
            note="When you become frightened while under a morph or polymorph effect, react to reduce frightened by 1, to a minimum of 0." />}
          {s.kind === 'save' && !!activeFeatsNamed(c, 'Blast Resistance').length && <SourceNote inlineSource={false}
            source="Blast Resistance" note="Against an effect that causes dazzled or deafened, a successful saving throw becomes a critical success." />}
          {s.kind === 'save' && hasDivineIntercession(c, 'Cayden Cailean', 'moderate-boon') && <SourceNote inlineSource={false}
            source="Cayden Cailean (Moderate Boon)" note={`Against fear effects, a success becomes a critical success.${classFeatures(entries, c).some(feature => feature.name === 'Bravery') ? ' With fighter Bravery, a critical failure becomes a failure.' : ''}`} />}
          {s.kind === 'save' && shadowpiercer && <SourceNote inlineSource={false} source="Shadowpiercer"
            note={`${signed(total + 2)} against darkness and shadow effects while wielding Shadowpiercer (+2 status). Also applies to allies within 60 feet; does not stack with other status bonuses.`} />}
          {s.kind === 'skill' && memoriesOfValor?.choice === s.name && <SourceNote source="Memories of Valor"
            note={`Once ${memoriesHourly ? 'per hour' : 'per day'}, use one action to increase this skill's proficiency by one rank for 1 minute (up to master).`} />}
          {s.kind === 'save' && artifactNotes.map(source => <SourceNote key={source} inlineSource={false} source={source} note={artifactSaves[source]} />)}
          {s.kind === 'skill' && hasDivineIntercession(c, 'Kazutal', 'major-boon') && <SourceNote inlineSource={false}
            source="Kazutal (Major Boon)" note="When you Aid, or another creature Aids you, the helper can automatically succeed. If rolling, a success becomes a critical success granting +4 circumstance, regardless of proficiency. Applies only to Aid, not ordinary checks." />}
          {armorSkill && <SourceNote inlineSource={false} source={armorSkill.source} note={`+${armorSkill.value} circumstance bonus during Overdrive.`} />}
          {['Deception', 'Diplomacy', 'Intimidation', 'Performance'].includes(s.name) && !!activeFeatsNamed(c, 'Shiny').length
            && <SourceNote inlineSource={false} source="Shiny" note={`${s.name} ${conditionalTotal(3)} when using Aid.`} />}
          {s.name === 'Survival' && wasteland && <SourceNote inlineSource={false} source="Wasteland Warrior" note={hazardNote} />}
          {s.name === 'Survival' && terrainExpertise && <SourceNote inlineSource={false} source="Terrain Expertise"
            note={`${conditionalTotal(1)} to Survival in ${terrainExpertise.terrains.join(', ')} terrain.`} />}
          </b>{editingSkills && s.kind === 'skill' && permanentRank > 0 && isWitchwarper(c)
            && c.witchwarper?.anchor === 'Core Memories' && <button type="button"
              aria-label={`Core Memories ${s.name}`} aria-pressed={c.witchwarper.coreMemorySkill === s.name}
              onClick={() => {
                const selected = c.witchwarper?.coreMemorySkill === s.name
                const select = () => save({ witchwarper: { ...c.witchwarper, coreMemorySkill: selected ? undefined : s.name } })
                if (selected) confirmRemoval(`Core Memories Assurance (${s.name})`, select)
                else select()
              }}>Assurance</button>}</span>
        <span className="rank-dots" role="group" aria-label={`${s.name} proficiency`}>
          {RANK_LETTERS.map((letter, i) => {
            const target = permanentRank === i + 1 ? i : i + 1
            const temporary = temporaryTrainings.find(training => training.skill === s.name
              && training.rank === i + 1 && training.rank > permanentRank)
            const downloadAvailable = !!temporary || temporaryTrainings.some(training => training.rank === i + 1
              && (training.skill === undefined || permanentRank < i + 1)
              && (training.feat.name !== 'Eclectic Obsession' || /.+\s+lore$/i.test(s.name))
              && (training.feat.name !== 'Consult the Stars'
                || ['cha', 'int', 'wis'].includes(s.ability ?? (/ lore$/i.test(s.name) ? 'int' : ''))))
            const backgroundChoice = i === 0 ? trainingChoice(s.name) : undefined
            const trainedDisabled = i === 0 && !backgroundChoice && !eruditeChoice(s.name) && (
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
                title={temporary ? `${temporary.feat.name}: temporary proficiency` : s.kind !== 'skill' ? 'Set by class and features' : i === 0 && grantedTraining.includes(s.name)
                  ? picks.includes(s.name) ? `Refund redundant training choice; ${heritageSkills.includes(s.name) ? 'Pioneer Human' : 'Ancestral Skills'} keeps this skill trained`
                    : `Trained granted by ${heritageSkills.includes(s.name) ? 'Pioneer Human' : 'Ancestral Skills'}`
                  : backgroundChoice ? `${backgroundChoice.value ? 'Refund' : 'Choose'} training from ${backgroundChoice.background.name}`
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
        {circumstance && circumstance.source !== 'Hellknight Preferment' && <span className="skill-part skill-circumstance"><small>Circumstance</small>{signed(circumstance.value)} <small>({circumstance.source})</small></span>}
      </div>
    )
  })

  if (part === 'senses') return <div className="skill-grid" role="table" aria-label="Perception">
    {renderRows(perception)}
  </div>
  if (part === 'offense') {
    const offensiveDefense = offensiveDefenseAttack(c, entries)
    const weaponEntries = offensiveDefense ? [...entries, offensiveDefense.entry] : entries
    return (
      <>
        <WeaponProficiency c={c} entries={entries} />
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
        <WeaponList c={c} entries={weaponEntries} save={save} displayOnly showAddWeapon
          additionalWeapons={offensiveDefense ? [offensiveDefense.weapon] : []} />
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
    const hpBonuses = hitPointBonuses(c, entries)
    const form = activeBattleForm(c, entries)
    const oaken = oakenResilience(c, entries)
    const divineWeaknesses = divineIntercessionWeaknesses(c)
    const ac = armorClassBreakdown(c, entries)
    const acCircumstance = Math.max(0, ...ac.parts.filter(part => part.label.endsWith('(circumstance)')).map(part => part.value))
    const morphActive = !!form || !!giantStatureSize(c, entries) || !!c.raging && !!c.animalisticBrutality
      || (c.activeSpells ?? []).some(name => isSpellActive(c, entries, name)
        && entries.some(entry => entry.kind === 'spell' && entry.name === name
          && entry.traits.some(trait => /^(?:morph|polymorph)$/i.test(trait))))
      || (c.activeFeatEffects ?? []).some(name => activeFeatsNamed(c, name).length > 0
        && entries.some(entry => entry.kind === 'feat' && entry.name === name
          && entry.traits.some(trait => /^(?:morph|polymorph)$/i.test(trait))))
    return (
      <>
        <div className="defense-summary">
          <span><small>Armor Class</small><b><TotalBreakdown label="Armor Class" breakdown={ac} />
            {c.raging && barbarianInstinct(c, entries) === 'elemental' && <SourceNote source="Elemental Rage"
              note="Concealed against ranged attacks; this concealment cannot be used to Hide or Sneak." />}
            {!!activeFeatsNamed(c, 'Farabellus Flip').length && <SourceNote source="Farabellus Flip"
              note={`Reaction against a melee Strike: AC ${ac.total + Math.max(0, 2 - acCircumstance)} (+2 circumstance, does not stack). If hit, Step to an open space within the attacker's reach.`} />}
            {hazardFinder && <SourceNote inlineSource={false} source="Hazard Finder"
              note="+1 circumstance bonus to AC against hazard attacks; circumstance bonuses do not stack." />}</b></span>
          <span><small>Hit Points</small><b>{maxHp(c, entries)}
            {c.raging && (c.className === 'Barbarian' || !!activeFeatsNamed(c, 'Barbarian Dedication').length)
              && <SourceNote source="Rage" note={`When you Rage, gain ${Math.max(0, c.level + abilityMod(c.abilities.con))} temporary HP, lost when Rage ends. You cannot gain temporary HP from Rage again for ${classFeatures(entries, c).some(feature => feature.name === 'Revitalizing Rage') ? 'one full turn outside Rage' : '1 minute'}.${activeFeatsNamed(c, 'Second Wind').length ? ' Second Wind lets you gain them earlier, but leaves you fatigued until you rest for 10 minutes when that Rage ends.' : ''}`} />}
            {c.raging && !!activeFeatsNamed(c, 'Share Rage').length && <SourceNote source="Share Rage"
              note={`One willing creature within 30 feet gains Rage effects but can use concentrate actions. It gains no benefits from your instinct or feats.${activeFeatsNamed(c, 'Contagious Rage').length ? ' Contagious Rage allows multiple uses per Rage and lets allies opt into your instinct ability and its weapon specialization benefit, but not greater weapon specialization; they must follow its restrictions.' : ' Once per Rage.'}`} />}
            {c.raging && !!activeFeatsNamed(c, 'Renewed Vigor').length && <SourceNote source="Renewed Vigor"
              note={`One action: gain ${Math.max(0, Math.floor(c.level / 2) + abilityMod(c.abilities.con))} temporary HP, or ${Math.max(0, c.level + abilityMod(c.abilities.con))} if you made an attack action this turn. These temporary HP last until Rage ends.`} />}
            {c.raging && !!activeFeatsNamed(c, 'Unstoppable Juggernaut').length && <SourceNote source="Unstoppable Juggernaut"
              note="When reduced to 0 HP, end Rage as a reaction to stay at 1 HP and become wounded 2, or increase wounded by 2." />}
            {hpBonuses.length > 0
            && <SourceNote source="Hit Points" note={hpBonuses.map(bonus => `${signed(bonus.value)} ${bonus.source}`).join(', ')} />}
            {!!activeFeatsNamed(c, 'Life-Giving Magic').length && <SourceNote source="Life-Giving Magic"
              note={`After casting an innate spell from a gnome heritage or ancestry feat, gain ${Math.max(1, Math.floor(c.level / 2))} temporary Hit Points until the end of your next turn; once per minute.`} />}
            {!!activeFeatsNamed(c, 'Vivacious Conduit').length && <SourceNote source="Vivacious Conduit"
              note={`After resting for 10 minutes, regain ${Math.max(0, abilityMod(c.abilities.con) * Math.floor(c.level / 2))} Hit Points. This vitality healing stacks with Treat Wounds.`} />}
            {!!activeFeatsNamed(c, 'Scar-Thick Skin').length && <SourceNote source="Scar-Thick Skin"
              note="Flat check to end persistent bleed: DC 10, or DC 5 with especially appropriate assistance." />}
            {!!activeFeatsNamed(c, 'Incredible Ferocity').length && <SourceNote source="Incredible Ferocity"
              note="Use Orc Ferocity once per hour instead of once per day." />}
            {!!activeFeatsNamed(c, 'Defy Death').length && <SourceNote source="Defy Death"
              note={`Recovery check DC is ${activeFeatsNamed(c, 'Toughness').length ? 8 : 9} + your dying value.`} />}
            {!!activeFeatsNamed(c, "Lifeblood's Call").length && <SourceNote source="Lifeblood's Call"
              note="+2 circumstance to melee Strike damage per wounded and doomed value combined (max +8)." />}
            {!!activeFeatsNamed(c, 'Bloody Blows').length && <SourceNote source="Bloody Blows"
              note="Critical hits with lethal unarmed Strikes deal 1d4 persistent bleed damage." />}
            {!!activeFeatsNamed(c, 'Stubborn Persistence').length && <SourceNote source="Stubborn Persistence"
              note="When you would become fatigued, succeed at a DC 17 flat check to avoid it. If the underlying cause remains, repeat at a GM-determined interval." />}</b></span>
        </div>
        {(['Inner Strength', 'Shake It Off', 'Creature Comforts'].some(name => activeFeatsNamed(c, name).length > 0)
          || !!c.conditions && Object.values(c.conditions).some(value => typeof value === 'number' && value > 0)) && <div className="condition-controls" role="group" aria-label="Conditions">
          {(['frightened', 'sickened', 'enfeebled'] as const).map(name => <label key={name}>
            {name[0].toUpperCase() + name.slice(1)}{' '}
            <input type="number" min="0" step="1" aria-label={`${name[0].toUpperCase() + name.slice(1)} condition`}
              value={conditionValue(c, name)} onChange={event => {
                const value = Number(event.target.value)
                if (!Number.isSafeInteger(value) || value < 0) return
                save({ conditions: { ...c.conditions, [name]: value } })
              }} />
          </label>)}
          {c.raging && !!activeFeatsNamed(c, 'Inner Strength').length && conditionValue(c, 'enfeebled') > 0
            && <button type="button" aria-label="Inner Strength" onClick={() => save({ conditions: { ...c.conditions, enfeebled: conditionValue(c, 'enfeebled') - 1 } })}>Inner Strength</button>}
          {!!activeFeatsNamed(c, 'Creature Comforts').length && morphActive && conditionValue(c, 'frightened') > 0
            && <button type="button" aria-label="Creature Comforts" onClick={() => save({ conditions: { ...c.conditions, frightened: conditionValue(c, 'frightened') - 1 } })}>Creature Comforts</button>}
          {c.raging && !!activeFeatsNamed(c, 'Shake It Off').length
            && (conditionValue(c, 'frightened') > 0 || conditionValue(c, 'sickened') > 0)
            && (conditionValue(c, 'sickened') > 0 ? <label>Shake It Off{' '}
              <select aria-label="Shake It Off save result" value="" onChange={event => {
                const reductions: Record<string, number> = { 'Critical failure': 0, Failure: 1, Success: 2, 'Critical success': 3 }
                const reduction = reductions[event.target.value]
                if (reduction === undefined) return
                save({ conditions: { ...c.conditions, frightened: Math.max(0, conditionValue(c, 'frightened') - 1),
                  sickened: Math.max(0, conditionValue(c, 'sickened') - reduction) } })
              }}>
                <option value="">Save result</option>
                <option>Critical failure</option><option>Failure</option><option>Success</option><option>Critical success</option>
              </select>
            </label> : <button type="button" aria-label="Shake It Off" onClick={() => save({ conditions: {
              ...c.conditions, frightened: conditionValue(c, 'frightened') - 1 } })}>Shake It Off</button>)}
        </div>}
        {!!activeFeatsNamed(c, 'Current Spell').length && <label>Current Spell{' '}
          <select aria-label="Current Spell active trait" value={c.currentSpell ?? ''} onChange={event => {
            const value = event.target.value
            if (value !== '' && value !== 'air' && value !== 'water' && value !== 'air and water') return
            save({ currentSpell: value || undefined })
          }}>
            <option value="">Inactive</option>
            <option value="air">Air</option><option value="water">Water</option><option value="air and water">Air and water</option>
          </select>
          <SourceNote source="Current Spell" note="After casting an air or water spell, benefits last until the start of your next turn." />
        </label>}
        {!!activeFeatsNamed(c, 'Fisheye').length && <>
          <label title="Once per day for 1 hour after eating the left eye of a fish.">
            <input type="checkbox" aria-label="Fisheye active" checked={isFeatEffectActive(c, 'Fisheye')}
              disabled={!isFeatEffectActive(c, 'Fisheye') && !!c.dailyFeatUses?.Fisheye}
              onChange={event => save({ ...featEffectChange(c, 'Fisheye', event.target.checked),
                ...(event.target.checked ? { dailyFeatUses: { ...c.dailyFeatUses, Fisheye: true } } : {}) })} /> Fisheye active
          </label>
          <label><input type="checkbox" aria-label="Fisheye used" checked={!!c.dailyFeatUses?.Fisheye}
            onChange={event => save({ dailyFeatUses: { ...c.dailyFeatUses, Fisheye: event.target.checked } })} /> Fisheye used</label>
          {isFeatEffectActive(c, 'Fisheye') && <SourceNote source="Fisheye"
            note="Hold your breath 25 times as long as usual. Temporary Breath Control cannot qualify you for permanent options." />}
        </>}
        {!!activeFeatsNamed(c, 'Verdant Metamorphosis').length && <>
          <label><input type="checkbox" aria-label="Verdant Rest active" checked={isFeatEffectActive(c, 'Verdant Metamorphosis')}
            onChange={event => save(featEffectChange(c, 'Verdant Metamorphosis', event.target.checked))} /> Verdant Rest active</label>
          {isFeatEffectActive(c, 'Verdant Metamorphosis') && <SourceNote source="Verdant Rest"
            note={`Cannot move or affect anything outside the plant. In natural sunlight, 10 minutes restores ${Math.floor(maxHp(c, entries) / 2)} Hit Points. Daily rest restores full Hit Points and removes non-permanent drained, enfeebled, clumsy and stupefied conditions, and poisons and diseases of level 19 or lower.`} />}
        </>}
        {!!activeFeatsNamed(c, 'Harden Flesh').length && <label title="Requires earthen or stone ground; ends at the beginning of your next turn.">
          <input type="checkbox" aria-label="Harden Flesh active" checked={!!c.hardenFleshActive}
            onChange={event => save({ hardenFleshActive: event.target.checked })} /> Harden Flesh active
        </label>}
        {form && <div className="defense-summary">
          {form.source !== 'Animal Rage' && form.temporaryHp > 0 && <span><small>Temporary Hit Points</small><b>{form.temporaryHp}
            <SourceNote source={form.source} note={form.source === 'Dragon Transformation'
              ? 'Add to temporary HP from entering Rage or another Rage action; not added to maximum Hit Points.'
              : 'Granted when cast; not added to maximum Hit Points.'} inlineSource={false} /></b></span>}
          <span><small>Size</small><b>{form.size}
            <SourceNote source={form.source} note={form.source === 'Dragon Transformation'
              ? 'Gain the dragon trait. Only dragon unarmed attacks can Strike; equipment is absorbed. You have hands and can use manipulate actions.'
              : form.source === 'Ancestral Embrace Avatar'
              ? `Only Avatar attacks can Strike; equipment is absorbed. You have hands and can use manipulate actions. ${form.note}`
              : 'pest' in form && form.pest ? 'Gain the animal trait. Cannot Strike; equipment is absorbed. Cannot speak, Cast Spells, or use manipulate actions requiring hands.'
              : form.source === 'Animal Rage' ? `Gain the animal trait. Use your own unarmed attacks and retain constant gear abilities.${form.note ? ` ${form.note}` : ''} Cannot speak, Cast Spells, or use manipulate actions requiring hands.`
              : `${form.attacks[0]?.data.battle_form
              ? `Gain the animal trait.${form.note ? ` ${form.note}` : ''}`
              : 'Gain the animal and dinosaur traits.'} Only the form's unarmed attacks can Strike; equipment is absorbed. Cannot speak, Cast Spells, or use manipulate actions requiring hands.`} inlineSource={false} /></b></span>
          {!!activeFeatsNamed(c, 'Towering Transformation').length && <SourceNote source="Towering Transformation"
            note={`When a polymorph increases your size, enemies smaller than your new size within 30 feet attempt Will saves against ${classDifficultyClass(c, entries) ?? 'your class DC'} or your spell DC, whichever is higher. Failure causes frightened 1; critical failure causes frightened 2 and allows you to push the target up to 10 feet.`} />}
        </div>}
        {giantStatureSize(c, entries) && <div className="defense-summary">
          <span><small>Size</small><b>{giantStatureSize(c, entries)}</b></span>
        </div>}
        <ArmorProficiency c={c} entries={entries} />
        <h4>Armor</h4>
        <ArmorList c={c} entries={entries} save={save} part="armor" />
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
        {c.raging && !!activeFeatsNamed(c, 'Ghost Wrangler').length && <label>
          <input type="checkbox" aria-label="Ghost Wrangler active" checked={isFeatEffectActive(c, 'Ghost Wrangler')}
            onChange={event => save(featEffectChange(c, 'Ghost Wrangler', event.target.checked))} /> Ghost Wrangler active
          <SourceNote source="Ghost Wrangler" note="One action while raging; fists gain ghost touch until the beginning of your next turn." />
        </label>}
        {!!activeFeatsNamed(c, 'Scars of Steel').length && <label>
          <input type="checkbox" aria-label="Scars of Steel used" checked={!!c.dailyFeatUses?.['Scars of Steel']}
            onChange={event => save({ dailyFeatUses: { ...c.dailyFeatUses, 'Scars of Steel': event.target.checked } })} />
          {' '}Scars of Steel used <SourceNote source="Scars of Steel"
            note={`Reaction while raging, once per day: gain resistance ${Math.max(0, abilityMod(c.abilities.con) + Math.floor(c.level / 2))} to an opponent's triggering critical hit that deals physical damage.`} />
        </label>}
        {c.raging && <FeatEffectToggle c={c} save={save} name="Spirits' Interference" label="Spirits' Interference active"
          title="One action; ranged attackers must pass a DC 5 flat check until Rage ends." />}
        {c.raging && isFeatEffectActive(c, "Spirits' Interference") && <SourceNote source="Spirits' Interference"
          note="Ranged attacks against you require a successful DC 5 flat check or miss with no effect." />}
        {c.raging && isFeatEffectActive(c, 'Come and Get Me') && <SourceNote source="Come and Get Me"
          note={`Damage rolls against you gain +2 circumstance. A creature that hits you is off-guard to you until the end of your next turn; if you hit it before then, gain ${Math.max(0, abilityMod(c.abilities.con))} temporary HP, doubled on a critical hit, until Rage ends.`} />}
        {skin && <SourceNote source="Animal Skin" note={`+${skin.itemBonus} item AC; Dexterity cap +${skin.dexCap}.`} />}
        {isPioneerHuman(c) && (c.pioneerEnvironment === 'Cold' || c.pioneerEnvironment === 'Heat')
          && <SourceNote source="Pioneer Human"
            note={`${c.pioneerEnvironment.toLowerCase()} environmental effects are one step less extreme. This is not damage resistance.`} />}
        <FeatEffectToggle c={c} save={save} name="Heart of the Kaiju" label="Kaiju form resistance active"
          title="Physical resistance 5 only while in kaiju form. This control does not apply the form's other statistics." />
        <div className="skill-grid" role="table" aria-label="Defense">
          {renderRows(defense)}
        </div>
        {spec ? <small>Armor Specialization: {spec.group}{spec.summary && `, ${spec.summary}`}<SourceNote
          source={`${spec.armor}${spec.feat ? ` via ${spec.feat} feat` : spec.feature ? ` via ${spec.feature} class feature` : ''}`}
          note={[spec.effect, spec.group === 'Plate' ? 'Plate resistance applies to all slashing damage, not only critical hits.'
            : spec.group === 'Chain' ? 'Chain reduction applies only when you are critically hit.' : ''].filter(Boolean).join(' ')} /></small> : <small>Armor Specialization: None</small>}
        <small>Resistances: {res.length ? res.map((r, index) => {
          const note = spec && r.source === `${spec.group} Armor Specialization` ? spec.effect : RESISTANCE_NOTES[r.source]
          return <span key={`${r.damage}:${r.source}`}>{index > 0 && ', '}{r.damage} {r.value}
            <SourceNote source={r.source} note={note ?? `Grants ${r.damage} resistance ${r.value}.`} /></span>
        }) : 'None'}
          {activeFeatsNamed(c, 'Harden Flesh').length > 0 && <>
            {' '}<SourceNote source="Harden Flesh"
              note={`After using its one-action activity while standing on earthen or stone ground, you gain resistance ${Math.min(6, 3 + Math.max(0, Math.floor((c.level - 8) / 4)))} to physical damage except adamantine until the beginning of your next turn.`} />
          </>}
        </small>
        {divineWeaknesses.length > 0 && <small>Weaknesses: {divineWeaknesses.map((weakness, index) =>
          <span key={`${weakness.damage}:${weakness.source}`}>{index > 0 && ', '}{weakness.damage} {weakness.value}
            <SourceNote source={weakness.source} note="Weaknesses to the same damage type do not stack; apply only the highest." /></span>)}</small>}
        {form && 'pest' in form && form.pest && <small>Weakness: Physical 5
          <SourceNote source={form.source} note="Weaknesses to the same damage type do not stack; apply only the highest." /></small>}
        {testSubjectAdaptation(c) === 'Radioactive' && <small>Immunity: sickened from radiation sickness
          <SourceNote source="Test-Subject Ysoki" note="Grants immunity to sickened from radiation sickness." /></small>}
        {oaken && <small>Weakness: Fire {oaken.fireWeakness}
          <SourceNote source="Oaken Resilience" note={`Grants fire weakness ${oaken.fireWeakness}.`} /></small>}
      </>
    )
  }

  return (
    <>
      {backgroundLores.map(slot => {
        const options = backgroundLoreChoiceOptions(slot.background, deityLores, c.deity)
        const used = backgroundLores.filter(other => other.background.name === slot.background.name && other.index !== slot.index)
          .map(other => other.value.toLowerCase())
        const available = options.filter(option => !used.includes(option.toLowerCase()))
        return <SearchableSelect key={`${slot.background.id}:${slot.index}`} label={`${slot.background.name} Lore${backgroundLores.filter(other => other.background.name === slot.background.name).length > 1 ? ` ${slot.index + 1}` : ''}`}
          aria-label={`${slot.background.name} Lore ${slot.index + 1}`} value={slot.value} onChange={event => {
            const value = event.target.value
            if (value && !available.includes(value)) return
            const selected = [...(c.backgroundLores?.[slot.background.name] ?? [])]
            selected[slot.index] = value
            const backgroundTerrainLore = { ...c.backgroundTerrainLore }
            delete backgroundTerrainLore[slot.background.name]
            save({ backgroundLores: { ...c.backgroundLores, [slot.background.name]: selected }, backgroundTerrainLore })
          }}>
          <option value="">Choose Lore</option>
          {slot.value && !available.includes(slot.value) && <option value={slot.value} disabled>{slot.value}</option>}
          {available.map(option => <option key={option} value={option}>{option}</option>)}
        </SearchableSelect>
      })}
      {loreFeats.map(({ feat, index }) => {
        const value = feat.choice?.trim().replace(/\s+/g, ' ') ?? ''
        const selected = value && !/\s+lore$/i.test(value) ? `${value} Lore` : value.replace(/\s+lore$/i, ' Lore')
        const options = feat.name === 'Experienced Laborer' ? LABORER_LORES : commonLoreOptions(deityLores, c.deity)
        return <SearchableSelect key={feat.slot ?? index} label={`${feat.name} Lore`} aria-label={`${feat.name} Lore`}
          value={selected} onChange={event => {
            const choice = event.target.value
            if (choice && !options.includes(choice)) return
            save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice: choice || undefined } : existing) })
          }}>
          <option value="">Choose Lore</option>
          {selected && !options.includes(selected) && <option value={selected} disabled>{selected}</option>}
          {options.map(option => <option key={option} value={option}>{option}</option>)}
        </SearchableSelect>
      })}
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
      {!!activeFeatsNamed(c, 'Eclectic Obsession').length && <>
        <label title="Once per day for 10 minutes or until a critical failure with the chosen Lore.">
          <input type="checkbox" aria-label="Eclectic Obsession active" checked={isFeatEffectActive(c, 'Eclectic Obsession')}
            disabled={!isFeatEffectActive(c, 'Eclectic Obsession') && !!c.dailyFeatUses?.['Eclectic Obsession']}
            onChange={event => save({ ...featEffectChange(c, 'Eclectic Obsession', event.target.checked),
              ...(event.target.checked ? { dailyFeatUses: { ...c.dailyFeatUses, 'Eclectic Obsession': true } } : {}) })} /> Eclectic Obsession active
        </label>
        <label><input type="checkbox" aria-label="Eclectic Obsession used" checked={!!c.dailyFeatUses?.['Eclectic Obsession']}
          onChange={event => save({ dailyFeatUses: { ...c.dailyFeatUses, 'Eclectic Obsession': event.target.checked } })} /> Eclectic Obsession used</label>
      </>}
      <div className="skill-rank-budget" aria-label="Remaining skill selections">
        {(['trained', 'expert', 'master', 'legendary'] as const).map((rank, index) => (
          <span key={rank} title={`${RANKS[index + 1]} selections remaining`}>
            <b>{RANK_LETTERS[index]}</b>{budget[rank] + temporaryTrainings.filter(training => !training.skill && training.rank === index + 1).length
              + (rank === 'trained' ? backgroundTraining.filter(slot => !slot.value).length + backgroundLores.filter(slot => !slot.value).length
                + loreFeats.filter(({ feat }) => !feat.choice?.trim()).length + Number(!!erudite && !erudite.lore) : 0)}
          </span>
        ))}
      </div>
      {!!tokenState?.inactive.length && <div className="skill-token-exchange">
          {tokenState.inactive.map(({ purchase, index, reason }) => {
            return <div key={`${purchase.skill}:${purchase.rank}:${index}`}>
              <span role="status">{purchase.skill}: {reason}</span>
              {' '}<button type="button" aria-label={`Refund ${purchase.skill} ${RANKS[purchase.rank]} token upgrade`}
                onClick={() => refundTokens(purchase.skill, purchase.rank)}>Refund</button>
            </div>
          })}
      </div>}
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
          save({ lores: [...c.lores, { name, rank: 0 }],
            ...(erudite && !erudite.lore ? { subclassSkillChoices: { ...c.subclassSkillChoices, [ERUDITE_LORE_KEY]: name } } : {}) })
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
              {commonLoreOptions(deityLores, c.deity).filter(name => !lores.some(existing => existing.toLowerCase() === name.toLowerCase()))
                .map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>Lore specialty <input name="lore" aria-label="Lore specialty" required
            onInput={event => event.currentTarget.setCustomValidity('')} /></label>
          <button type="submit">Add Lore</button>
        </form>
      </details>
      {memoriesOfValor && <label><input type="checkbox" aria-label="Memories of Valor used"
        checked={memoriesHourly ? !!c.hourlyFeatUses?.['Memories of Valor'] : !!c.dailyFeatUses?.['Memories of Valor']}
        onChange={event => save(memoriesHourly
          ? { hourlyFeatUses: { ...c.hourlyFeatUses, 'Memories of Valor': event.target.checked } }
          : { dailyFeatUses: { ...c.dailyFeatUses, 'Memories of Valor': event.target.checked } })} />
        Memories of Valor used
      </label>}
      <div className="skill-grid" role="table" aria-label="Skills">
        {renderRows(skills)}
      </div>
      {!!activeFeatsNamed(c, 'Ancestral Skills').length && !ancestrySkills.length
        && <small role="status">Ancestral Skills training unavailable. Sync official content for your ancestry.</small>}
    </>
  )
}
