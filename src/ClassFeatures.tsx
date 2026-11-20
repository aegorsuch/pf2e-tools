import { Info } from './Info'
import { activeFeatsNamed, barbarianInstinct, canBeGiantWeapon, canBeOsteoArmament, canBeVerdantWeapon, isGiantInstinct, ownedWeapons, weaponEquipped, blessedArmamentRuneOptions, blessedArmamentTarget, blessedArmamentTargets, championBlessing, championBlessings, classFeatures, deitySanctification, runeBaseName, runeName, weaponRuneApplies, type SectionProps } from './builder'
import type { OwnedWeapon } from './types'
import { ActionIcon } from './ActionIcon'
import { HANDWRAPS } from './supplemental'
import { SearchableSelect } from './SearchableSelect'
import { championCauseTenets } from './featPrerequisites'
import { MechanicFeatures } from './MechanicFeatures'
import { WitchwarperFeatures } from './WitchwarperFeatures'
import { abilityMod, classDifficultyClass, elementalRageType, isFeatEffectActive, proficiencyBonus, signed, weaponRanks, withoutBattleForm } from './builder'
import { ANIMAL_BRUTALITY_TRAITS, ANIMAL_INSTINCTS, DRAGON_INSTINCTS, ELEMENTAL_INSTINCTS, type DragonInstinct, type ElementalInstinct } from './barbarian'
import { DamageRoll } from './SpellDamage'
import { SourceNote } from './Info'

const SCOURING_DAMAGE_TYPES = ['acid', 'bludgeoning', 'cold', 'electricity', 'fire', 'force', 'mental',
  'piercing', 'poison', 'slashing', 'sonic', 'spirit', 'vitality', 'void']

