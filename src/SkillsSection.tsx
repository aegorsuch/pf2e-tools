import { resistances,
  ABILITY_LABEL, ARMOR_GROUPS, RANKS, WEAPON_GROUPS, abilityMod, activeFeatsNamed, animalSkinBenefits, armorRanks, weaponRanks, backgroundSkills, freeHeartBackground, autoClassSkills, canIncreaseTo, featEffectChange, featLores, isFeatEffectActive, senses, movementSpeeds, speedBonuses, ragingAthleteBenefits, armorSpecialization,
  ancestralSkills, FAVORED_TERRAINS, favoredTerrainBenefits, favoredTerrainChange, selectedFavoredTerrain, featTakenLevel, hitPointBonuses, isPioneerHuman, maxHp, terrainExpertiseBenefits,
  proficiencyBonus, untrainedSkillProficiency, ranksAt, normalizeLongevitySkills, longevityExpertLevel, LONGEVITY_EXPERT_SLOT, armorSaveBonus, armorClassBreakdown, savingThrowBreakdown, perceptionItemBonus, perceptionCircumstance, researchedSpellResistance, savingThrowCircumstance, signed, skillIncreaseLevels, skillRankBudget, statDefs, isSpellActive, oakenResilience, type SectionProps,
} from './builder'
import { WeaponList } from './GearSection'
import { SourceNote } from './Info'
import { TotalBreakdown } from './TotalBreakdown'
import { warmaskSource } from './warmask'
import { armorModifications, armorOverdriveActive } from './inventorArmor'
import { INVENTOR_ARMOR_ID } from './grantedArmor'
import { wornArmor } from './builder'
import { confirmRemoval } from './confirmRemoval'

