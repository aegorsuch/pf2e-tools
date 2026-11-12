import { resistances,
  ABILITY_LABEL, ARMOR_GROUPS, RANKS, WEAPON_GROUPS, abilityMod, activeFeatsNamed, animalSkinBenefits, armorClass, armorRanks, weaponRanks, backgroundSkills, autoClassSkills, canIncreaseTo, featEffectChange, featLores, isFeatEffectActive, senses, movementSpeeds, speedBonuses, ragingAthleteBenefits, armorSpecialization,
  maxHp,
  proficiencyBonus, ranksAt, wornArmor, perceptionItemBonus, perceptionCircumstance, hazardFinderBonus, signed, skillIncreaseLevels, skillRankBudget, statDefs, isSpellActive, type SectionProps,
} from './builder'
import { ArmorList, WeaponList } from './GearSection'
import { SourceNote } from './Info'

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
  if (!activeFeatsNamed(c, name).length) return null
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

export function SkillsSection({ c, entries, save, part = 'skills' }: SectionProps & { part?: 'skills' | 'offense' | 'defense' }) {
  const stats = statDefs(c)
  const klass = entries.find((e) => e.kind === 'class' && e.name === c.className)
  const bg = entries.find((e) => e.kind === 'background' && e.name === c.background)
  const ranks = ranksAt(c, entries)
  const lores = [...new Set([...c.lores.map((l) => l.name), ...featLores(c, entries), ...backgroundSkills(bg).filter((s) => /lore$/i.test(s))])]
  const picks = c.skillPicks ?? []
  const budget = skillRankBudget(c, entries)
  const remaining = budget.trained
  const fixed = new Set([...autoClassSkills(c, entries), ...backgroundSkills(bg)])
  const skills = [
    ...stats.filter((stat) => stat.kind === 'skill'),
    ...lores.map((name) => ({ name, ability: 'int' as const, kind: 'skill' as const })),
  ].sort((a, b) => a.name.localeCompare(b.name))
  const skillNames = new Set(skills.map((stat) => stat.name))
  const offense = stats.filter((stat) => stat.kind === 'perception')
  const defense = stats.filter((stat) => stat.kind === 'save').sort((a, b) => a.name.localeCompare(b.name))
  const maxRank = c.level >= 15 ? 4 : c.level >= 7 ? 3 : c.level >= 3 ? 2 : 1
  const baseRanks = ranksAt({ ...c, skillIncreases: {}, rankOverrides: undefined }, entries, 99, false)
  const canReachRank = (name: string, target: number) => {
    let rank = baseRanks[name] ?? 0
    if (rank < 1) return false
    const assigned = new Set(
      Object.entries(c.skillIncreases ?? {}).filter(([, skill]) => skill !== name).map(([level]) => Number(level)),
    )
    for (const level of skillIncreaseLevels(c)) {
      if (assigned.has(level)) continue
      if (canIncreaseTo(level, rank)) rank++
      if (rank >= target) return true
    }
    return rank >= target
  }
  const setRank = (name: string, r: number) => {
    if (!skillNames.has(name)) return
    const currentRank = ranks[name] ?? 0
    const base = baseRanks[name] ?? 0
    if (r === 1 && currentRank === 0) {
      if (remaining > 0) save({ skillPicks: [...picks, name] })
      return
    }
    if (r === 1 && currentRank === 1) {
      if (!fixed.has(name) && picks.includes(name)) save({ skillPicks: picks.filter((pick) => pick !== name) })
      return
    }
    const target = currentRank === r ? r - 1 : r
    if (target < base || target > maxRank || (target > currentRank && !canReachRank(name, target))) return

    const next = { ...c.skillIncreases }
    for (const [level, skill] of Object.entries(next)) {
      if (skill === name) delete next[level]
    }
    let rank = base
    if (target > rank) {
      for (const level of skillIncreaseLevels(c)) {
        if (next[level]) continue
        if (canIncreaseTo(level, rank)) {
          next[level] = name
          rank++
          if (rank === target) break
        }
      }
      if (rank < target) return
    }
    const overrides = { ...c.rankOverrides }
    delete overrides[name]
    save({ skillIncreases: next, rankOverrides: overrides })
  }
  const renderRows = (rows: typeof stats) => rows.map((s) => {
    const rank = ranks[s.name] ?? 0
    const baseRank = baseRanks[s.name] ?? 0
    const abil = abilityMod(c.abilities[s.ability])
    const prof = proficiencyBonus(rank, c.level)
    const item = s.name === 'Perception' ? perceptionItemBonus(c)
      : s.name === 'Fortitude' || s.name === 'Reflex' || s.name === 'Will' ? wornArmor(c)?.resilient ?? 0 : 0
    const status = s.name === 'Deception' && isSpellActive(c, entries, 'Imitate Fauna') ? 4 : 0
    const circumstance = s.kind === 'perception' ? perceptionCircumstance(c)
      : s.kind === 'save' && hazardFinderBonus(c) ? { value: 1, source: 'Hazard Finder' } : undefined
    return (
      <div key={s.name} className={`skill-row${rank > 0 ? ' trained' : ''} with-item`} role="row">
        <span className="skill-name">{s.name} <b>{signed(abil + prof + item + status + (circumstance?.value ?? 0))}{!!status
          && <SourceNote source="Imitate Fauna" note="+4 Status (Imitate Fauna; Impersonate an animal)" />}</b></span>
        <span className="rank-dots" role="group" aria-label={`${s.name} proficiency`}>
          {RANK_LETTERS.map((letter, i) => {
            const target = rank === i + 1 ? i : i + 1
            const trainedDisabled = i === 0 && (
              rank === 0 ? remaining <= 0
                : rank === 1 ? fixed.has(s.name) || !picks.includes(s.name)
                  : baseRank > 1
            )
            const disabled = s.kind !== 'skill' || i + 1 > maxRank || (i === 0
              ? trainedDisabled
              : target < baseRank || (target > rank && !canReachRank(s.name, target)))
            return (
              <button
                key={letter}
                type="button"
                className={rank >= i + 1 ? 'on' : ''}
                aria-pressed={rank === i + 1}
                aria-label={`${s.name} ${RANKS[i + 1]}`}
                disabled={disabled}
                title={s.kind !== 'skill' ? 'Set by class and features' : i === 0 && fixed.has(s.name) ? 'Trained granted by class or background' : RANKS[i + 1]}
                onClick={() => setRank(s.name, i + 1)}
              >{letter}</button>
            )
          })}
        </span>
        <span className="skill-part"><small>{ABILITY_LABEL[s.ability]}</small>{signed(abil)}</span>
        <span className="skill-part"><small>Proficiency</small>{signed(prof)}</span>
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
    return (
      <>
        <div className="skill-grid" role="table" aria-label="Offense">
          {renderRows(offense)}
        </div>
        {senses(c, entries).length > 0 && <small>Senses: {senses(c, entries).map((s) => `${s.value} (${s.source})`).join(', ')}</small>}
        {rageToggle}
        {hazardToggle}
        <small>Speed: {movementSpeeds(c, entries).map((movement, index) => {
          const bonuses = movement.name === 'Land' ? speedBonuses(c) : []
          return <span key={movement.name}>
            {index > 0 && '; '}{movement.name !== 'Land' && `${movement.name === 'Climb' ? 'Climbing' : movement.name} `}{movement.feet} ft.
            {movement.source && ` (${movement.source})`}
            {bonuses.length > 0 && ` (${bonuses.map((bonus) => `+${bonus.feet} ${bonus.source}`).join(', ')})`}
          </span>
        })}</small>
        {athlete && <small>Raging Athlete: High/Long Jump DCs {athlete.jumpDCAdjustment}; successful Long Jump +{athlete.longJumpExtra} ft.; Leap {athlete.verticalLeap} ft. vertical{athlete.horizontalLeap && ` / ${athlete.horizontalLeap} ft. horizontal`}.</small>}
        <ProficiencyBadges groups={WEAPON_GROUPS} ranks={weaponRanks(c, entries)} />
        <WeaponList c={c} entries={entries} save={save} />
      </>
    )
  }
  if (part === 'defense') {
    const res = resistances(c, entries)
    const spec = armorSpecialization(c, entries)
    const skin = animalSkinBenefits(c, entries)
    return (
      <>
        <div className="defense-summary">
          <span><small>Armor Class</small><b>{armorClass(c, entries)}</b></span>
          <span><small>Hit Points</small><b>{maxHp(c, entries)}</b></span>
        </div>
        {rageToggle}
        {skin && <small>Animal Skin: +{skin.itemBonus} item AC; Dexterity cap +{skin.dexCap}.</small>}
        {hazardToggle}
        <FeatEffectToggle c={c} save={save} name="Harden Flesh" label="Harden Flesh active"
          title="Until the beginning of your next turn. Clear this when the effect ends." />
        <FeatEffectToggle c={c} save={save} name="Heart of the Kaiju" label="Kaiju form resistance active"
          title="Physical resistance 5 only while in kaiju form. This control does not apply the form's other statistics." />
        <div className="skill-grid" role="table" aria-label="Defense">
          {renderRows(defense)}
        </div>
        {spec ? <small>Armor Specialization: {spec.group} ({spec.armor}{spec.feat ? ` via ${spec.feat} feat` : ''})</small> : <small>Armor Specialization: None</small>}
        <small>Resistances: {res.length ? res.map((r, index) => {
          const note = activeFeatsNamed(c, r.source).length ? RESISTANCE_NOTES[r.source] : undefined
          return <span key={`${r.damage}:${r.source}`}>{index > 0 && ', '}{r.damage} {r.value}{note
            ? <SourceNote source={r.source} note={note} /> : ` (${r.source})`}</span>
        }) : 'None'}</small>
        <ProficiencyBadges groups={ARMOR_GROUPS} ranks={armorRanks(c, entries)} />
        <ArmorList c={c} entries={entries} save={save} />
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
      <div className="skill-grid" role="table" aria-label="Skills">
        {renderRows(skills)}
      </div>
    </>
  )
}
