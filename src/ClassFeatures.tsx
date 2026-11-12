import { Info } from './Info'
import { blessedArmamentRuneOptions, blessedArmamentTarget, blessedArmamentTargets, championBlessing, championBlessings, classFeatures, deitySanctification, runeBaseName, runeName, weaponRuneApplies, type SectionProps } from './builder'
import { ActionIcon } from './ActionIcon'
import { HANDWRAPS } from './supplemental'

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
          <label>Sanctification{' '}
            <select aria-label="Sanctification" value={sanctification.selected ?? ''} disabled={!!sanctification.required || !sanctification.options.length} onChange={(e) => {
              const choice = sanctification.options.find((option) => option === e.target.value)
              if (!sanctification.required) save({ sanctification: choice })
            }}>
              {!sanctification.required && <option value="">None</option>}
              {sanctification.options.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          {targets.length > 1 ? <label>Blessed armament{' '}
            <select aria-label="Blessed armament" value={target?.id ?? ''} onChange={(e) => {
              if (!e.target.value || targets.some((weapon) => weapon.id === e.target.value))
                save({ blessedArmament: { weaponId: e.target.value, rune: c.blessedArmament?.rune ?? '' } })
            }}>
              {!target && <option value="">Choose armament</option>}
              {c.blessedArmament?.weaponId && !target && <option value={c.blessedArmament.weaponId} disabled>Unavailable armament</option>}
              {[...targets].sort((a, b) => a.name.localeCompare(b.name)).map((weapon) => <option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}
            </select>
          </label> : target ? <span>Blessed armament: {target.name}</span> : null}
          {!targets.length && <small>Add your deity's favored weapon, or handwraps for a favored unarmed attack.</small>}
          <label>Free property rune{' '}
            <select aria-label="Blessed armament rune" disabled={!target} value={c.blessedArmament?.rune ?? ''} onChange={(e) => {
              if (target) save({ blessedArmament: { weaponId: target.id, rune: e.target.value } })
            }}>
              <option value="">Choose rune</option>
              {c.blessedArmament?.rune && !runes.includes(runeName(c.blessedArmament.rune)) && <option value={c.blessedArmament.rune} disabled>Unavailable: {c.blessedArmament.rune}</option>}
              {runes.map((rune) => <option key={rune}>{rune}</option>)}
            </select>
          </label>
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
