import { activeStance, conditionValue, knowsSpell, type SectionProps } from './builder'
import { grantedFeatSpells } from './featSpells'
import { RageToggle } from './SkillsSection'
import { StancesContent } from './StancesSection'
import { AutomatedSpellStatuses, ProtectCompanionOptions, ZealousConvictionToggle } from './SpellsSection'

export function StatusesSummary({ c, entries }: SectionProps) {
  const stance = activeStance(c, entries)
  const active = [
    ...(c.raging ? ['Rage'] : []),
    ...(stance ? [stance.name] : []),
    ...c.activeSpells ?? [],
    ...c.activeFeatEffects ?? [],
    ...(c.zealousConvictionRank !== undefined ? ['Zealous Conviction'] : []),
    ...(['frightened', 'sickened', 'enfeebled'] as const).flatMap(name =>
      conditionValue(c, name) ? [`${name[0].toUpperCase() + name.slice(1)} ${conditionValue(c, name)}`] : []),
  ]
  return <summary className="character-section-summary"><strong>Statuses</strong>
    <span>{[...new Set(active)].join(', ') || 'None active'}</span>
  </summary>
}

export function StatusesContent({ c, entries, save }: SectionProps) {
  const grant = grantedFeatSpells(c, entries).find(spell => spell.source === 'Heroic Presence')
  return <div className="character-section-content">
    <div className="condition-controls" role="group" aria-label="Statuses">
      {(['frightened', 'sickened', 'enfeebled'] as const).map(name => <label key={name}>
        {name[0].toUpperCase() + name.slice(1)}{' '}
        <input type="number" min="0" step="1" aria-label={`${name[0].toUpperCase() + name.slice(1)} status`}
          value={conditionValue(c, name)} onChange={event => {
            const value = Number(event.target.value)
            if (!Number.isSafeInteger(value) || value < 0) return
            save({ conditions: { ...c.conditions, [name]: value } })
          }} />
      </label>)}
      <RageToggle c={c} save={save} />
      {(grant || c.zealousConvictionRank !== undefined) && <ZealousConvictionToggle c={c} save={save} rank={grant?.rank ?? c.zealousConvictionRank!} />}
      {(knowsSpell(c, entries, 'Protect Companion') || c.activeSpells?.includes('Protect Companion'))
        && <ProtectCompanionOptions c={c} save={save} />}
      <AutomatedSpellStatuses c={c} entries={entries} save={save} />
    </div>
    <StancesContent c={c} entries={entries} save={save} />
  </div>
}
