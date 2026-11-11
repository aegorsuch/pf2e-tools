import { ABILITIES, ABILITY_LABEL, abilityMod, boostSlots, computeAbilities, duplicateBoosts, signed, type Ability, type BoostSlot, type SectionProps } from './builder'

const GROUP_TITLE: Record<string, string> = { ancestry: 'Ancestry Boosts', background: 'Background Boosts', class: 'Class Boost', free1: 'Free Boosts' }
const groupTitle = (g: string) => GROUP_TITLE[g] ?? `Level ${g.slice(3)} Boosts`
// Ancestry/background/class boosts are dropdowns; the free groups are ability checkboxes
const isPick = (g: string) => g in GROUP_TITLE && g !== 'free1'

export function AbilityBoostChoices({ c, entries, save, groups: visibleGroups }: SectionProps & { groups: string[] }) {
  const slots = boostSlots(c, entries)
  const dupes = duplicateBoosts(c, entries)
  if (!c.boosts) return null
  const scores = computeAbilities(c, entries)
  const groupedSlots = slots.reduce((m, s) => m.set(s.group, [...(m.get(s.group) ?? []), s]), new Map<string, BoostSlot[]>())
  const groups = [...groupedSlots].filter(([group]) => visibleGroups.includes(group))

  const setBoost = (key: string, a: Ability | '') => {
    const boosts = { ...c.boosts }
    if (a) boosts[key] = a
    else delete boosts[key]
    save({ boosts })
  }

  // Checking fills the group's first empty slot; unchecking frees the slot that holds the ability
  const toggleFree = (group: BoostSlot[], a: Ability) => {
    const held = group.find((s) => c.boosts?.[s.key] === a)
    if (held) return setBoost(held.key, '')
    const empty = group.find((s) => !c.boosts?.[s.key])
    if (empty) setBoost(empty.key, a)
  }

  return (
    <div className="boost-panels">
      {groups.map(([group, gs]) => (
        <section key={group} className="boost-panel">
          <h4>{groupTitle(group)}</h4>
          {isPick(group) ? (
            <div className="boost-picks">
              {gs.map((s) => (
                <div key={s.key} className="boost-pick">
                  <span className="boost-plus">+</span>
                  {s.fixed ? <b>{ABILITY_LABEL[s.fixed]}</b> : (
                    <select value={c.boosts?.[s.key] ?? ''} aria-label={s.label}
                      style={dupes.has(s.key) ? { outline: '2px solid red' } : undefined}
                      onChange={(e) => setBoost(s.key, e.target.value as Ability | '')}>
                      <option value="">Choose…</option>
                      {(s.options ?? ABILITIES).map((a) => <option key={a} value={a}>{ABILITY_LABEL[a]}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="boost-checks">
              {ABILITIES.map((a) => {
                const checked = gs.some((s) => c.boosts?.[s.key] === a)
                const full = !checked && gs.every((s) => c.boosts?.[s.key])
                return (
                  <label key={a} className={full ? 'disabled' : undefined}>
                    <input type="checkbox" checked={checked} disabled={full} onChange={() => toggleFree(gs, a)} />
                    <span>{a.toUpperCase()}</span>
                    <b>{signed(abilityMod(scores[a]))}</b>
                  </label>
                )
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

export function AbilitiesSection({ c, entries, save }: SectionProps) {
  const slots = boostSlots(c, entries)
  const builderOn = !!c.boosts
  const scores = computeAbilities(c, entries)
  const sharedGroups = [...new Set(slots.map((slot) => slot.group))]
    .filter((group) => group !== 'class')

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
