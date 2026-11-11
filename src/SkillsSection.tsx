import {
  ABILITY_LABEL, RANKS, abilityMod, additionalSkillCount, backgroundSkills, canIncreaseTo, classSkills,
  proficiencyBonus, ranksAt, signed, skillIncreaseLevels, statDefs, type SectionProps,
} from './builder'

const RANK_LETTERS = ['T', 'E', 'M', 'L']

export function ClassSkills({ c, entries, save }: SectionProps) {
  const skillNames = statDefs(c).filter((s) => s.kind === 'skill').map((s) => s.name)
  const klass = entries.find((e) => e.kind === 'class' && e.name === c.className)
  const bg = entries.find((e) => e.kind === 'background' && e.name === c.background)
  const picks = c.skillPicks ?? []
  const pickCount = additionalSkillCount(c, entries)
  const classFixed = classSkills(klass).fixed
  const fixed = new Set([...classFixed, ...backgroundSkills(bg)])
  const setPick = (i: number, name: string) => {
    const next = [...picks]
    next[i] = name
    save({ skillPicks: next.filter(Boolean) })
  }
  return (
    <details className="character-subsection">
      <summary><h4>Class Skills</h4></summary>
      {!klass && <small>Pick a class to choose class skills.</small>}
      {classFixed.length > 0 && <small>Trained: {classFixed.join(', ')}</small>}
      {pickCount > 0 && <div className="row">
        <small>Trained skills from class ({pickCount}):</small>
        {Array.from({ length: pickCount }, (_, i) => (
          <select key={i} aria-label={`Class skill ${i + 1}`} value={picks[i] ?? ''} onChange={(e) => setPick(i, e.target.value)}>
            <option value="">-</option>
            {skillNames.filter((n) => !fixed.has(n) && (n === picks[i] || !picks.includes(n))).map((n) => <option key={n}>{n}</option>)}
          </select>
        ))}
      </div>}
    </details>
  )
}

export function SkillsSection({ c, entries, save }: SectionProps) {
  const stats = statDefs(c)
  const skillNames = stats.filter((s) => s.kind === 'skill').map((s) => s.name)
  const klass = entries.find((e) => e.kind === 'class' && e.name === c.className)
  const bg = entries.find((e) => e.kind === 'background' && e.name === c.background)
  const ranks = ranksAt(c, entries)
  const lores = [...new Set([...c.lores.map((l) => l.name), ...backgroundSkills(bg).filter((s) => /lore$/i.test(s))])]
  const picks = c.skillPicks ?? []
  const remaining = additionalSkillCount(c, entries) - picks.length
  const fixed = new Set([...classSkills(klass).fixed, ...backgroundSkills(bg)])
  const auto = ranksAt(c, entries, 99, false)
  // Trained circle syncs with the class skill picker; other circles are manual overrides
  const setRank = (name: string, r: number) => {
    if (r === 1 && fixed.has(name)) return
    if (r === 1 && picks.includes(name)) return save({ skillPicks: picks.filter((p) => p !== name) })
    if (r === 1 && !fixed.has(name) && (auto[name] ?? 0) === 0 && remaining > 0 && c.rankOverrides?.[name] === undefined) {
      return save({ skillPicks: [...picks, name] })
    }
    const o = { ...c.rankOverrides }
    // Clicking the current rank steps down one; reverting to the computed rank drops the override
    o[name] = (ranks[name] ?? 0) === r ? r - 1 : r
    if (o[name] === (auto[name] ?? 0)) delete o[name]
    save({ rankOverrides: o })
  }
  const setIncrease = (level: number, name: string) => {
    const next = { ...c.skillIncreases }
    if (name) next[level] = name
    else delete next[level]
    save({ skillIncreases: next })
  }

  return (
    <>
      <h3>Skills & proficiencies</h3>
      {!klass && <small>Pick a class to fill in class proficiencies.</small>}
      <ClassSkills c={c} entries={entries} save={save} />
      {skillIncreaseLevels(c).length > 0 && (
        <div className="row">
          {skillIncreaseLevels(c).map((l) => {
            const before = ranksAt(c, entries, l, false)
            const cur = c.skillIncreases?.[l] ?? ''
            return (
              <label key={l}>
                L{l} increase{' '}
                <select value={cur} onChange={(e) => setIncrease(l, e.target.value)}>
                  <option value="">-</option>
                  {[...skillNames, ...lores].filter((n) => n === cur || canIncreaseTo(l, before[n] ?? 0)).map((n) => <option key={n}>{n}</option>)}
                </select>
              </label>
            )
          })}
        </div>
      )}
      <div className="skill-grid" role="table" aria-label="Skill proficiencies">
        <div className="skill-grid-head" role="row">
          <strong>{remaining} skill{remaining === 1 ? '' : 's'} remaining</strong>
        </div>
        {[...stats, ...lores.map((name) => ({ name, ability: 'int' as const, kind: 'skill' as const }))].map((s) => {
          const rank = ranks[s.name] ?? 0
          const abil = abilityMod(c.abilities[s.ability])
          const prof = proficiencyBonus(rank, c.level)
          return (
            <div key={s.name} className={`skill-row${rank > 0 ? ' trained' : ''}`} role="row">
              <span className="skill-name">{s.name} <b>{signed(abil + prof)}</b></span>
              <span className="rank-dots" role="group" aria-label={`${s.name} proficiency`}>
                {RANK_LETTERS.map((letter, i) => (
                  <button
                    key={letter}
                    type="button"
                    className={rank >= i + 1 ? 'on' : ''}
                    aria-pressed={rank === i + 1}
                    aria-label={`${s.name} ${RANKS[i + 1]}`}
                    disabled={i === 0 && fixed.has(s.name)}
                    title={i === 0 && fixed.has(s.name) ? 'Trained granted by class or background' : RANKS[i + 1]}
                    onClick={() => setRank(s.name, i + 1)}
                  >{letter}</button>
                ))}
              </span>
              <span className="skill-part"><small>{ABILITY_LABEL[s.ability]}</small>{signed(abil)}</span>
              <span className="skill-part"><small>Prof</small>{signed(prof)}</span>
            </div>
          )
        })}
      </div>
    </>
  )
}
