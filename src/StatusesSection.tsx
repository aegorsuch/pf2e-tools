import { activeFeatsNamed, activeStance, conditionValue, featEffectChange, hasHuntPrey, isFeatEffectActive, knowsSpell, type SectionProps } from './builder'
import { grantedFeatSpells } from './featSpells'
import { RageToggle } from './SkillsSection'
import { StancesContent } from './StancesSection'
import { automatedSpellStatusControls, ProtectCompanionOptions, ZealousConvictionToggle } from './SpellsSection'
import { SimplePoisons } from './GearSection'

const canDeviseAStratagem = (c: SectionProps['c']) => c.systems.includes('pf2e') && c.className === 'Investigator'

export function StatusesSummary({ c, entries }: SectionProps) {
  const stance = activeStance(c, entries)
  const simplePoisons = activeFeatsNamed(c, 'Poison Weapon').length > 0
    ? `Simple poisons ${Math.max(0, c.level - Math.max(0, Math.min(c.level, Math.floor(c.simplePoisonsSpent ?? 0))))}/${c.level} remaining`
    : undefined
  const active = [
    ...(canDeviseAStratagem(c) && c.deviseAStratagemActive ? ['Devise a Stratagem'] : []),
    ...(hasHuntPrey(c, entries) && c.huntPreyActive ? ['Hunt Prey'] : []),
    ...(c.raging ? ['Rage'] : []),
    ...(stance ? [stance.name] : []),
    ...(simplePoisons ? [simplePoisons] : []),
    ...c.activeSpells ?? [],
    ...c.activeFeatEffects ?? [],
    ...(c.zealousConvictionRank !== undefined ? ['Zealous Conviction'] : []),
    ...(activeFeatsNamed(c, 'Favored Terrain').length && isFeatEffectActive(c, 'Favored Terrain') ? ['Favored Terrain'] : []),
    ...(['frightened', 'sickened', 'enfeebled'] as const).flatMap(name =>
      conditionValue(c, name) ? [`${name[0].toUpperCase() + name.slice(1)} ${conditionValue(c, name)}`] : []),
  ]
  return <summary className="character-section-summary"><strong>Statuses</strong>
    <span>{[...new Set(active)].sort((a, b) => a.localeCompare(b)).join(', ') || 'None active'}</span>
  </summary>
}

export function DeviseAStratagemToggle({ c, save, summary = false }: Pick<SectionProps, 'c' | 'save'> & { summary?: boolean }) {
  if (!canDeviseAStratagem(c)) return null
  const toggle = <label><input type="checkbox" aria-label="Devise a Stratagem active" checked={!!c.deviseAStratagemActive}
    onChange={event => save({ deviseAStratagemActive: event.target.checked })} /> Devise a Stratagem</label>
  return summary
    ? <span className="combat-summary-toggles" onClick={event => event.stopPropagation()}>{toggle}</span>
    : toggle
}

export function HuntPreyToggle({ c, entries, save, summary = false }: SectionProps & { summary?: boolean }) {
  if (!hasHuntPrey(c, entries)) return null
  const toggle = <label><input type="checkbox" aria-label="Hunt Prey active" checked={!!c.huntPreyActive}
    onChange={event => save({ huntPreyActive: event.target.checked })} /> Hunt Prey</label>
  return summary
    ? <span className="combat-summary-toggles" onClick={event => event.stopPropagation()}>{toggle}</span>
    : toggle
}

export function StatusesContent({ c, entries, save }: SectionProps) {
  const grant = grantedFeatSpells(c, entries).find(spell => spell.source === 'Heroic Presence')
  const controls = [
    { name: 'Active stance', element: <StancesContent c={c} entries={entries} save={save} /> },
    ...(activeFeatsNamed(c, 'Poison Weapon').length
      ? [{ name: 'Simple poisons', element: <SimplePoisons c={c} entries={entries} save={save} /> }] : []),
    ...(canDeviseAStratagem(c)
      ? [{ name: 'Devise a Stratagem', element: <DeviseAStratagemToggle c={c} save={save} /> }] : []),
    ...(hasHuntPrey(c, entries)
      ? [{ name: 'Hunt Prey', element: <HuntPreyToggle c={c} entries={entries} save={save} /> }] : []),
    ...(['enfeebled', 'frightened', 'sickened'] as const).map(name => ({
      name, element: <label>
        {name[0].toUpperCase() + name.slice(1)}{' '}
        <input type="number" min="0" step="1" aria-label={`${name[0].toUpperCase() + name.slice(1)} status`}
          value={conditionValue(c, name)} onChange={event => {
            const value = Number(event.target.value)
            if (!Number.isSafeInteger(value) || value < 0) return
            save({ conditions: { ...c.conditions, [name]: value } })
          }} />
      </label>,
    })),
    ...(c.className === 'Barbarian' || activeFeatsNamed(c, 'Barbarian Dedication').length
      ? [{ name: 'Rage', element: <RageToggle c={c} save={save} /> }] : []),
    ...(grant || c.zealousConvictionRank !== undefined
      ? [{ name: 'Zealous Conviction', element: <ZealousConvictionToggle c={c} save={save} rank={grant?.rank ?? c.zealousConvictionRank!} /> }] : []),
    ...(activeFeatsNamed(c, 'Favored Terrain').length
      ? [{ name: 'Favored Terrain', element: <label><input type="checkbox" aria-label="Favored Terrain status"
        checked={isFeatEffectActive(c, 'Favored Terrain')} disabled={activeFeatsNamed(c, 'Terrain Master').length > 0}
        onChange={event => save(featEffectChange(c, 'Favored Terrain', event.target.checked))} /> Favored Terrain</label> }] : []),
    ...(knowsSpell(c, entries, 'Protect Companion') || c.activeSpells?.includes('Protect Companion')
      ? [{ name: 'Protect Companion', element: <ProtectCompanionOptions c={c} save={save} /> }] : []),
    ...automatedSpellStatusControls({ c, entries, save }),
  ].sort((a, b) => a.name.localeCompare(b.name))
  return <div className="character-section-content">
    <div className="condition-controls" role="group" aria-label="Statuses">
      {controls.map(control => <div className="status-row" key={control.name}>{control.element}</div>)}
    </div>
  </div>
}
