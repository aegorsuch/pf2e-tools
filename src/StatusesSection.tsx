import { activeFeatsNamed, activeStance, armorEntry, armorProficiencyRank, conditionValue, featEffectChange, hasHuntPrey, isFeatEffectActive, knowsSpell, ownedArmors, type SectionProps } from './builder'
import { grantedFeatSpells } from './featSpells'
import { RageToggle } from './SkillsSection'
import { StancesContent } from './StancesSection'
import { automatedSpellStatusControls, ProtectCompanionOptions, ZealousConvictionToggle } from './SpellsSection'
import { SimplePoisons } from './GearSection'
import { isBastionNamedArmor } from './namedArmor'

const canDeviseAStratagem = (c: SectionProps['c']) => c.systems.includes('pf2e') && c.className === 'Investigator'

function entrenchMeleeActive(c: SectionProps['c'], entries: SectionProps['entries']) {
  return ownedArmors(c, entries).some(armor => {
    if (!isBastionNamedArmor(armor.name) || !armor.entrenchMeleeActive || !armor.worn || armor.inheritorCloakRed) return false
    const entry = armorEntry(c, entries, armor.name, armor.id)
    return !!entry && armorProficiencyRank(c, entries, entry) > 0
  })
}

export function StatusesSummary({ c, entries }: SectionProps) {
  const stance = activeStance(c, entries)
  const active = [
    ...(canDeviseAStratagem(c) && c.deviseAStratagemActive ? ['Devise a Stratagem'] : []),
    ...(hasHuntPrey(c, entries) && c.huntPreyActive ? ['Hunt Prey'] : []),
    ...(c.raging ? ['Rage'] : []),
    ...(stance ? [stance.name] : []),
    ...(c.poisonWeaponActive && activeFeatsNamed(c, 'Poison Weapon').length ? ['Poison Weapon'] : []),
    ...(entrenchMeleeActive(c, entries) ? ['Entrench Melee'] : []),
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
  const entrenchArmors = ownedArmors(c, entries).filter(armor => isBastionNamedArmor(armor.name))
  const controls = [
    { name: 'Active stance', element: <StancesContent c={c} entries={entries} save={save} /> },
    ...(activeFeatsNamed(c, 'Poison Weapon').length
      ? [{ name: 'Poison Weapon', element: <SimplePoisons c={c} entries={entries} save={save} /> }] : []),
    ...(canDeviseAStratagem(c)
      ? [{ name: 'Devise a Stratagem', element: <DeviseAStratagemToggle c={c} save={save} /> }] : []),
    ...(hasHuntPrey(c, entries)
      ? [{ name: 'Hunt Prey', element: <HuntPreyToggle c={c} entries={entries} save={save} /> }] : []),
    ...(entrenchArmors.length ? [{ name: 'Entrench Melee', element: <div>{entrenchArmors.map(armor => {
      const entry = armorEntry(c, entries, armor.name, armor.id)
      const disabled = !armor.worn || !entry || !armorProficiencyRank(c, entries, entry) || !!armor.inheritorCloakRed
      return <label key={armor.id}><input type="checkbox" aria-label={`Entrench Melee: ${armor.name} status`}
        checked={!!armor.entrenchMeleeActive} disabled={disabled}
        onChange={event => save({ armors: ownedArmors(c, entries).map(current => current.id === armor.id
          ? { ...current, entrenchMeleeActive: event.target.checked } : current) })} />
        {' '}Entrench Melee: {armor.name}</label>
    })}</div> }] : []),
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
