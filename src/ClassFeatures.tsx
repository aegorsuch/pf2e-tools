import { Info } from './Info'
import { activeFeatsNamed, barbarianInstinct, canBeGiantWeapon, canBeOsteoArmament, canBeVerdantWeapon, isGiantInstinct, ownedWeapons, weaponEquipped, blessedArmamentRuneOptions, blessedArmamentTarget, blessedArmamentTargets, championBlessing, championBlessings, classFeatures, deitySanctification, runeBaseName, runeName, weaponRuneApplies, type SectionProps } from './builder'
import type { OwnedWeapon } from './types'
import { ActionIcon } from './ActionIcon'
import { HANDWRAPS } from './supplemental'
import { SearchableSelect } from './SearchableSelect'
import { championCauseTenets } from './featPrerequisites'
import { MechanicFeatures } from './MechanicFeatures'
import { WitchwarperFeatures } from './WitchwarperFeatures'

export function ClassFeatures({ c, entries, save }: SectionProps) {
  if (!c.className) return null
  const features = classFeatures(entries, c)
  const imported = entries.some((e) => e.kind === 'classFeature')
  const blessing = championBlessing(c)
  const extraBlessings = c.feats.flatMap((feat) => ['Second Blessing', 'Third Blessing'].includes(feat.name) && feat.choice ? [feat.choice] : [])
  const targets = c.className === 'Champion' && c.level >= 3 ? blessedArmamentTargets(c, entries) : []
  const target = blessedArmamentTarget(c, entries)
  const sanctification = deitySanctification(c, entries)
  const weapons = ownedWeapons({ ...c, activeSpells: c.activeSpells?.filter(name => name !== 'Dinosaur Form') }, entries)
  const giant = isGiantInstinct(c, entries)
  const instinct = barbarianInstinct(c, entries)
  const verdant = c.systems.includes('pf2e') && ['Verdant Weapon', 'Verdant Weapon Jousting']
    .some(name => activeFeatsNamed(c, name).length > 0)
  const verdantWeapon = weapons.find(weapon => weapon.verdantWeapon)
  const osteo = c.systems.includes('pf2e') && c.level >= 4 && activeFeatsNamed(c, 'Osteo Armaments').length > 0
  const osteoWeapon = weapons.find(weapon => weapon.osteoArmament)
  const selectWeapon = (id: string, tag: 'verdantWeapon' | 'osteoArmament') => {
    const saved = c.weapons ?? weapons.filter(weapon => !weapon.attachedTo)
    const chosen = weapons.find(weapon => weapon.id === id)
    save({ weapons: [...saved, ...(chosen && !saved.some(weapon => weapon.id === id) ? [chosen] : [])]
      .map(weapon => ({ ...weapon, [tag]: weapon.id === id })) })
  }
  const weaponChoice = (label: string, value: string | undefined, eligible: (weapon: OwnedWeapon) => boolean,
    onChange: (id: string) => void) => {
    const options = weapons.filter(weapon => eligible(weapon) && weaponEquipped(c, entries, weapon))
      .sort((a, b) => a.name.localeCompare(b.name))
    const saved = weapons.find(weapon => weapon.id === value)
    return <div className="col">
      <label>{label}{' '}
        <SearchableSelect aria-label={label} value={value ?? ''} onChange={event => {
          if (!event.target.value || options.some(weapon => weapon.id === event.target.value)) onChange(event.target.value)
        }}>
          <option value="">Choose equipped weapon</option>
          {value && !options.some(weapon => weapon.id === value)
            && <option value={value} disabled>{saved ? `${saved.name} (not equipped or unavailable)` : 'Saved weapon unavailable'}</option>}
          {options.map(weapon => <option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}
        </SearchableSelect>
      </label>
      {!options.length && <small role="status">Equip an eligible weapon in Gear to select it here.</small>}
    </div>
  }
  const runes = blessedArmamentRuneOptions(c, entries).filter((rune) => target && !target.runes.some((existing) => runeBaseName(existing) === runeBaseName(rune)) && (target.id === HANDWRAPS.id
    ? !['Returning', 'Shifting'].includes(rune) : weaponRuneApplies(entries, target, rune)))
  return (
    <details className="character-subsection">
      <summary><h4>Class Features ({features.length})</h4></summary>
      {!imported && <p>Class feature data is still loading.</p>}
      <MechanicFeatures c={c} save={save} />
      <WitchwarperFeatures c={c} save={save} />
      {giant && <div className="col" aria-label="Giant Instinct">
        {weaponChoice('Giant Instinct weapon', c.giantWeaponId, weapon => canBeGiantWeapon(c, entries, weapon),
          id => save({ giantWeaponId: id || undefined }))}
        {c.level >= 9 && <label>Raging Resistance{' '}
          <select aria-label="Giant Raging Resistance" value={c.giantRagingResistance ?? ''} onChange={event => {
            const choice = (['Cold', 'Electricity', 'Fire'] as const).find(name => name === event.target.value)
            save({ giantRagingResistance: choice })
          }}>
            <option value="">Choose damage type</option>
            {['Cold', 'Electricity', 'Fire'].map(name => <option key={name}>{name}</option>)}
          </select>
        </label>}
      </div>}
      {verdant && <div className="col" aria-label="Verdant Weapon selection">
        {weaponChoice('Verdant Weapon', verdantWeapon?.id, weapon => canBeVerdantWeapon(c, entries, weapon),
          id => selectWeapon(id, 'verdantWeapon'))}
      </div>}
      {osteo && <div className="col" aria-label="Osteo Armaments selection">
        {weaponChoice('Osteo Armaments', osteoWeapon?.id, weapon => canBeOsteoArmament(c, entries, weapon),
          id => selectWeapon(id, 'osteoArmament'))}
      </div>}
      {c.raging && instinct && !['giant', 'fury'].includes(instinct)
        && <small role="status">Only base Rage damage is automated for this instinct; apply its instinct-specific damage benefits separately.</small>}
      {c.className === 'Guardian' && features.some(feature => feature.name === 'Reaction Time') && <div className="col">
        <Info label="Reaction Time">You have 2 reactions each turn; the additional reaction can be used only for guardian feats or class features
          (including Shield Block){features.some(feature => feature.name === 'Ever Ready' || feature.name === "Guardian's Techniques")
            ? ', and you also have it when you roll initiative' : ''}.</Info>
      </div>}
      {c.className === 'Champion' && activeFeatsNamed(c, 'Dragonslayer Oath').length > 0 && <div className="col">
        <Info label="Dragonslayer Oath (legacy)">Against dragons, Retributive Strike deals +4 circumstance damage (+6 with master weapon proficiency).
          Glimpse of Redemption grants resistance {7 + c.level}; Liberating Step grants +4 circumstance to its checks and allows two Steps.
          These benefits apply only to the corresponding legacy champion reactions; verify legacy prerequisites with your GM.</Info>
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
      {c.className === 'Champion' && c.level >= 1 && !championCauseTenets(c.subclass) && <label>
        <input type="checkbox" aria-label="Confirm legacy Tenets of Good" checked={!!c.legacyTenetsOfGood}
          onChange={event => save({ legacyTenetsOfGood: event.target.checked })} /> Confirm legacy Tenets of Good
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
        {extraBlessings.length > 0 && <small>Additional blessings: {extraBlessings.join(', ')}.</small>}
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
