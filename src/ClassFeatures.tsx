import { Info } from './Info'
import { blessedArmamentRuneOptions, blessedArmamentTargets, championBlessing, championBlessings, classFeatures, runeBaseName, runeName, weaponRuneApplies, type SectionProps } from './builder'
import { ActionIcon } from './ActionIcon'
import { HANDWRAPS } from './supplemental'

export function ClassFeatures({ c, entries, save }: SectionProps) {
  if (!c.className) return null
  const features = classFeatures(entries, c)
  const imported = entries.some((e) => e.kind === 'classFeature')
  const blessing = championBlessing(c)
  const extraBlessings = c.feats.flatMap((feat) => ['Second Blessing', 'Third Blessing'].includes(feat.name) && feat.choice ? [feat.choice] : [])
  const targets = c.className === 'Champion' && c.level >= 3 ? blessedArmamentTargets(c, entries) : []
  const target = targets.find((weapon) => weapon.id === c.blessedArmament?.weaponId)
  const runes = blessedArmamentRuneOptions(c).filter((rune) => target && !target.runes.some((existing) => runeBaseName(existing) === runeBaseName(rune)) && (target.id === HANDWRAPS.id
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
            <select aria-label="Sanctification" value={c.sanctification ?? ''} onChange={(e) =>
              save({ sanctification: e.target.value === 'Holy' ? 'Holy' : e.target.value === 'Unholy' ? 'Unholy' : undefined })}>
              <option value="">None</option><option>Holy</option><option>Unholy</option>
            </select>
          </label>
          <label>Blessed armament{' '}
            <select aria-label="Blessed armament" value={c.blessedArmament?.weaponId ?? ''} onChange={(e) =>
              save({ blessedArmament: { weaponId: e.target.value, rune: c.blessedArmament?.rune ?? '' } })}>
              <option value="">Choose favored weapon</option>
              {c.blessedArmament?.weaponId && !target && <option value={c.blessedArmament.weaponId} disabled>Unavailable armament</option>}
              {[...targets].sort((a, b) => a.name.localeCompare(b.name)).map((weapon) => <option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}
            </select>
          </label>
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