export function ClassFeatures({ c, entries, save }: SectionProps) {
  if (!c.className) return null
  const features = classFeatures(entries, c)
  const imported = entries.some((e) => e.kind === 'classFeature')
  const blessing = championBlessing(c)
  const extraBlessings = c.feats.flatMap((feat) => ['Second Blessing', 'Third Blessing'].includes(feat.name) && feat.choice ? [feat.choice] : [])
  const targets = c.className === 'Champion' && c.level >= 3 ? blessedArmamentTargets(c, entries) : []
  const target = blessedArmamentTarget(c, entries)
  const sanctification = deitySanctification(c, entries)
  const weapons = ownedWeapons(withoutBattleForm(c), entries)
  const giant = isGiantInstinct(c, entries)
  const instinct = barbarianInstinct(c, entries)
  const element = c.barbarianElement && ELEMENTAL_INSTINCTS[c.barbarianElement]
  const elementalType = elementalRageType(c, entries)
  const scouringType = instinct === 'elemental' ? elementalType
    : instinct === 'dragon' && c.draconicRage && c.barbarianDragon ? DRAGON_INSTINCTS[c.barbarianDragon]?.damage
    : instinct === 'spirit' && c.spiritRage ? 'spirit' : undefined
  const scouringEligible = ['dragon', 'elemental', 'spirit'].includes(instinct ?? '')
  const chosenScouringType = scouringType ?? (SCOURING_DAMAGE_TYPES.includes(c.scouringRageDamage ?? '') ? c.scouringRageDamage : undefined)
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
      {instinct === 'animal' && <div className="col" aria-label="Animal Instinct">
        <label>Animal{' '}
          <select aria-label="Animal Instinct animal" value={c.barbarianAnimal ?? ''} disabled={!!c.raging} onChange={event => {
            const animal = Object.keys(ANIMAL_INSTINCTS).find(name => name === event.target.value)
            save({ barbarianAnimal: animal })
          }}>
            <option value="">Choose animal</option>
            {Object.keys(ANIMAL_INSTINCTS).sort().map(animal => <option key={animal}>{animal}</option>)}
          </select>
        </label>
        {c.raging && <SourceNote source="Bestial Rage" note="You cannot use weapons while raging." />}
        {c.raging && c.barbarianAnimal && ANIMAL_INSTINCTS[c.barbarianAnimal] && !!activeFeatsNamed(c, 'Animalistic Brutality').length && <label>
          Animalistic Brutality{' '}
          <select aria-label="Animalistic Brutality" value={c.animalisticBrutality ? `${c.animalisticBrutality.attack}|${c.animalisticBrutality.trait}` : ''} disabled={!!c.animalisticBrutality}
            onChange={event => {
              const [attack, selected] = event.target.value.split('|')
              const trait = ANIMAL_BRUTALITY_TRAITS.find(value => value === selected)
              if (trait && ANIMAL_INSTINCTS[c.barbarianAnimal!].some(option => attack === `bestial:${c.barbarianAnimal}:${option.name}`))
                save({ animalisticBrutality: { attack, trait } })
            }}>
            <option value="">Choose attack and trait</option>
            {ANIMAL_INSTINCTS[c.barbarianAnimal].flatMap(attack => ANIMAL_BRUTALITY_TRAITS.map(trait =>
              <option key={`${attack.name}:${trait}`} value={`bestial:${c.barbarianAnimal}:${attack.name}|${trait}`}>{attack.name} - {trait}</option>))}
          </select>
        </label>}
      </div>}
      {instinct === 'dragon' && <div className="col" aria-label="Dragon Instinct">
        <label>Dragon{' '}
          <select aria-label="Dragon Instinct dragon" value={c.barbarianDragon ?? ''} disabled={!!c.raging} onChange={event => {
            const choice = (Object.keys(DRAGON_INSTINCTS) as DragonInstinct[]).find(name => name === event.target.value)
            save({ barbarianDragon: choice })
          }}>
            <option value="">Choose dragon</option>
            {(Object.keys(DRAGON_INSTINCTS) as DragonInstinct[]).map(name => <option key={name}>{name}</option>)}
          </select>
        </label>
        {c.barbarianDragon && DRAGON_INSTINCTS[c.barbarianDragon] && <>
          <label><input type="checkbox" aria-label="Use Draconic Rage" checked={!!c.draconicRage} disabled={!!c.raging}
            onChange={event => save({ draconicRage: event.target.checked })} /> Use Draconic Rage</label>
          {c.raging && !!activeFeatsNamed(c, "Dragon's Rage Breath").length && <span>
            Dragon's Rage Breath{' '}
            <DamageRoll name="Dragon's Rage Breath" actions="Two Actions"
              damage={{ label: 'Damage', dice: c.level, sides: 6, type: DRAGON_INSTINCTS[c.barbarianDragon].damage }} />
            <SourceNote source="Dragon's Rage Breath" note={`30-foot cone; basic Reflex save against ${classDifficultyClass(c, entries) ?? 'class DC'}. ${DRAGON_INSTINCTS[c.barbarianDragon].tradition} trait; once per 10 minutes.`} />
          </span>}
        </>}
      </div>}
      {instinct === 'spirit' && <div className="col" aria-label="Spirit Instinct">
        <label><input type="checkbox" aria-label="Use Spirit Rage" checked={!!c.spiritRage} disabled={!!c.raging}
          onChange={event => save({ spiritRage: event.target.checked })} /> Use Spirit Rage</label>
        {c.raging && !!activeFeatsNamed(c, "Spirit's Wrath").length && <span>
          Spirit's Wrath: {signed(proficiencyBonus(weaponRanks(c, entries).Martial, c.level) + abilityMod(c.abilities.str) + 2
            + (isFeatEffectActive(c, 'Desperate Wrath') ? 2 : 0))}{' '}
          <DamageRoll name="Spirit's Wrath" actions="Single Action"
            damage={{ label: 'Damage', dice: 4, sides: 8, bonus: abilityMod(c.abilities.con), type: 'spirit' }} />
          <SourceNote source="Spirit's Wrath" note="Melee wisp rush against a target within 120 feet. Uses and increases your multiple attack penalty. On a critical hit, deal double damage and inflict frightened 1. Apply other applicable status and circumstance modifiers." />
        </span>}
      </div>}
      {instinct === 'superstition' && c.level >= 9 && <label>Raging Resistance{' '}
        <select aria-label="Superstition Raging Resistance" value={c.superstitionTraditions ?? ''} disabled={!!c.raging} onChange={event => {
          const choice = (['Arcane and Occult', 'Arcane and Primal', 'Divine and Occult', 'Divine and Primal'] as const)
            .find(value => value === event.target.value)
          save({ superstitionTraditions: choice })
        }}>
          <option value="">Choose traditions</option>
          {['Arcane and Occult', 'Arcane and Primal', 'Divine and Occult', 'Divine and Primal'].map(value => <option key={value}>{value}</option>)}
        </select>
      </label>}
      {instinct === 'elemental' && <div className="col" aria-label="Elemental Instinct">
        <label>Element{' '}
          <select aria-label="Elemental Instinct element" value={c.barbarianElement ?? ''} disabled={!!c.raging} onChange={event => {
            const choice = (Object.keys(ELEMENTAL_INSTINCTS) as ElementalInstinct[]).find(name => name === event.target.value)
            save({ barbarianElement: choice, elementalDamage: undefined, elementalUseEvolution: false })
          }}>
            <option value="">Choose element</option>
            {(Object.keys(ELEMENTAL_INSTINCTS) as ElementalInstinct[]).map(name => <option key={name}>{name}</option>)}
          </select>
        </label>
        {element && <label>Elemental damage{' '}
          <select aria-label="Elemental Instinct damage" value={c.elementalDamage ?? ''} disabled={!!c.raging} onChange={event => {
            const damage = element.damage.find(value => value === event.target.value)
            save({ elementalDamage: damage, elementalUseEvolution: false })
          }}>
            <option value="">Choose damage</option>
            {element.damage.map(damage => <option key={damage} value={damage}>{damage}</option>)}
          </select>
        </label>}
        {element && c.elementalDamage && !!activeFeatsNamed(c, 'Elemental Evolution')[0]?.choice && <label>
          <input type="checkbox" aria-label="Use Elemental Evolution" checked={!!c.elementalUseEvolution} disabled={!!c.raging}
            onChange={event => save({ elementalUseEvolution: event.target.checked })} /> Use Elemental Evolution
        </label>}
        {c.raging && elementalType && !!activeFeatsNamed(c, 'Elemental Explosion').length && <span>
          Elemental Explosion{' '}
          <DamageRoll name="Elemental Explosion" actions="Two Actions" disabled={!!c.elementalExplosionUsed}
            onRoll={() => save({ elementalExplosionUsed: true })}
            damage={{ label: 'Damage', dice: c.level, sides: 8, type: elementalType }} />
          <SourceNote source="Elemental Explosion" note={`15-foot emanation; basic Reflex save against ${classDifficultyClass(c, entries) ?? 'class DC'}. ${c.barbarianElement} trait; once per Rage.`} />
        </span>}
      </div>}
      {c.raging && scouringEligible && !!activeFeatsNamed(c, 'Scouring Rage').length && !scouringType && <label>
        Scouring Rage damage{' '}
        <select aria-label="Scouring Rage damage type" value={c.scouringRageDamage ?? ''} disabled={!!c.scouringRageUsed}
          onChange={event => save({ scouringRageDamage: SCOURING_DAMAGE_TYPES.find(type => type === event.target.value) })}>
          <option value="">Choose damage type</option>
          {SCOURING_DAMAGE_TYPES.map(type => <option key={type}>{type}</option>)}
        </select>
      </label>}
      {c.raging && scouringEligible && chosenScouringType && !!activeFeatsNamed(c, 'Scouring Rage').length && <span>
        Scouring Rage{' '}
        <DamageRoll name="Scouring Rage" actions="Free Action" disabled={!!c.scouringRageUsed}
          onRoll={() => save({ scouringRageUsed: true })}
          damage={{ label: 'Damage', dice: 0, sides: 0, bonus: c.level, type: chosenScouringType }} />
        <SourceNote source="Scouring Rage" note={`When you Rage: enemies within 20 feet; basic Fortitude save against ${classDifficultyClass(c, entries) ?? 'class DC'}. Damage type matches your Rage damage.`} />
      </span>}
      {verdant && <div className="col" aria-label="Verdant Weapon selection">
        {weaponChoice('Verdant Weapon', verdantWeapon?.id, weapon => canBeVerdantWeapon(c, entries, weapon),
          id => selectWeapon(id, 'verdantWeapon'))}
      </div>}
      {osteo && <div className="col" aria-label="Osteo Armaments selection">
        {weaponChoice('Osteo Armaments', osteoWeapon?.id, weapon => canBeOsteoArmament(c, entries, weapon),
          id => selectWeapon(id, 'osteoArmament'))}
      </div>}
      {c.raging && instinct && !['giant', 'fury', 'dragon', 'animal', 'spirit', 'superstition'].includes(instinct) && !(instinct === 'elemental' && elementalType)
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
