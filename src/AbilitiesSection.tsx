import { ABILITIES, ABILITY_LABEL, abilityMod, ancestryFlaws, boostSlots, computeAbilities, duplicateBoosts, signed, type SectionProps } from './builder'
import type { Character } from './types'

export function AbilitiesSection({ c, entries, save }: SectionProps) {
  const slots = boostSlots(c, entries)
  const dupes = duplicateBoosts(c, entries)
  const flaws = ancestryFlaws(c, entries)
  const builderOn = !!c.boosts

  const setBoost = (key: string, a: Character['abilities'] extends infer T ? keyof T | '' : never) => {
    const boosts = { ...c.boosts }
    if (a) boosts[key] = a
    else delete boosts[key]
    save({ boosts })
  }

  return (
    <>
      <h3>Ability scores</h3>
      <div className="row">
        {ABILITIES.map((a) => (
          <label key={a}>
            {a.toUpperCase()}{' '}
            <input type="number" min={1} max={30} value={c.abilities[a]} disabled={builderOn}
              onChange={(e) => save({ abilities: { ...c.abilities, [a]: +e.target.value || 10 } })} />
            {' '}{signed(abilityMod(c.abilities[a]))}
          </label>
        ))}
        <label>
          <input type="checkbox" checked={builderOn}
            onChange={(e) => save(e.target.checked ? { boosts: {} } : { boosts: undefined })} />
          {' '}Build from boosts
        </label>
      </div>
      {builderOn && (
        <div className="col">
          {flaws.length > 0 && <small>Ancestry flaw: {flaws.map((f) => f.toUpperCase()).join(', ')}</small>}
          <div className="row">
            {slots.map((s) => (
              <label key={s.key} style={dupes.has(s.key) ? { outline: '2px solid red' } : undefined}>
                {s.label}{' '}
                {s.fixed ? <b>{s.fixed.toUpperCase()}</b> : (
                  <select value={c.boosts?.[s.key] ?? ''} onChange={(e) => setBoost(s.key, e.target.value as never)}>
                    <option value="">-</option>
                    {(s.options ?? ABILITIES).map((a) => <option key={a} value={a}>{ABILITY_LABEL[a]}</option>)}
                  </select>
                )}
              </label>
            ))}
          </div>
          {dupes.size > 0 && <small>Red: the same ability is boosted twice in one group.</small>}
          <small>Result: {ABILITIES.map((a) => `${a.toUpperCase()} ${computeAbilities(c, entries)[a]}`).join(', ')}</small>
        </div>
      )}
    </>
  )
}
