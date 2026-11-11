import { ABILITIES, ABILITY_LABEL, abilityMod, boostSlots, computeAbilities, duplicateBoosts, signed, type Ability, type BoostSlot, type SectionProps } from './builder'

const GROUP_TITLE: Record<string, string> = { ancestry: 'Ancestry Boosts', background: 'Background Boosts', class: 'Class Boost', free1: 'L01 Boosts' }
const groupTitle = (g: string) => GROUP_TITLE[g] ?? `L${g.slice(3).padStart(2, '0')} Boosts`

function addBoost(group: BoostSlot[], boosts: Record<string, Ability>, ability: Ability) {
  const next = { ...boosts }
  // Reassign an existing choice when it must move between a restricted and a free slot.
  const place = (a: Ability, visited: Set<string>): boolean => {
    for (const slot of group) {
      if (slot.fixed || visited.has(slot.key) || (slot.options && !slot.options.includes(a))) continue
      const held = next[slot.key]
      if (!held || place(held, new Set([...visited, slot.key]))) {
        next[slot.key] = a
        return true
      }
    }
    return false
  }
  return place(ability, new Set()) ? next : undefined
}

export function AbilityBoostChoices({ c, entries, save, groups: visibleGroups }: SectionProps & { groups: string[] }) {
  const slots = boostSlots(c, entries)
  const dupes = duplicateBoosts(c, entries)
  const boosts = c.boosts
  if (!boosts) return null
  const scores = computeAbilities(c, entries)
  const groupedSlots = slots.reduce((m, s) => m.set(s.group, [...(m.get(s.group) ?? []), s]), new Map<string, BoostSlot[]>())
  const groups = [...groupedSlots].filter(([group]) => visibleGroups.includes(group))

  return (
    <div className="boost-panels">
      {groups.map(([group, gs]) => (
        <details key={group} className="boost-panel character-subsection">
          <summary><h4>{groupTitle(group)}</h4></summary>
          {gs.some((s) => s.fixed) && <small>Fixed: {gs.flatMap((s) => s.fixed ? [ABILITY_LABEL[s.fixed]] : []).join(', ')}</small>}
          <div className="boost-checks">
            {ABILITIES.map((a) => {
              const fixed = gs.some((s) => s.fixed === a)
              const checked = fixed || gs.some((s) => !s.fixed && c.boosts?.[s.key] === a)
              const next = checked ? undefined : addBoost(gs, boosts, a)
              const disabled = fixed || (!checked && !next)
              const forbidden = !checked && !gs.some((s) => !s.fixed && (!s.options || s.options.includes(a)))
              return (
                <label key={a} className={disabled ? 'disabled' : undefined}>
                  <input type="checkbox" aria-label={`${groupTitle(group)}: ${ABILITY_LABEL[a]}${fixed ? ' (fixed)' : ''}`}
                    className={forbidden ? 'boost-forbidden' : undefined}
                    checked={checked} disabled={disabled} onChange={() => {
                      if (disabled) return
                      if (next) save({ boosts: next })
                      else {
                        const boosts = { ...c.boosts }
                        for (const slot of gs) {
                          if (!slot.fixed && boosts[slot.key] === a) delete boosts[slot.key]
                        }
                        save({ boosts })
                      }
                    }} />
                  <span>{a.toUpperCase()}</span>
                  <b>{signed(abilityMod(scores[a]))}</b>
                </label>
              )
            })}
          </div>
          {gs.some((s) => dupes.has(s.key)) && (
            <small role="alert">
              Duplicate boost.{' '}
              <button onClick={() => {
                const next = { ...boosts }
                for (const slot of gs) {
                  if (!slot.fixed && (dupes.has(slot.key) || gs.some((s) => s.fixed && s.fixed === boosts[slot.key]))) delete next[slot.key]
                }
                save({ boosts: next })
              }}>Clear duplicate choices</button>
            </small>
          )}
        </details>
      ))}
    </div>
  )
}

export function AbilitiesSection({ c, entries, save }: SectionProps) {
  const slots = boostSlots(c, entries)
  const builderOn = !!c.boosts
  const scores = computeAbilities(c, entries)
  const sharedGroups = [...new Set(slots.map((slot) => slot.group))]

  return (
    <details className="character-section">
      <summary className="character-section-summary"><strong>Ability Scores</strong></summary>
      <div className="character-section-content">
        {!builderOn && (
          <div className="row">
            {ABILITIES.map((a) => (
              <label key={a}>
                {a.toUpperCase()}{' '}
                <input type="number" min={1} max={30} value={c.abilities[a]}
                  onChange={(e) => save({ abilities: { ...c.abilities, [a]: +e.target.value || 10 } })} />
                {' '}{signed(abilityMod(c.abilities[a]))}
              </label>
            ))}
          </div>
        )}
        {builderOn && (
          <>
            <AbilityBoostChoices c={c} entries={entries} save={save} groups={sharedGroups} />
            <small>Scores: {ABILITIES.map((a) => `${a.toUpperCase()} ${scores[a]} (${signed(abilityMod(scores[a]))})`).join(', ')}</small>
          </>
        )}
      </div>
    </details>
  )
}
