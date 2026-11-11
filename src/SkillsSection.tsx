import {
  ABILITY_LABEL, RANKS, abilityMod, additionalSkillCount, backgroundSkills, canIncreaseTo, classSkills,
  proficiencyBonus, ranksAt, signed, skillIncreaseLevels, statDefs, type SectionProps,
} from './builder'

export function SkillsSection({ c, entries, save }: SectionProps) {
  const stats = statDefs(c)
  const skillNames = stats.filter((s) => s.kind === 'skill').map((s) => s.name)
  const klass = entries.find((e) => e.kind === 'class' && e.name === c.className)
  const bg = entries.find((e) => e.kind === 'background' && e.name === c.background)
  const ranks = ranksAt(c, entries)
  const picks = c.skillPicks ?? []
  const pickCount = additionalSkillCount(c, entries)
  const fixed = new Set([...classSkills(klass).fixed, ...backgroundSkills(bg)])
  const lores = [...new Set([...c.lores.map((l) => l.name), ...backgroundSkills(bg).filter((s) => /lore$/i.test(s))])]

  const setPick = (i: number, name: string) => {
    const next = [...picks]
    next[i] = name
    save({ skillPicks: next.filter(Boolean) })
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
      {pickCount > 0 && (
        <div className="row">
          <small>Trained skills from class ({pickCount}):</small>
          {Array.from({ length: pickCount }, (_, i) => (
            <select key={i} value={picks[i] ?? ''} onChange={(e) => setPick(i, e.target.value)}>
              <option value="">-</option>
              {skillNames.filter((n) => !fixed.has(n) && (n === picks[i] || !picks.includes(n))).map((n) => <option key={n}>{n}</option>)}
            </select>
          ))}
        </div>
      )}
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
      <table>
        <thead><tr><th>Stat</th><th>Rank</th><th>Mod</th><th>Override</th></tr></thead>
        <tbody>
          {[...stats, ...lores.map((name) => ({ name, ability: 'int' as const, kind: 'skill' as const }))].map((s) => {
            const rank = ranks[s.name] ?? 0
            const mod = abilityMod(c.abilities[s.ability]) + proficiencyBonus(rank, c.level)
            return (
              <tr key={s.name}>
                <td>{s.name} <small>({ABILITY_LABEL[s.ability]})</small></td>
                <td>{RANKS[rank]}</td>
                <td>{signed(mod)}</td>
                <td>
                  <select value={c.rankOverrides?.[s.name] ?? ''} onChange={(e) => {
                    const o = { ...c.rankOverrides }
                    if (e.target.value === '') delete o[s.name]
                    else o[s.name] = +e.target.value
                    save({ rankOverrides: o })
                  }}>
                    <option value="">auto</option>
                    {RANKS.map((r, i) => <option key={r} value={i}>{r}</option>)}
                  </select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
