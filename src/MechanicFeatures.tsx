import { abilityMod, proficiencyBonus, signed, type SectionProps } from './builder'
import { confirmRemoval } from './confirmRemoval'
import { TURRET_ARRAYS, TURRET_NAMES } from './mechanicTurret'
import type { Character } from './types'

export function mechanicMineState(c: Character) {
  const capacity = Math.max(0, 4 + abilityMod(c.abilities.int) + 2 * Math.floor(c.level / 5))
  const stored = c.mechanicMines
  const carried = stored && Number.isInteger(stored.carried) ? Math.max(0, Math.min(capacity, stored.carried)) : capacity
  const deployed = stored && Number.isInteger(stored.deployed) ? Math.max(0, stored.deployed) : 0
  return { capacity, carried, deployed }
}

export function MechanicFeatures({ c, save }: Pick<SectionProps, 'c' | 'save'>) {
  if (c.className !== 'Mechanic' || !c.systems.includes('sf2e')) return null
  const intelligence = abilityMod(c.abilities.int)
  const classRank = c.level >= 17 ? 3 : c.level >= 9 ? 2 : 1
  const classDc = 10 + intelligence + proficiencyBonus(classRank, c.level)
  const saveRank = c.level >= 15 ? 3 : c.level >= 10 ? 2 : 1
  const maxHp = 10 + (2 + intelligence) * c.level
  const array = c.mechanicTurretArray && TURRET_ARRAYS[c.mechanicTurretArray]
  const mines = mechanicMineState(c)
  return <div className="col">
    {c.subclass === 'Mine' && <>
      <strong>Mine exocortex</strong>
      <span>Mine capacity: {mines.capacity}; disable DC {classDc}</span>
      <span>Carried {mines.carried}/{mines.capacity}; deployed {mines.deployed}.</span>
      <div className="row">
        <button type="button" disabled={!mines.carried} onClick={() => save({
          mechanicMines: { carried: mines.carried - 1, deployed: mines.deployed + 1 },
        })}>Deploy mine</button>
        <button type="button" disabled={!mines.deployed} onClick={() => save({
          mechanicMines: { carried: mines.carried, deployed: mines.deployed - 1 },
        })}>Detonate mine</button>
        <button type="button" disabled={!mines.deployed || mines.carried + mines.deployed > mines.capacity}
          onClick={() => save({ mechanicMines: { carried: mines.carried + mines.deployed, deployed: 0 } })}>Collect mines</button>
        <button type="button" disabled={mines.carried >= mines.capacity} onClick={() => save({
          mechanicMines: { carried: Math.min(mines.capacity, mines.carried + 2), deployed: mines.deployed },
        })}>Craft mines (10 minutes)</button>
        <button type="button" onClick={() => {
          const reset = () => save({ mechanicMines: { carried: mines.capacity, deployed: 0 } })
          if (mines.deployed) confirmRemoval('deployed mines at daily preparations', reset)
          else reset()
        }}>Daily preparations</button>
      </div>
      {mines.deployed > 0 && mines.carried + mines.deployed > mines.capacity
        && <small role="status">Not enough carrying capacity to collect all deployed mines.</small>}
      <small>Deploy to an unoccupied square within 60 feet. Create two mines per 10 minutes; unused mines expire at daily preparations.</small>
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
      {array && <span>Turret array: {array.damage}; range {array.range} feet; {array.trait}, {array.group}.</span>}
      <span>AC {classDc}; HP {maxHp}; broken {Math.floor(maxHp / 2)}; hardness {5 + 5 * Math.min(3, Math.floor(c.level / 5))};
        Fortitude and Reflex {signed(intelligence + proficiencyBonus(saveRank, c.level))}.</span>
      <small>Manage turret grade, upgrades, and Strikes in Weapons.</small>
    </>}
    {c.subclass === 'Drone' && <small>Manage your drone and its customizations in Minions.</small>}
    <small><a href="https://2e.aonsrd.com/actions/546-modify" target="_blank" rel="noreferrer">Modify rules</a>:
      weapon mods are available on weapon cards; other mods require manual tracking.</small>
  </div>
}
