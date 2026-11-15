import { abilityMod, proficiencyBonus, signed, type SectionProps } from './builder'

const TURRET_ARRAYS = {
  Chaingun: { damage: 'piercing', range: 90, trait: 'Analog', group: 'Projectile' },
  Disintegrator: { damage: 'acid', range: 60, trait: 'Tech', group: 'Corrosive' },
  'Laser Beam': { damage: 'fire', range: 60, trait: 'Tech', group: 'Laser' },
  Thunderclap: { damage: 'sonic', range: 60, trait: 'Tech', group: 'Sonic' },
  'Volt Thrower': { damage: 'electricity', range: 60, trait: 'Tech', group: 'Shock' },
  'Zero Emitter': { damage: 'cold', range: 60, trait: 'Tech', group: 'Cryo' },
} as const
const TURRET_NAMES = ['Chaingun', 'Disintegrator', 'Laser Beam', 'Thunderclap', 'Volt Thrower', 'Zero Emitter'] as const

export function MechanicFeatures({ c, save }: Pick<SectionProps, 'c' | 'save'>) {
  if (c.className !== 'Mechanic' || !c.systems.includes('sf2e')) return null
  const intelligence = abilityMod(c.abilities.int)
  const classRank = c.level >= 17 ? 3 : c.level >= 9 ? 2 : 1
  const classDc = 10 + intelligence + proficiencyBonus(classRank, c.level)
  const saveRank = c.level >= 15 ? 3 : c.level >= 10 ? 2 : 1
  const maxHp = 10 + (2 + intelligence) * c.level
  const array = c.mechanicTurretArray && TURRET_ARRAYS[c.mechanicTurretArray]
  return <div className="col">
    {c.subclass === 'Mine' && <>
      <strong>Mine exocortex</strong>
      <span>Mine capacity: {Math.max(0, 4 + intelligence + 2 * Math.floor(c.level / 5))}; disable DC {classDc}</span>
      <small>Create two mines per 10 minutes; unused mines expire at daily preparations.</small>
    </>}
    {c.subclass === 'Turret' && <>
      <strong>Turret exocortex</strong>
      <label>Turret array{' '}
        <select aria-label="Turret array" value={c.mechanicTurretArray ?? ''} onChange={event => {
          const choice = TURRET_NAMES.find(name => name === event.target.value)
          save({ mechanicTurretArray: choice })
        }}>
          <option value="">Choose array</option>
          {TURRET_NAMES.map(name => <option key={name}>{name}</option>)}
        </select>
      </label>
      {array && <span>Commercial turret: 1d8 {array.damage}; range {array.range} feet; {array.trait}, {array.group}.</span>}
      <span>AC {classDc}; HP {maxHp}; broken {Math.floor(maxHp / 2)}; hardness {5 + 5 * Math.min(3, Math.floor(c.level / 5))};
        Fortitude and Reflex {signed(intelligence + proficiencyBonus(saveRank, c.level))}.</span>
      <small>Turret upgrades, weapon grade, and Strikes are not yet automated.</small>
    </>}
    {c.subclass === 'Drone' && <small>Drone chassis, customizations, and statistics are not yet automated.</small>}
    <small><a href="https://2e.aonsrd.com/actions/546-modify" target="_blank" rel="noreferrer">Modify rules</a>:
      modifications are not yet applied automatically to gear.</small>
  </div>
}
