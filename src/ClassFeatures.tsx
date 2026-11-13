import { Info } from './Info'
import { activeFeatsNamed, blessedArmamentRuneOptions, blessedArmamentTarget, blessedArmamentTargets, championBlessing, championBlessings, classFeatures, deitySanctification, runeBaseName, runeName, weaponRuneApplies, type SectionProps } from './builder'
import { ActionIcon } from './ActionIcon'
import { HANDWRAPS } from './supplemental'
import { SearchableSelect } from './SearchableSelect'

export function ClassFeatures({ c, entries, save }: SectionProps) {
  if (!c.className) return null
  const features = classFeatures(entries, c)
  const imported = entries.some((e) => e.kind === 'classFeature')
  const blessing = championBlessing(c)
  const extraBlessings = c.feats.flatMap((feat) => ['Second Blessing', 'Third Blessing'].includes(feat.name) && feat.choice ? [feat.choice] : [])
  const targets = c.className === 'Champion' && c.level >= 3 ? blessedArmamentTargets(c, entries) : []
  const target = blessedArmamentTarget(c, entries)
  const sanctification = deitySanctification(c, entries)
  const runes = blessedArmamentRuneOptions(c, entries).filter((rune) => target && !target.runes.some((existing) => runeBaseName(existing) === runeBaseName(rune)) && (target.id === HANDWRAPS.id
    ? !['Returning', 'Shifting'].includes(rune) : weaponRuneApplies(entries, target, rune)))
  return (
    <details className="character-subsection">
      <summary><h4>Class Features ({features.length})</h4></summary>
      {!imported && <p>Class feature data is still loading.</p>}
      {c.className === 'Champion' && activeFeatsNamed(c, 'Dragonslayer Oath').length > 0 && <div className="col">
        <b>Dragonslayer Oath (legacy)</b>
        <small>Against dragons, Retributive Strike deals +4 circumstance damage (+6 with master weapon proficiency).
          Glimpse of Redemption grants resistance {7 + c.level}; Liberating Step grants +4 circumstance to its checks and allows two Steps.
          These benefits apply only to the corresponding legacy champion reactions; verify legacy prerequisites with your GM.</small>
      </div>}
      {c.className === 'Champion' && c.level >= 1 && <label>Sanctification{' '}
        <select aria-label="Sanctification" value={sanctification.selected ?? ''} disabled={!!sanctification.required || !sanctification.options.length} onChange={(e) => {
          const choice = sanctification.options.find((option) => option === e.target.value)
          if (!sanctification.required) save({ sanctification: choice })
        }}>
          {!sanctification.required && <option value="">None</option>}
          {sanctification.options.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>}
      {c.className === 'Champion' && c.level >= 1 && <label>
        <input type="checkbox" aria-label="Legacy Tenets of Good" checked={!!c.legacyTenetsOfGood}
          onChange={event => save({ legacyTenetsOfGood: event.target.checked })} /> Follow legacy Tenets of Good
        <small> Confirm legacy compatibility with your GM; remastered causes do not automatically grant these tenets.</small>
      </label>}
      {c.className === 'Champion' && c.level >= 3 && <div className="col">
        <label>Blessing of the Devoted{' '}
          <select aria-label="Blessing of the Devoted" value={blessing ?? ''} onChange={(e) => {
            const choice = (['Blessed Armament', 'Blessed Shield', 'Blessed Swiftness'] as const).find((name) => name === e.target.value)
            save({ blessing: choice ?? '' })
          }}>
            <option value="">Choose blessing</option>
            {['Blessed Armament', 'Blessed Shield', 'Blessed Swiftness'].map((name) => <option key={name} disabled={extraBlessings.includes(name)}>{name}</option>)}
          </select>
        </label>
        {extraBlessings.length > 0 && <small>Additional blessings: {extraBlessings.join(', ')}. Change these with their feat choices.</small>}
        {championBlessings(c).includes('Blessed Armament') && <>
          {targets.length > 1 ? <span>Blessed armament{' '}
            <SearchableSelect aria-label="Blessed armament" value={target?.id ?? ''} onChange={(e) => {
              if (!e.target.value || targets.some((weapon) => weapon.id === e.target.value))
                save({ blessedArmament: { weaponId: e.target.value, rune: c.blessedArmament?.rune ?? '' } })
            }}>
              {!target && <option value="">Choose armament</option>}
              {c.blessedArmament?.weaponId && !target && <option value={c.blessedArmament.weaponId} disabled>Unavailable armament</option>}
              {[...targets].sort((a, b) => a.name.localeCompare(b.name)).map((weapon) => <option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}
            </SearchableSelect>
          </span> : target ? <span>Blessed armament: {target.name}</span> : null}
          {!targets.length && <small>Add your deity's favored weapon, or handwraps for a favored unarmed attack.</small>}
          <span>Free property rune{' '}
            <SearchableSelect aria-label="Blessed armament rune" disabled={!target} value={c.blessedArmament?.rune ?? ''} onChange={(e) => {
              if (target) save({ blessedArmament: { weaponId: target.id, rune: e.target.value } })
            }}>
              <option value="">Choose rune</option>
              {c.blessedArmament?.rune && !runes.includes(runeName(c.blessedArmament.rune)) && <option value={c.blessedArmament.rune} disabled>Unavailable: {c.blessedArmament.rune}</option>}
              {runes.map((rune) => <option key={rune}>{rune}</option>)}
            </SearchableSelect>
          </span>
          <small>One free rune outside normal property rune slots; grants critical specialization. Radiant Armament (10) and Armament Paragon (20) expand rune choices.</small>
        </>}
      </div>}
      <ul>
        {features.map((f) => (
          <li key={f.id}>
            {f.description
              ? <Info label={`L${String(f.level).padStart(2, '0')} ${f.name}`}>{f.description}</Info>
              : <b>L{String(f.level).padStart(2, '0')} {f.name}</b>} <ActionIcon entry={f} />
          </li>
        ))}
      </ul>
    </details>
  )
}
