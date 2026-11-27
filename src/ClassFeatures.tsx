import { Info } from './Info'
import { activeFeatsNamed, barbarianInstinct, canBeGiantWeapon, canBeOsteoArmament, canBeVerdantWeapon, isGiantInstinct, ownedWeapons, weaponEquipped, blessedArmamentRuneOptions, blessedArmamentTarget, blessedArmamentTargets, championBlessing, championBlessings, classFeatures, deitySanctification, precisionEdgeDamageDice, runeBaseName, runeName, selectedSubclass, solarWeaponTraitBudget, solarWeaponTraits, SOLAR_WEAPON_TRAITS, weaponRuneApplies, type SectionProps } from './builder'
import type { OwnedWeapon } from './types'
import { HANDWRAPS } from './supplemental'
import { SearchableSelect } from './SearchableSelect'
import { championCauseTenets } from './featPrerequisites'
import { MechanicFeatures } from './MechanicFeatures'
import { RunesmithFeatures } from './RunesmithFeatures'
import { WitchwarperFeatures } from './WitchwarperFeatures'
import { abilityMod, animalRageFormChange, classDifficultyClass, conditionPenalty, dragonTransformationChange, elementalRageType, isFeatEffectActive, proficiencyBonus, signed, thrashDamage, weaponRanks, withoutBattleForm } from './builder'
import { animalBattleForm } from './battleForms'
import { ANIMAL_BRUTALITY_TRAITS, ANIMAL_INSTINCTS, DRAGON_FORMS, DRAGON_INSTINCTS, ELEMENTAL_INSTINCTS, type DragonInstinct, type ElementalInstinct } from './barbarian'
import { DamageRoll } from './SpellDamage'
import { SourceNote } from './Info'

const SCOURING_DAMAGE_TYPES = ['acid', 'bludgeoning', 'cold', 'electricity', 'fire', 'force', 'mental',
  'piercing', 'poison', 'slashing', 'sonic', 'spirit', 'vitality', 'void']