const RANK_LETTERS = ['T', 'E', 'M', 'L']
const RESISTANCE_NOTES: Record<string, string> = {
  'Poison Resistance': '+1 status bonus to saving throws against poisons.',
  'Harden Flesh': 'Physical resistance except against adamantine. Lasts until the beginning of your next turn; clear the active toggle when it ends.',
  'Heart of the Kaiju': "Physical resistance applies only while in kaiju form. This toggle does not apply the form's other statistics.",
  'Primal Aegis': 'Resistance equals your positive Wisdom modifier.',
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

export function SkillsSection({ c: original, entries, save: saveOriginal, part = 'skills' }: SectionProps & { part?: 'skills' | 'offense' | 'defense' }) {
  const editingSkills = part === 'skills'
  const c = editingSkills ? normalizeLongevitySkills(original) : original
  const save: SectionProps['save'] = patch => saveOriginal(c === original ? patch : {
    feats: c.feats, skillPicks: c.skillPicks, skillIncreases: c.skillIncreases, ...patch,
  })
  const stats = statDefs(c)
  const klass = editingSkills ? entries.find((e) => e.kind === 'class' && e.name === c.className) : undefined
  const bg = editingSkills ? entries.find((e) => e.kind === 'background' && e.name === c.background) : undefined
  const extraBackgroundSkills = editingSkills ? backgroundSkills(freeHeartBackground(c, entries)) : []
  const ranks = ranksAt(c, entries)
  const lores = editingSkills ? [...new Set([...c.lores.map((l) => l.name), ...featLores(c, entries), ...backgroundSkills(bg).filter((s) => /lore$/i.test(s)), ...extraBackgroundSkills.filter(s => /lore$/i.test(s))])] : []
  const picks = c.skillPicks ?? []
  const budget = editingSkills ? skillRankBudget(c, entries) : { trained: 0, expert: 0, master: 0, legendary: 0 }
  const remaining = budget.trained
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
  const offense = stats.filter((stat) => stat.kind === 'perception')
  const defense = stats.filter((stat) => stat.kind === 'save').sort((a, b) => a.name.localeCompare(b.name))
  const maxRank = c.level >= 15 ? 4 : c.level >= 7 ? 3 : c.level >= 3 ? 2 : 1
  const noPaidIncreases = { ...c, skillIncreases: {}, rankOverrides: undefined }
  const baseRanks = editingSkills ? ranksAt(noPaidIncreases, entries, 99, false) : ranks
  const rankGrants = (editingSkills ? ['Technomagical Scrapper', 'Greenwatch Initiate', 'Ancestral Skills'] : []).flatMap(name => {
    const feat = activeFeatsNamed(c, name).sort((a, b) => featTakenLevel(a) - featTakenLevel(b))[0]
    return feat ? [{ level: featTakenLevel(feat), without: ranksAt({
      ...noPaidIncreases, feats: c.feats.filter(feat => feat.name !== name),
    }, entries, 99, false) }] : []
  })
  const canSpendAt = (name: string, level: number) => rankGrants.every(grant =>
    (baseRanks[name] ?? 0) <= (grant.without[name] ?? 0) || level > grant.level)
  const improvisation = untrainedSkillProficiency(c)
  const armorBonus = part === 'defense' ? armorSaveBonus(c, entries) : 0
  const saveCircumstance = part === 'defense' ? savingThrowCircumstance(c, entries) : undefined
  const assignRank = (name: string, target: number) => {
    let rank = baseRanks[name] ?? 0
    const next = Object.fromEntries(Object.entries(c.skillIncreases ?? {}).filter(([, skill]) => skill !== name))
    if (target <= rank) return next
    if (rank < 1) return undefined
    const expertLevel = longevityExpertLevel(c)
    if (target === 2 && rank === 1 && expertLevel !== undefined && !next[LONGEVITY_EXPERT_SLOT]
      && canSpendAt(name, expertLevel)) {
      next[LONGEVITY_EXPERT_SLOT] = name
      return next
    }
    const slots = skillIncreaseLevels(c).map(level => ({ key: String(level), level, expertOnly: false }))
    if (expertLevel !== undefined) slots.push({ key: LONGEVITY_EXPERT_SLOT, level: expertLevel, expertOnly: true })
    slots.sort((a, b) => a.level - b.level || Number(b.expertOnly) - Number(a.expertOnly))
    for (const slot of slots) {
      if (next[slot.key] || !canSpendAt(name, slot.level)
        || (slot.expertOnly ? rank !== 1 : !canIncreaseTo(slot.level, rank))) continue
      next[slot.key] = name
      if (++rank >= target) return next
    }
    return undefined
  }
  const canReachRank = (name: string, target: number) => !!assignRank(name, target)
  const setRank = (name: string, r: number) => {
    if (!skillNames.has(name)) return
    const currentRank = ranks[name] ?? 0
    const base = baseRanks[name] ?? 0
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

    const next = assignRank(name, target)
    if (!next) return
    const overrides = { ...c.rankOverrides }
    delete overrides[name]
    save({ skillIncreases: next, rankOverrides: overrides })
  }
  const renderRows = (rows: typeof stats) => rows.map((s) => {
    const rank = ranks[s.name] ?? 0
    const permanentRank = ranks[s.name] ?? 0
    const baseRank = baseRanks[s.name] ?? 0
    const abil = abilityMod(c.abilities[s.ability])
    const improvised = s.kind === 'skill' && rank === 0 ? improvisation : undefined
    const prof = improvised?.bonus ?? proficiencyBonus(rank, c.level)
    const warmaskBonus = c.warmask?.worn && c.warmask.attuned && warmaskSource(c)?.skill === s.name ? 1 : 0
    const item = s.name === 'Perception' ? perceptionItemBonus(c)
      : s.kind === 'save' ? armorBonus : warmaskBonus
    const status = s.name === 'Deception' && isSpellActive(c, entries, 'Imitate Fauna') ? 4 : 0
    const modification = s.name === 'Athletics' ? 'Muscular Exoskeleton' : s.name === 'Stealth' ? 'Subtle Dampeners' : ''
    const armorSkill = modification && armorOverdriveActive(c) && wornArmor(c, entries)?.id === INVENTOR_ARMOR_ID
      && armorModifications(c).some(mod => mod.name === modification)
      ? { source: modification, value: (ranks.Crafting ?? 0) >= 3 ? 2 : 1 } : undefined
    const circumstance = s.kind === 'perception' ? perceptionCircumstance(c)
      : s.kind === 'save' ? saveCircumstance : armorSkill
    return (
      <div key={s.name} className={`skill-row${rank > 0 ? ' trained' : ''} with-item`} role="row">
        <span className="skill-name">{s.name} {editingSkills && c.lores.some(lore => lore.name === s.name)
          && <button type="button" className="lore-remove" aria-label={`Remove ${s.name}`} onClick={() => confirmRemoval(`"${s.name}"`, () => {
            const stillGranted = [...featLores(c, entries), ...backgroundSkills(bg), ...extraBackgroundSkills].includes(s.name)
            const skillIncreases = Object.fromEntries(Object.entries(c.skillIncreases ?? {}).filter(([, skill]) => skill !== s.name))
            const rankOverrides = { ...c.rankOverrides }
            delete rankOverrides[s.name]
            save({ lores: c.lores.filter(lore => lore.name !== s.name),
              ...(!stillGranted ? { skillPicks: picks.filter(pick => pick !== s.name), skillIncreases, rankOverrides } : {}) })
          })}>×</button>}<b>{s.kind === 'save' && (s.name === 'Fortitude' || s.name === 'Reflex' || s.name === 'Will')
          ? <TotalBreakdown label={s.name} breakdown={savingThrowBreakdown(c, entries, s.name, ranks)} signedTotal />
          : signed(abil + prof + item + status + (circumstance?.value ?? 0))}{!!status
          && <SourceNote inlineSource={false} source="Imitate Fauna" note="+4 status bonus when using Impersonate as an animal." />}
          {!!warmaskBonus && <SourceNote inlineSource={false} source="Orc Warmask" note="+1 item bonus while worn and attuned." />}
          {armorSkill && <SourceNote inlineSource={false} source={armorSkill.source} note={`+${armorSkill.value} circumstance bonus during Overdrive.`} />}
          {['Deception', 'Diplomacy', 'Intimidation', 'Performance'].includes(s.name) && !!activeFeatsNamed(c, 'Shiny').length
            && <SourceNote inlineSource={false} source="Shiny" note="+3 circumstance bonus only when using Aid for this skill." />}
          {s.name === 'Survival' && wasteland && <SourceNote inlineSource={false} source="Wasteland Warrior" note={hazardNote} />}
          {s.name === 'Survival' && terrainExpertise && <SourceNote inlineSource={false} source="Terrain Expertise"
            note={`+1 circumstance bonus to Survival in ${terrainExpertise.terrains.join(', ')} terrain.`} />}
          </b></span>
        <span className="rank-dots" role="group" aria-label={`${s.name} proficiency`}>
          {RANK_LETTERS.map((letter, i) => {
            const target = permanentRank === i + 1 ? i : i + 1
            const trainedDisabled = i === 0 && (
              permanentRank === 0 ? remaining <= 0
                : permanentRank === 1 ? !picks.includes(s.name)
                  : baseRank > 1
            )
            const disabled = s.kind !== 'skill' || i + 1 > maxRank || (i === 0
              ? trainedDisabled
              : target < baseRank || (target > permanentRank && !canReachRank(s.name, target)))
            return (
              <button
                key={letter}
                type="button"
                className={permanentRank >= i + 1 ? 'on' : ''}
                aria-pressed={permanentRank === i + 1}
                aria-label={`${s.name} ${RANKS[i + 1]}`}
                disabled={disabled}
                title={s.kind !== 'skill' ? 'Set by class and features' : i === 0 && grantedTraining.includes(s.name)
                  ? picks.includes(s.name) ? `Refund redundant training choice; ${heritageSkills.includes(s.name) ? 'Pioneer Human' : 'Ancestral Skills'} keeps this skill trained`
                    : `Trained granted by ${heritageSkills.includes(s.name) ? 'Pioneer Human' : 'Ancestral Skills'}`
                  : i === 0 && fixed.has(s.name) ? picks.includes(s.name) ? 'Refund redundant training choice' : 'Trained granted by class or background' : RANKS[i + 1]}
                onClick={() => setRank(s.name, i + 1)}
              >{letter}</button>
            )
          })}
        </span>
        <span className="skill-part"><small>{ABILITY_LABEL[s.ability]}</small>{signed(abil)}</span>
        <span className="skill-part"><small>Proficiency</small>{signed(prof)}
          {improvised && <SourceNote inlineSource={false} source={improvised.source} note={improvised.trainedActions
            ? 'Untrained skill proficiency improved. You can also attempt trained-only skill actions; your proficiency rank remains untrained.'
            : 'Untrained skill proficiency improved. Trained-only skill actions still require training.'} />}
        </span>
        <span className="skill-part"><small>Item</small>{signed(item)}</span>
        {circumstance && <span className="skill-part skill-circumstance"><small>Circumstance</small>{signed(circumstance.value)} <small>({circumstance.source})</small></span>}
      </div>
    )
  })

  const rageToggle = (c.className === 'Barbarian' || !!activeFeatsNamed(c, 'Barbarian Dedication').length)
    && <label><input type="checkbox" aria-label={part === 'defense' ? 'Rage active (defense)' : 'Rage active'} checked={!!c.raging}
      onChange={(event) => save({ raging: event.target.checked })} /> Rage active</label>
  const hazardToggle = <FeatEffectToggle c={c} save={save} name="Hazard Finder" label="Hazard checks active"
    ariaLabel={`Hazard checks active (${part})`}
    title="Only for Perception checks to find traps and hazards, AC against their attacks, and saves against their effects. Does not affect initiative." />

  if (part === 'offense') {
    const athlete = ragingAthleteBenefits(c, entries)
    const terrain = favoredTerrainBenefits(c, entries)
    return (
      <>
        <div className="skill-grid" role="table" aria-label="Offense">
          {renderRows(offense)}
        </div>
        {senses(c, entries).length > 0 && <small>Senses: {senses(c, entries).map((s) => `${s.value} (${s.source})`).join(', ')}</small>}
        {rageToggle}
        {hazardToggle}
        <FeatEffectToggle c={c} save={save} name="Favored Terrain" label="In favored terrain"
          title="Apply favored terrain benefits only while you are in that terrain." />
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
            {movement.source && ` (${movement.source})`}
            {bonuses.length > 0 && ` (${bonuses.map((bonus) => `+${bonus.feet} ${bonus.source}`).join(', ')})`}
          </span>
        })}</small>
        {athlete && <small>Raging Athlete: High/Long Jump DCs {athlete.jumpDCAdjustment}; successful Long Jump +{athlete.longJumpExtra} ft.; Leap {athlete.verticalLeap} ft. vertical{athlete.horizontalLeap && ` / ${athlete.horizontalLeap} ft. horizontal`}.</small>}
        <ProficiencyBadges groups={WEAPON_GROUPS} ranks={weaponRanks(c, entries)} />
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
    return (
      <>
        <div className="defense-summary">
          <span><small>Armor Class</small><b><TotalBreakdown label="Armor Class" breakdown={armorClassBreakdown(c, entries)} /></b></span>
          <span><small>Hit Points</small><b>{maxHp(c, entries)}{hpBonuses.length > 0
            && <small> ({hpBonuses.map(bonus => `${signed(bonus.value)} ${bonus.source}`).join(', ')})</small>}</b></span>
        </div>
        {rageToggle}
        {skin && <small>Animal Skin: +{skin.itemBonus} item AC; Dexterity cap +{skin.dexCap}.</small>}
        {hazardToggle}
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
          note={spec.effect} /></small> : <small>Armor Specialization: None</small>}
        <small>Resistances: {res.length ? res.map((r, index) => {
          const note = spec && r.source === `${spec.group} Armor Specialization` ? spec.effect
            : activeFeatsNamed(c, r.source).length ? RESISTANCE_NOTES[r.source] : undefined
          return <span key={`${r.damage}:${r.source}`}>{index > 0 && ', '}{r.damage} {r.value}{note
            ? <SourceNote source={r.source} note={note} /> : ` (${r.source})`}</span>
        }) : 'None'}</small>
        {oaken && <small>Weakness: Fire {oaken.fireWeakness} (Oaken Resilience)</small>}
        <ProficiencyBadges groups={ARMOR_GROUPS} ranks={armorRanks(c, entries)} />
      </>
    )
  }

  return (
    <>
      {!klass && <small>Pick a class to fill in class proficiencies.</small>}
      <div className="skill-rank-budget" aria-label="Remaining skill selections">
        {(['trained', 'expert', 'master', 'legendary'] as const).map((rank, index) => (
          <span key={rank} title={`${RANKS[index + 1]} selections remaining`}>
            <b>{RANK_LETTERS[index]}</b>{budget[rank]}
          </span>
        ))}
      </div>
      <details className="lore-add">
        <summary aria-label="Add Lore skill" title="Add Lore skill">+</summary>
        <form onSubmit={event => {
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
          <label>Lore specialty <input name="lore" aria-label="Lore specialty" required
            onInput={event => event.currentTarget.setCustomValidity('')} /></label>
          <button type="submit">Add Lore</button>
        </form>
      </details>
      {wasteland && <small>Wasteland Warrior: {hazardNote}</small>}
      <div className="skill-grid" role="table" aria-label="Skills">
        {renderRows(skills)}
      </div>
      {!!activeFeatsNamed(c, 'Ancestral Skills').length && !ancestrySkills.length
        && <small role="status">Ancestral Skills training unavailable. Sync official content for your ancestry.</small>}
    </>
  )
}
