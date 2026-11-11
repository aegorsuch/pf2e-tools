import {
  ABILITY_LABEL, RANKS, abilityMod, armorClass, backgroundSkills, canIncreaseTo, classSkills,
  maxHp,
  proficiencyBonus, ranksAt, signed, skillIncreaseLevels, skillRankBudget, statDefs, type SectionProps,
} from './builder'

const RANK_LETTERS = ['T', 'E', 'M', 'L']

export function SkillsSection({ c, entries, save, part = 'skills' }: SectionProps & { part?: 'skills' | 'offense' | 'defense' }) {
  const stats = statDefs(c)
  const klass = entries.find((e) => e.kind === 'class' && e.name === c.className)
  const bg = entries.find((e) => e.kind === 'background' && e.name === c.background)
  const ranks = ranksAt(c, entries)
  const lores = [...new Set([...c.lores.map((l) => l.name), ...backgroundSkills(bg).filter((s) => /lore$/i.test(s))])]
  const picks = c.skillPicks ?? []
  const budget = skillRankBudget(c, entries)
  const remaining = budget.trained
  const fixed = new Set([...classSkills(klass).fixed, ...backgroundSkills(bg)])
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
    return (
      <div key={s.name} className={`skill-row${rank > 0 ? ' trained' : ''}`} role="row">
        <span className="skill-name">{s.name} <b>{signed(abil + prof)}</b></span>
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
        <span className="skill-part"><small>Prof</small>{signed(prof)}</span>
      </div>
    )
  })

  if (part === 'offense') {
    return (
      <div className="skill-grid" role="table" aria-label="Offense">
        {renderRows(offense)}
      </div>
    )
  }
  if (part === 'defense') {
    return (
      <>
        <div className="defense-summary">
          <span><small>AC</small><b>{armorClass(c, entries)}</b></span>
          <span><small>HP</small><b>{maxHp(c, entries)}</b></span>
        </div>
        <div className="skill-grid" role="table" aria-label="Defense">
          {renderRows(defense)}
        </div>
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
