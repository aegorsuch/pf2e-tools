import { DRONE_CUSTOMIZATIONS, droneCustomizationSlots, droneStats } from './drone'
import { activeFeatsNamed, ranksAt, signed, weaponAttack, type SectionProps } from './builder'
import { confirmRemoval } from './confirmRemoval'
import { DroneEquipment } from './DroneEquipment'
import { DroneHealth } from './DroneHealth'
import { DRONE_CHASSIS, switchDroneChassis } from './droneChassis'
import { mechanicClassDC } from './mechanicRules'
import { DebilitatingExocortex } from './DebilitatingExocortex'
import { EnergyNeutralizer } from './EnergyNeutralizer'
import { MechanicWeaponMods } from './GearSection'
import { setEnduringMod } from './mechanicEnduring'
import { ItemTroubleshoot } from './ItemTroubleshoot'
import type { DroneCustomization, DroneCustomizationGrade } from './types'
import { Info, SourceNote } from './Info'

const GRADES: DroneCustomizationGrade[] = ['Commercial', 'Tactical', 'Advanced', 'Superior']

export function DroneFeatures({ c, entries, save }: SectionProps) {
  const slots = droneCustomizationSlots(c)
  if (!slots) return null
  const saved = c.mechanicDroneCustomizations ?? {}
  const stats = droneStats(c, entries)
  const convertible = activeFeatsNamed(c, 'Convertible Chassis')
  const base = c.mechanicDroneBaseChassis ?? c.mechanicDroneChassis
  const alternates = DRONE_CHASSIS.filter(chassis => chassis !== base && convertible.some(feat => feat.choice === chassis))
  const configured = !!c.mechanicDroneBaseChassis || convertible.length > 0
  const active = GRADES.flatMap(grade => (saved[grade] ?? []).slice(0, slots[grade]))
  const update = (grade: DroneCustomizationGrade, index: number, customization: DroneCustomization) => {
    const values = [...(saved[grade] ?? [])]
    while (values.length <= index) values.push({ name: '' })
    values[index] = customization
    save({ mechanicDroneCustomizations: { ...saved, [grade]: values } })
  }
  const hasPersonality = active.some(option => option.name === 'Artificial Personality' || option.name === 'Sapient')
  const sizes = c.mechanicDroneChassis === 'Agile' ? ['Small', 'Medium', ...(slots.Tactical ? ['Large'] : [])]
    : c.mechanicDroneChassis === 'Surveillance' ? ['Small', ...(slots.Tactical ? ['Medium'] : []), ...(slots.Advanced ? ['Large'] : [])]
      : c.mechanicDroneChassis === 'Powerful' || c.mechanicDroneChassis === 'Tank' ? ['Medium', 'Large']
        : c.mechanicDroneChassis === 'Imitator' ? ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'] : []
  const droneSize = c.mechanicDroneSize && sizes.includes(c.mechanicDroneSize) ? c.mechanicDroneSize : undefined
  return <div className="col">
    <strong>Drone exocortex</strong>
    <label>{configured ? 'Base chassis' : 'Chassis'}{' '}<select aria-label="Drone chassis" value={base ?? ''} onChange={event => {
      const chassis = DRONE_CHASSIS.find(option => option === event.target.value && !alternates.includes(option))
      if (chassis) {
        if (configured && c.mechanicDroneChassis) save({ ...switchDroneChassis(c, chassis), mechanicDroneBaseChassis: chassis })
        else save({ mechanicDroneChassis: chassis, ...(configured ? { mechanicDroneBaseChassis: chassis } : {}) })
      } else if (!event.target.value && !configured) save({ mechanicDroneChassis: undefined })
    }}>
      <option value="">Choose chassis</option>
      {DRONE_CHASSIS.map(name => <option key={name} disabled={alternates.includes(name)}>{name}</option>)}
    </select></label>
    {configured && base && <label>Active chassis{' '}
      <select aria-label="Active drone chassis" value={c.mechanicDroneChassis ?? base} onChange={event => {
        const chassis = [base, ...alternates].find(option => option === event.target.value)
        if (chassis && chassis !== c.mechanicDroneChassis) save(switchDroneChassis(c, chassis))
      }}>
        {c.mechanicDroneChassis && ![base, ...alternates].includes(c.mechanicDroneChassis)
          && <option value={c.mechanicDroneChassis} disabled>{c.mechanicDroneChassis} (unavailable)</option>}
        {[base, ...alternates].map(chassis => <option key={chassis}>{chassis}</option>)}
      </select>
    </label>}
    {alternates.length > 0 && <small>Mobile Reconfiguration: your drone spends two actions to switch chassis.</small>}
    {configured && base && !stats && <small role="status">Select an available chassis to restore drone statistics.</small>}
    {stats && <label>Drone size{' '}
      <select aria-label="Drone size" value={droneSize ?? ''} onChange={event => {
        const choice = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'] as const
        const size = choice.find(option => option === event.target.value && sizes.includes(option))
        if (!event.target.value || size) save({ mechanicDroneSize: size })
      }}>
        <option value="">Choose size</option>
        {sizes.map(size => <option key={size}>{size}</option>)}
      </select>
    </label>}
    {c.mechanicDroneChassis === 'Imitator' && <div className="col">
      {(['species', 'attack', 'damageType'] as const).map(field => <label key={field}>
        {field === 'species' ? 'Imitated species' : field === 'attack' ? 'Imitated attack' : 'Attack damage type'}{' '}
        <input aria-label={field === 'species' ? 'Imitated species' : field === 'attack' ? 'Imitated attack' : 'Attack damage type'}
          value={c.mechanicDroneImitator?.[field] ?? ''} onChange={event => save({
            mechanicDroneImitator: { ...c.mechanicDroneImitator, [field]: event.target.value },
          })} />
      </label>)}
      {(['Land', 'Climb', 'Swim', 'Fly', 'Burrow'] as const).map(name => <label key={name}>
        {name} Speed{' '}<input type="number" min={0} step={5} aria-label={`Imitated ${name} Speed`}
          value={c.mechanicDroneImitator?.speed?.[name] ?? ''} onChange={event => {
            const value = event.target.value === '' ? undefined : Number(event.target.value)
            if (value !== undefined && (!Number.isInteger(value) || value < 0)) return
            save({ mechanicDroneImitator: { ...c.mechanicDroneImitator,
              speed: { ...c.mechanicDroneImitator?.speed, [name]: value } } })
          }} />
      </label>)}
    </div>}
    <small>Control range 150 feet. Command with one action for two drone actions, or two actions for three.
      At 0 HP, the drone shuts down and reboots to 1 HP after one minute.</small>
    {slots.Tactical > 0 && <small>Without a Command, the tactical drone can Stride or Strike once on your turn.</small>}
    {stats && <>
      <small>Size: {droneSize ?? stats.chassis.size}. AC {stats.ac}
        {stats.protectCompanion && <SourceNote source="Protect Companion" note="+1 Circumstance (Protect Companion)" inlineSource />}; HP {stats.hp}.
        Perception {signed(stats.perception)}; Fortitude {signed(stats.fortitude)}, Reflex {signed(stats.reflex)}, Will {signed(stats.will)}.</small>
      <small>Attributes: Str {signed(stats.mods.str)}, Dex {signed(stats.mods.dex)}, Con {signed(stats.mods.con)},
        Int {signed(stats.mods.int)}, Wis {signed(stats.mods.wis)}, Cha {signed(stats.mods.cha)}.</small>
      <small>Speeds: {Object.entries(stats.speed).map(([name, feet]) => `${name} ${feet} feet`).join(', ') || 'determined by imitated creature'}.
        Senses: {stats.senses}{stats.scent ? ', imprecise scent 30 feet' : ''}
        {stats.preciseHearing ? ', precise hearing 30 feet' : ''}.</small>
      <small>Skills: {stats.skills.map(skill => `${skill.name} ${signed(skill.bonus)} (${['U', 'T', 'E', 'M', 'L'][skill.rank]})`).join(', ')}.</small>
      {stats.attacks.map(attack => {
        const weapon = { id: attack.id, name: `Drone ${attack.name} (${c.mechanicDroneChassis})`, potency: 0, striking: 0, runes: [] }
        const entry = { id: attack.id, name: weapon.name, kind: 'weapon' as const, level: 1, source: 'official' as const,
          systems: ['sf2e' as const], traits: [], description: '', effects: [], updatedAt: 0,
          data: { weapon_category: 'Unarmed', weapon_type: attack.ranged ? 'Ranged' : 'Melee',
            damage: `1d${attack.die} ${attack.baseType}`, range: attack.ranged ? 30 : 0 } }
        const details = weaponAttack(c, [...entries, entry], weapon)
        return <div key={attack.id} className="col">
          <small>{attack.name} {signed(attack.attack)}, {attack.damage}{attack.splash ? ` + ${attack.splash}` : ''}
            {attack.incapacitant ? ', nonlethal' : ''}{attack.range ? `; range ${attack.range} feet` : ''}.</small>
          <MechanicWeaponMods c={c} weapon={weapon} attack={details} save={save} allowUnarmed />
        </div>
      })}
      <small>Electricity weakness {stats.electricityWeakness}; immune to bleed, death, disease, doomed, drained, fatigued,
        {active.some(item => item.name === 'Biotech Healing Circuit') ? '' : ' healing,'}
        {active.some(item => item.name === 'Sapient') ? '' : ' mental,'} nonlethal attacks, paralyzed, poison, sickened, spirit, unconscious, vitality, and void.</small>
      {stats.resistances.map(resistance =>
        <small key={resistance.damage}>{resistance.damage} resistance {resistance.value} ({resistance.source}).</small>)}
      {active.filter(item => item.name === 'Maneuver Module').flatMap(item => [item.choice, item.choice2])
        .filter((choice): choice is string => !!choice && ['Disarm', 'Grapple', 'Reposition', 'Shove', 'Trip'].includes(choice))
        .map(choice => <small key={choice}>{choice} {signed((stats.skills.find(skill => skill.name === 'Athletics')?.bonus ?? 0)
          + (stats.superior ? 2 : 1))} (Maneuver Module).</small>)}
      {active.some(item => item.name === 'Emergency Repair') && <small>
        Emergency Repair: restore {c.level * (stats.superior ? 2 : 1)} HP as one action, once per 10 minutes.
      </small>}
      {!!stats.specs.length && <small>Specializations: {stats.specs.join(', ')}.</small>}
      {activeFeatsNamed(c, 'High Voltage').length > 0 && <small>
        Electrical Discharge (two actions): {Math.ceil(c.level / 2)}d6 electricity; 15-foot cone, 10-foot emanation,
        or 30-foot line; basic Reflex DC {mechanicClassDC(c)}. Recharges after 1d4 rounds.
      </small>}
      {activeFeatsNamed(c, 'Rocket Boosters').length > 0 && <small>
        Activate Thrusters (two actions, once per 10 minutes): Stride twice through creatures without triggering reactions;
        {` ${5 + Math.max(0, Math.floor((c.level - 10) / 2))}d6`} bludgeoning, basic Reflex DC {mechanicClassDC(c)};
        critical failure also knocks prone.
      </small>}
      {activeFeatsNamed(c, 'Spinning Blades').length > 0 && <small>
        Spin to Win (two actions): melee Strike each enemy within a 15-foot emanation.
        Each attack counts toward multiple attack penalty, which increases after all attacks.
      </small>}
      {stats.specs.includes('Racer') && <label>Racer speed{' '}
        <select aria-label="Drone Racer speed" value={c.mechanicDroneRacerSpeed ?? ''} onChange={event => {
          const value = ['Land', 'Swim', 'Fly'] as const
          const choice = value.find(option => option === event.target.value && stats.speed[option] > 0)
          if (!event.target.value || choice) save({ mechanicDroneRacerSpeed: choice })
        }}>
          <option value="">Choose speed</option>
          {(['Land', 'Swim', 'Fly'] as const).filter(name => stats.speed[name] > 0).map(name => <option key={name}>{name}</option>)}
        </select>
      </label>}
    </>}
    {stats && <DroneHealth c={c} entries={entries} save={save} />}
    {active.some(item => item.name === 'Assistant' && item.choice) && <label>
      <input type="checkbox" checked={!!c.mechanicDroneAssistantActive}
        onChange={event => save({ mechanicDroneAssistantActive: event.target.checked })} /> Drone assistant within reach
    </label>}
    {stats && <div className="col">
      <ItemTroubleshoot c={c} save={save} kind="drone" id="mechanic:drone" label="Drone" creature
        compensator={active.some(item => item.name === 'Upgrade Slot') && entries.some(entry =>
          entry.id === c.mechanicDroneArmorUpgrades?.[0] && !entry.deleted && entry.kind === 'item'
          && entry.systems.includes('sf2e') && entry.data.item_subcategory === 'Armor Upgrades' && entry.name === 'Glitch Compensator')} />
      <EnergyNeutralizer c={c} save={save} id="mechanic:drone" label="drone" />
      <DebilitatingExocortex c={c} choices={c.mechanicExocortexDebilitation}
        onChange={choices => save({ mechanicExocortexDebilitation: choices,
          ...(!choices.some(Boolean) && c.mechanicEnduringMod?.kind === 'exo' ? { mechanicEnduringMod: undefined } : {}) })}
        enduring={{ active: c.mechanicEnduringMod?.kind === 'exo', onChange: active => save(setEnduringMod(c, active
          ? { kind: 'exo', item: 'mechanic:exo', mod: 'debilitation', value: c.mechanicExocortexDebilitation ?? [], label: 'Drone' }
          : undefined)) }} />
      <label><input type="checkbox" checked={!!c.mechanicArmorMods?.['mechanic:drone']?.magneticLevitators}
        onChange={event => save({ mechanicArmorMods: { ...c.mechanicArmorMods,
          'mechanic:drone': { ...c.mechanicArmorMods?.['mechanic:drone'], magneticLevitators: event.target.checked } },
          ...(!event.target.checked && c.mechanicEnduringMod?.kind === 'armor'
            && c.mechanicEnduringMod.item === 'mechanic:drone' && c.mechanicEnduringMod.mod === 'magneticLevitators'
            ? { mechanicEnduringMod: undefined } : {}) })} />
        {' '}Magnetic Levitators (Modify)</label>
      {c.mechanicArmorMods?.['mechanic:drone']?.magneticLevitators && <small>Land Speed gains hover.</small>}
      <label><input type="checkbox" checked={!!c.mechanicDroneKillbotActive}
        onChange={event => save({ mechanicDroneKillbotActive: event.target.checked,
          ...(!event.target.checked && c.mechanicEnduringMod?.kind === 'drone' && c.mechanicEnduringMod.mod === 'killbot'
            ? { mechanicEnduringMod: undefined } : {}) })} /> Killbot (Modify)</label>
      <label><input type="checkbox" checked={!!c.mechanicDroneDesperateRepairActive}
        onChange={event => save({ mechanicDroneDesperateRepairActive: event.target.checked,
          ...(!event.target.checked && c.mechanicEnduringMod?.kind === 'drone' && c.mechanicEnduringMod.mod === 'desperateRepair'
            ? { mechanicEnduringMod: undefined } : {}) })} /> Desperate Repair (Modify)</label>
      {c.mechanicDroneDesperateRepairActive && <small>Temporary HP: {Math.max(0, c.level + Math.floor((c.abilities.int - 10) / 2))}.</small>}
      {c.level >= 13 && <label>Enduring Mod{' '}<select aria-label="Enduring mod: drone"
        value={c.mechanicEnduringMod?.item === 'mechanic:drone'
          && (c.mechanicEnduringMod.kind === 'drone'
            || c.mechanicEnduringMod.kind === 'armor' && c.mechanicEnduringMod.mod === 'magneticLevitators')
          ? c.mechanicEnduringMod.mod : ''} onChange={event => {
          if (event.target.value === 'magneticLevitators')
            save(setEnduringMod(c, { kind: 'armor', item: 'mechanic:drone', mod: 'magneticLevitators', label: 'Drone' }))
          else if (event.target.value === 'killbot' || event.target.value === 'desperateRepair')
            save(setEnduringMod(c, { kind: 'drone', item: 'mechanic:drone', mod: event.target.value, label: 'Drone' }))
          else if (!event.target.value && c.mechanicEnduringMod?.item === 'mechanic:drone'
            && (c.mechanicEnduringMod.kind === 'drone'
              || c.mechanicEnduringMod.kind === 'armor' && c.mechanicEnduringMod.mod === 'magneticLevitators')) save(setEnduringMod(c))
        }}>
        <option value="">Not enduring</option>
        <option value="desperateRepair">Desperate Repair</option>
        <option value="killbot">Killbot</option>
        <option value="magneticLevitators">Magnetic Levitators</option>
      </select></label>}
    </div>}
    {activeFeatsNamed(c, 'Advanced Drone').length > 0 && !['Burly', 'Deft'].includes(activeFeatsNamed(c, 'Advanced Drone')[0].choice ?? '')
      && <small role="status">Choose Burly or Deft in the Advanced Drone feat.</small>}
    {activeFeatsNamed(c, 'Superior Drone').some(feat => !feat.choice)
      && <small role="status">Choose a specialization in each Superior Drone feat.</small>}
    {GRADES.map(grade => slots[grade] > 0 && <div className="col" key={grade}>
      <strong>{grade} customizations ({slots[grade]})</strong>
      {Array.from({ length: slots[grade] }, (_, index) => {
        const selected = saved[grade]?.[index]
        const options = DRONE_CUSTOMIZATIONS[grade]
        const customization = options.find(option => option.name === selected?.name)
        const used = active.filter(item => item.name === selected?.name)
        const valid = !customization || customization.repeatable || used.length <= 1
        const needsPersonality = selected?.name === 'Linguistic Upload' || selected?.name === 'Glow Up'
        const other = GRADES.flatMap(otherGrade => (saved[otherGrade] ?? []).slice(0, slots[otherGrade])
          .filter((_, otherIndex) => otherGrade !== grade || otherIndex !== index))
        const withoutCurrent = { ...saved, [grade]: (saved[grade] ?? []).map((item, i) => i === index ? { name: '' } : item) }
        const otherStats = droneStats({ ...c, mechanicDroneCustomizations: withoutCurrent }, entries)
        const otherChoices = other.filter(item => item.name === selected?.name).flatMap(item => [item.choice, item.choice2])
        const characterRanks = selected?.name === 'Assistant' ? ranksAt(c, entries) : undefined
        const choiceAllowed = (choice: string) => {
          if (selected?.name === 'Skill Module' && otherChoices.includes(choice)) return false
          if (selected?.name === 'Expertise Module' && (otherChoices.includes(choice) || !otherStats?.ranks[choice])) return false
          if (selected?.name === 'Assistant' && (!otherStats?.ranks[choice] || !characterRanks?.[choice])) return false
          if (selected?.name === 'High Speed' && !otherStats?.speed[choice]) return false
          if (selected?.name === 'Maneuver Module' && otherChoices.includes(choice)) return false
          return true
        }
        return <div className="col" key={index}>
          <label>{grade} customization {index + 1}{' '}
            <select aria-label={`${grade} drone customization ${index + 1}`} value={selected?.name ?? ''} onChange={event => {
              const name = event.target.value
              const option = options.find(item => item.name === name)
              if (!name || option && (option.repeatable || !active.some(item => item.name === name))) {
                const apply = () => update(grade, index, { name })
                if (selected?.name && name !== selected.name) confirmRemoval(`drone customization "${selected.name}"`, apply)
                else apply()
              }
            }}>
              <option value="">Choose customization</option>
              {selected?.name && !customization && <option value={selected.name} disabled>{selected.name} (unavailable)</option>}
              {options.map(option => <option key={option.name} value={option.name}
                disabled={option.name !== selected?.name && (
                  !option.repeatable && active.some(item => item.name === option.name)
                  || (option.name === 'Linguistic Upload' || option.name === 'Glow Up')
                    && !other.some(item => item.name === 'Artificial Personality' || item.name === 'Sapient'))}>
                {option.name}
              </option>)}
            </select>
          </label>
          {customization && <>
            <Info label="Customization details">{customization.description}</Info>
            {!valid && <small role="status">This customization cannot be selected more than once.</small>}
            {needsPersonality && !hasPersonality && <small role="status">Requires Artificial Personality or Sapient.</small>}
            {customization.choices && <label>Choice{' '}
              <select aria-label={`${grade} customization ${index + 1} choice`} value={selected?.choice ?? ''}
                onChange={event => {
                  const choice = event.target.value
                  if (!choice || choiceAllowed(choice)) update(grade, index, { ...selected!, choice: choice || undefined,
                    ...(selected?.name === 'Maneuver Module' && selected.choice2 === choice ? { choice2: undefined } : {}) })
                }}>
                <option value="">Choose</option>
                {customization.choices.map(choice => <option key={choice} disabled={!choiceAllowed(choice)}>{choice}</option>)}
              </select>
            </label>}
            {customization.choices && selected?.choice && !choiceAllowed(selected.choice)
              && <small role="status">Saved choice does not currently meet this customization's requirements.</small>}
            {selected?.name === 'Maneuver Module' && <label>Second maneuver{' '}
              <select aria-label={`${grade} customization ${index + 1} second choice`} value={selected.choice2 ?? ''}
                onChange={event => {
                  const choice = event.target.value
                  if (!choice || choice !== selected.choice && choiceAllowed(choice))
                    update(grade, index, { ...selected, choice2: choice || undefined })
                }}>
                <option value="">Choose</option>
                {customization.choices?.map(choice => <option key={choice} disabled={choice === selected.choice || !choiceAllowed(choice)}>{choice}</option>)}
              </select>
            </label>}
            {selected?.name === 'Linguistic Upload' && <>
              {(['choice', 'choice2'] as const).map((field, languageIndex) => <label key={field}>Language {languageIndex + 1}{' '}
                <input aria-label={`Drone language ${languageIndex + 1}`} value={selected[field] ?? ''}
                  onChange={event => update(grade, index, { ...selected, [field]: event.target.value })} />
              </label>)}
            </>}
            {selected?.name === 'Camoflage' && <label>Biome{' '}
              <input aria-label="Drone camouflage biome" value={selected.choice ?? ''}
                onChange={event => update(grade, index, { ...selected, choice: event.target.value })} />
            </label>}
          </>}
        </div>
      })}
    </div>)}
    {stats && <DroneEquipment c={c} entries={entries} save={save} />}
  </div>
}