export function ClassFeatures({ c, entries, save }: SectionProps) {
  if (!c.className) return null
  const features = classFeatures(entries, c)
  const imported = entries.some((e) => e.kind === 'classFeature')
  const precisionEdge = c.systems.includes('pf2e') && c.className === 'Ranger'
    && selectedSubclass(c, entries) === 'Precision'
  const precisionEdgeDice = precisionEdgeDamageDice(c, entries)
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
  const solarTraits = (twin: boolean) => {
    const config = twin ? c.solarianTwinWeapon : c.solarianWeapon
    const selected = solarWeaponTraits(c, twin)
    const budget = solarWeaponTraitBudget(c)
    const options: readonly string[] = activeFeatsNamed(c, 'Twin Weapons').length
      ? [...SOLAR_WEAPON_TRAITS, 'Agile', 'Twin'] : SOLAR_WEAPON_TRAITS
    const damage = (config?.damageType ?? 'Bludgeoning')[0]
    return Array.from({ length: budget }, (_, index) => <label key={index}>
      {twin ? 'Twin Solar Weapon' : 'Solar Weapon'} trait {index + 1}{' '}
      <select aria-label={`${twin ? 'Twin Solar Weapon' : 'Solar Weapon'} trait ${index + 1}`}
        value={selected[index] ?? ''} onChange={event => {
          const value = event.target.value
          if (value && !options.includes(value)) return
          let next = [...selected]
          if (!value) next.splice(index, 1)
          else if (value === 'Reach' || value === 'Two-Hand d10') next = [value]
          else {
            if (next.some(item => item === 'Reach' || item === 'Two-Hand d10')) next = []
            next[index] = value
            next = next.filter(Boolean)
          }
          const updated = { damageType: config?.damageType ?? 'Bludgeoning', ...config, traits: next }
          save(twin ? { solarianTwinWeapon: updated } : { solarianWeapon: updated })
        }}>
        <option value="">None</option>
        {options.filter(trait => trait !== `Versatile ${damage}`
          && (trait === selected[index] || !selected.some((other, otherIndex) => otherIndex !== index
            && (other === trait || other.startsWith('Versatile ') && trait.startsWith('Versatile '))))).map(trait =>
          <option key={trait} value={trait}>{trait}</option>)}
      </select>
    </label>)
  }
  return (
    <div className="class-feature-controls">
      {!imported && <p>Class feature data is still loading.</p>}
      <MechanicFeatures c={c} save={save} />
      <WitchwarperFeatures c={c} save={save} />
      {(c.className === 'Solarian' || activeFeatsNamed(c, 'Solarian Dedication').length > 0) && <div className="col" aria-label="Solarian manifestations">
        <label>Attunement{' '}
          <select aria-label="Solarian attunement" value={c.solarianAttunement ?? 'Graviton'}
            onChange={event => {
              const value = event.target.value
              if (value === 'Graviton' || value === 'Photon' || value === 'Unattuned')
                save({ solarianAttunement: value })
            }}>
            <option>Graviton</option>
            <option>Photon</option>
            <option>Unattuned</option>
          </select>
        </label>
        {c.solarianAttunement !== 'Unattuned' && <>
          <label>Solar Weapon damage{' '}
            <select aria-label="Solar Weapon damage type" value={c.solarianWeapon?.damageType ?? 'Bludgeoning'}
              onChange={event => save({ solarianWeapon: { ...c.solarianWeapon, damageType: event.target.value as 'Bludgeoning' | 'Piercing' | 'Slashing' } })}>
              <option>Bludgeoning</option><option>Piercing</option><option>Slashing</option>
            </select>
          </label>
          <label>Solar Weapon group{' '}
            <select aria-label="Solar Weapon weapon group" value={c.solarianWeapon?.weaponGroup ?? 'Brawling'}
              onChange={event => save({ solarianWeapon: { damageType: c.solarianWeapon?.damageType ?? 'Bludgeoning', ...c.solarianWeapon, weaponGroup: event.target.value } })}>
              {['Axe', 'Brawling', 'Club', 'Flail', 'Knife', 'Pick', 'Polearm', 'Shield', 'Spear', 'Sword'].map(name =>
                <option key={name}>{name}</option>)}
            </select>
          </label>
          {solarTraits(false)}
          {activeFeatsNamed(c, 'Twin Weapons').length > 0 && <>
            <label>Twin Solar Weapon damage{' '}
              <select aria-label="Twin Solar Weapon damage type" value={c.solarianTwinWeapon?.damageType ?? 'Bludgeoning'}
                onChange={event => save({ solarianTwinWeapon: { ...c.solarianTwinWeapon, damageType: event.target.value as 'Bludgeoning' | 'Piercing' | 'Slashing' } })}>
                <option>Bludgeoning</option><option>Piercing</option><option>Slashing</option>
              </select>
            </label>
            <label>Twin Solar Weapon group{' '}
              <select aria-label="Twin Solar Weapon weapon group" value={c.solarianTwinWeapon?.weaponGroup ?? 'Brawling'}
                onChange={event => save({ solarianTwinWeapon: { damageType: c.solarianTwinWeapon?.damageType ?? 'Bludgeoning', ...c.solarianTwinWeapon, weaponGroup: event.target.value } })}>
                {['Axe', 'Brawling', 'Club', 'Flail', 'Knife', 'Pick', 'Polearm', 'Shield', 'Spear', 'Sword'].map(name =>
                  <option key={name}>{name}</option>)}
              </select>
            </label>
            {solarTraits(true)}
          </>}
        </>}
      </div>}
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
      {precisionEdge && <div className="col" aria-label="Precision Edge">
        <span>Precision Edge{' '}
          {precisionEdgeDice > 0
            ? <DamageRoll name="Precision Edge" damage={{ label: 'Precision damage', dice: precisionEdgeDice, sides: 8, type: 'precision' }}
              onRoll={() => save({ rangerPrecisionHitsThisRound: (c.rangerPrecisionHitsThisRound ?? 0) + 1 })} />
            : 'Precision Edge damage used this round'}
        </span>
        <button type="button" disabled={!c.rangerPrecisionHitsThisRound}
          onClick={() => save({ rangerPrecisionHitsThisRound: 0 })}>Reset for new round</button>
        <SourceNote source="Precision Edge"
          note={`Roll after a hit against hunted prey. First hit each round: ${c.level >= 19 ? '3d8' : c.level >= 11 ? '2d8' : '1d8'} precision damage.${c.level >= 19 ? ' Second hit: 2d8; third hit: 1d8.' : ''} Reset at the start of each new round.`} />
      </div>}
      {instinct === 'animal' && <div className="col" aria-label="Animal Instinct">
        <label>Animal{' '}
          <select aria-label="Animal Instinct animal" value={c.barbarianAnimal ?? ''} disabled={!!c.raging || !!c.animalRageForm} onChange={event => {
            const animal = Object.keys(ANIMAL_INSTINCTS).find(name => name === event.target.value)
            save({ barbarianAnimal: animal })
          }}>
            <option value="">Choose animal</option>
            {Object.keys(ANIMAL_INSTINCTS).sort().map(animal => <option key={animal}>{animal}</option>)}
          </select>
        </label>
        {c.raging && <SourceNote source="Bestial Rage" note="You cannot use weapons while raging." />}
        {c.raging && !!activeFeatsNamed(c, 'Animal Rage').length && <label>
          <input type="checkbox" aria-label="Animal Rage form active" checked={!!c.animalRageForm}
            disabled={!c.animalRageForm && (!c.barbarianAnimal || !animalBattleForm(c.barbarianAnimal === 'Wolf' ? 'Canine' : c.barbarianAnimal, 3, c.level))}
            onChange={event => save(animalRageFormChange(c, event.target.checked))} /> Animal Rage form active
          <SourceNote source="Animal Rage" note={`One action while raging; lasts 1 minute or until dismissed. Use your own statistics, temporary HP, and unarmed attacks; retain your gear's constant abilities.${c.barbarianAnimal && !animalBattleForm(c.barbarianAnimal === 'Wolf' ? 'Canine' : c.barbarianAnimal, 3, c.level) ? ' No Animal Form statistics are listed for this animal; its form requires GM adjudication.' : ''}`} />
        </label>}
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
      {c.raging && !!activeFeatsNamed(c, 'Dragon Transformation').length && <div className="col" aria-label="Dragon Transformation">
        <label>Dragon Transformation{' '}
          <select aria-label="Dragon Transformation form" value={c.dragonTransformation ?? ''} disabled={!!c.dragonTransformation}
            onChange={event => {
              const dragon = Object.keys(DRAGON_FORMS).find(name => name === event.target.value)
              if (dragon) save(dragonTransformationChange(c, dragon))
            }}>
            <option value="">Choose dragon</option>
            {Object.keys(DRAGON_FORMS).map(dragon => <option key={dragon}>{dragon}</option>)}
          </select>
        </label>
        <SourceNote source="Dragon Transformation" note="One action; lasts 1 minute or until dismissed. Usable once per 10 minutes. Add its 10 temporary HP to temporary HP from Rage actions. Tradition resistance depends on GM interpretation because this is not a spell." />
        {c.dragonTransformation && DRAGON_FORMS[c.dragonTransformation] && <>
          <button type="button" onClick={() => save(dragonTransformationChange(c, undefined))}>Dismiss Dragon Transformation</button>
          <span>Dragon Breath{' '}
            <DamageRoll name="Dragon Transformation Breath" actions="Two Actions"
              damage={{ label: 'Damage', dice: 10, sides: 6, bonus: c.level >= 18 ? 14 : 0, type: DRAGON_FORMS[c.dragonTransformation].damage }} />
            <SourceNote source="Dragon Breath" note={`${DRAGON_FORMS[c.dragonTransformation].line ? '100-foot line' : '30-foot cone'}; basic ${DRAGON_FORMS[c.dragonTransformation].save} save against ${classDifficultyClass(c, entries) ?? 'class DC'}. After use, wait 1d4 rounds before using Dragon Breath again.`} />
          </span>
        </>}
      </div>}
      {instinct === 'spirit' && <div className="col" aria-label="Spirit Instinct">
        <label><input type="checkbox" aria-label="Use Spirit Rage" checked={!!c.spiritRage} disabled={!!c.raging}
          onChange={event => save({ spiritRage: event.target.checked })} /> Use Spirit Rage</label>
        {c.raging && !!activeFeatsNamed(c, "Spirit's Wrath").length && <span>
          Spirit's Wrath: {signed(proficiencyBonus(weaponRanks(c, entries).Martial, c.level) + abilityMod(c.abilities.str) + 2 - conditionPenalty(c, 'str')
            + (isFeatEffectActive(c, 'Desperate Wrath') ? 2 : 0))}{' '}
          <DamageRoll name="Spirit's Wrath" actions="Single Action"
            damage={{ label: 'Damage', dice: 4, sides: 8, bonus: abilityMod(c.abilities.con), type: 'spirit' }} />
          <SourceNote source="Spirit's Wrath" note="Melee wisp rush against a target within 120 feet. Uses and increases your multiple attack penalty. On a critical hit, deal double damage and inflict frightened 1. Apply other applicable status and circumstance modifiers." />
        </span>}
      </div>}
      {c.raging && !!activeFeatsNamed(c, 'Thrash').length && <span>
        Thrash{' '}<DamageRoll name="Thrash" actions="Single Action"
          damage={{ label: 'Damage', dice: 0, sides: 0, bonus: thrashDamage(c, entries), type: 'bludgeoning' }} />
        <SourceNote source="Thrash" note={`Against an enemy you have grabbed or restrained; basic Fortitude save against ${classDifficultyClass(c, entries) ?? 'class DC'}. Uses unarmed weapon specialization and Rage damage.${activeFeatsNamed(c, 'Collateral Thrash').length ? ' Collateral Thrash also affects one enemy adjacent to the grabbed creature, with a basic Reflex save.' : ''}${activeFeatsNamed(c, 'Whirlwind Toss').length ? ' Whirlwind Toss applies Collateral Thrash to all other adjacent enemies, then throws the grabbed creature 10 feet and knocks it prone.' : ''}`} />
      </span>}
      {c.raging && !!activeFeatsNamed(c, 'Brutal Bully').length && <span>
        Brutal Bully{' '}<DamageRoll name="Brutal Bully" damage={{ label: 'Damage',
          dice: 0, sides: 0, bonus: Math.max(0, abilityMod(c.abilities.str)), type: 'bludgeoning' }} />
        <SourceNote source="Brutal Bully" note="On a successful Disarm, Grapple, Reposition, Shove, or Trip, deal this damage to the enemy; add it to damage from a critical Trip." />
      </span>}
      {!!activeFeatsNamed(c, 'Impressive Landing').length && <span>
        Impressive Landing{' '}<DamageRoll name="Impressive Landing" actions="Reaction"
          damage={{ label: 'Damage', dice: 0, sides: 0, bonus: 5, type: 'bludgeoning' }} />
        <SourceNote source="Impressive Landing" note="After falling at least 10 feet onto a solid surface, treat the fall as 10 feet shorter and land standing. Creatures in a 5-foot emanation take damage and are off-guard until the start of your next turn; the ground becomes difficult terrain." />
      </span>}
      {c.raging && !!activeFeatsNamed(c, 'Quaking Stomp').length && <span>
        Quaking Stomp{' '}<DamageRoll name="Quaking Stomp collapse" actions="Single Action"
          damage={{ label: 'Collapse damage', dice: 11, sides: 6, type: 'bludgeoning' }} />
        <SourceNote source="Quaking Stomp" note={`Once per 10 minutes: create an earthquake in a 60-foot burst within 500 feet. Collapse damage requires a basic Reflex save against ${classDifficultyClass(c, entries) ?? 'class DC'}; the GM determines which structures collapse. The ground becomes difficult terrain and imposes a -2 circumstance penalty to attacks, AC, and skill checks for 1 round. Permanent 40-foot fissures require Reflex saves at the start of creatures' turns.`} />
      </span>}
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
      {c.className === 'Runesmith' && c.systems.includes('pf2e') && <RunesmithFeatures c={c} entries={entries} save={save} />}
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
          {sanctification.options.map((option) => <option key={option} disabled={c.feats.some(feat => feat.name === 'Vow of Mortal Defiance')}>{option}</option>)}
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
            <SearchableSelect aria-label="Blessed armament rune" disabled={!target} value={c.blessedArmament?.rune ?? ''}
              optionLevel={value => entries.find(entry => entry.kind === 'item' && runeName(entry.name) === runeName(value))?.level} onChange={(e) => {
              if (target) save({ blessedArmament: { weaponId: target.id, rune: e.target.value } })
            }}>
              <option value="">Choose rune</option>
              {c.blessedArmament?.rune && !runes.includes(runeName(c.blessedArmament.rune)) && <option value={c.blessedArmament.rune} disabled>Unavailable: {c.blessedArmament.rune}</option>}
              {runes.map((rune) => <option key={rune}>{rune}</option>)}
            </SearchableSelect>
          </span>
        </>}
      </div>}
    </div>
  )
}
