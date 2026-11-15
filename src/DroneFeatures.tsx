import { DRONE_CUSTOMIZATIONS, droneCustomizationSlots, droneStats } from './drone'
import { activeFeatsNamed, ranksAt, signed, type SectionProps } from './builder'
import { confirmRemoval } from './confirmRemoval'
import type { DroneCustomization, DroneCustomizationGrade } from './types'

const GRADES: DroneCustomizationGrade[] = ['Commercial', 'Tactical', 'Advanced', 'Superior']
const CHASSIS = ['Agile', 'Imitator', 'Powerful', 'Surveillance', 'Tank'] as const

export function DroneFeatures({ c, entries, save }: SectionProps) {
  const slots = droneCustomizationSlots(c)
  if (!slots) return null
  const saved = c.mechanicDroneCustomizations ?? {}
  const stats = droneStats(c)
  const active = GRADES.flatMap(grade => (saved[grade] ?? []).slice(0, slots[grade]))
  const update = (grade: DroneCustomizationGrade, index: number, customization: DroneCustomization) => {
    const values = [...(saved[grade] ?? [])]
    while (values.length <= index) values.push({ name: '' })
    values[index] = customization
    save({ mechanicDroneCustomizations: { ...saved, [grade]: values } })
  }
  const hasPersonality = active.some(option => option.name === 'Artificial Personality' || option.name === 'Sapient')
  return <div className="col">
    <strong>Drone exocortex</strong>
    <label>Chassis{' '}<select aria-label="Drone chassis" value={c.mechanicDroneChassis ?? ''} onChange={event => {
      const chassis = CHASSIS.find(option => option === event.target.value)
      if (!event.target.value || chassis) save({ mechanicDroneChassis: chassis })
    }}>
      <option value="">Choose chassis</option>
      {CHASSIS.map(name => <option key={name}>{name}</option>)}
    </select></label>
    <small>Control range 150 feet. Command with one action for two drone actions, or two actions for three.
      At 0 HP, the drone shuts down and reboots to 1 HP after one minute.</small>
    {slots.Tactical > 0 && <small>Without a Command, the tactical drone can Stride or Strike once on your turn.</small>}
    {stats && <>
      <small>Size: {stats.chassis.size}. AC {stats.ac}; HP {stats.hp}.
        Perception {signed(stats.perception)}; Fortitude {signed(stats.fortitude)}, Reflex {signed(stats.reflex)}, Will {signed(stats.will)}.</small>
      <small>Attributes: Str {signed(stats.mods.str)}, Dex {signed(stats.mods.dex)}, Con {signed(stats.mods.con)},
        Int {signed(stats.mods.int)}, Wis {signed(stats.mods.wis)}, Cha {signed(stats.mods.cha)}.</small>
      <small>Speeds: {Object.entries(stats.speed).map(([name, feet]) => `${name} ${feet} feet`).join(', ') || 'determined by imitated creature'}.
        Senses: {stats.senses}{active.some(item => item.name === 'Olfactory Receptors') ? ', imprecise scent 30 feet' : ''}
        {active.some(item => item.name === 'Echolocation') ? ', precise hearing 30 feet' : ''}.</small>
      <small>Skills: {stats.skills.map(skill => `${skill.name} ${signed(skill.bonus)} (${['U', 'T', 'E', 'M', 'L'][skill.rank]})`).join(', ')}.</small>
      <small>Attacks: {stats.attacks.map(attack => `${attack.name} ${signed(attack.attack)}, ${attack.damage}`).join('; ')}.</small>
      <small>Electricity weakness {stats.electricityWeakness}; immune to bleed, death, disease, doomed, drained, fatigued,
        {active.some(item => item.name === 'Biotech Healing Circuit') ? '' : ' healing,'}
        {active.some(item => item.name === 'Sapient') ? '' : ' mental,'} nonlethal attacks, paralyzed, poison, sickened, spirit, unconscious, vitality, and void.</small>
      {active.some(item => item.name === 'Resistant Panels' && item.choice) && <small>Resistance {Math.ceil(c.level / 2)}:{' '}
        {active.filter(item => item.name === 'Resistant Panels' && item.choice).map(item => item.choice).join(', ')}.</small>}
      {!!stats.specs.length && <small>Specializations: {stats.specs.join(', ')}.</small>}
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
    {active.some(item => item.name === 'Assistant' && item.choice) && <label>
      <input type="checkbox" checked={!!c.mechanicDroneAssistantActive}
        onChange={event => save({ mechanicDroneAssistantActive: event.target.checked })} /> Drone assistant within reach
    </label>}
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
        const otherStats = droneStats({ ...c, mechanicDroneCustomizations: withoutCurrent })
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
            <small>{customization.description}</small>
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
    <small>Customizations can be changed during daily preparations.</small>
    <small>Weapon mounts, armor upgrades, and situational customization effects require manual tracking.</small>
  </div>
}
