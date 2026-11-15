import { abilityMod, activeFeatsNamed, proficiencyBonus, signed, type SectionProps } from './builder'
import { confirmRemoval } from './confirmRemoval'
import { TURRET_ARRAYS, TURRET_NAMES } from './mechanicTurret'
import { mechanicClassDC } from './mechanicRules'
import { TransmutativeCasing } from './TransmutativeCasing'
import { DebilitatingExocortex } from './DebilitatingExocortex'
import { ExploitiveAssault } from './ExploitiveAssault'
import type { Character, MechanicMine } from './types'

export function mechanicMineState(c: Character) {
  const capacity = Math.max(0, 4 + abilityMod(c.abilities.int) + 2 * Math.floor(c.level / 5))
  const stored = c.mechanicMines
  const carried = stored && Number.isInteger(stored.carried) ? Math.max(0, Math.min(capacity, stored.carried)) : capacity
  const deployed = stored && Number.isInteger(stored.deployed) ? Math.max(0, stored.deployed) : 0
  return { capacity, carried, deployed }
}

export function mechanicMineDamage(c: Character, mine: MechanicMine) {
  const base = mine.baseDamage ?? 'fire'
  const types: NonNullable<MechanicMine['damageType']>[] = base === 'fire' ? ['acid', 'cold', 'electricity', 'fire', 'sonic']
    : ['bludgeoning', 'piercing', 'slashing']
  const damageType = c.level >= 5 && mine.damageType && types.includes(mine.damageType) ? mine.damageType : base
  const bonus = mine.targeting ? Math.max(0, abilityMod(c.abilities.int)) : 0
  return {
    damage: `${2 + Math.floor((Math.max(1, c.level) - 1) / 2)}d6${bonus ? `+${bonus}` : ''} ${damageType}`,
    radius: (c.level >= 15 ? 20 : c.level >= 10 ? 15 : 10) + (mine.bigBoom ? 5 : 0),
    types,
  }
}

export function MechanicFeatures({ c, save }: Pick<SectionProps, 'c' | 'save'>) {
  if (c.className !== 'Mechanic' || !c.systems.includes('sf2e')) return null
  const intelligence = abilityMod(c.abilities.int)
  const classDc = mechanicClassDC(c)
  const saveRank = c.level >= 15 ? 3 : c.level >= 10 ? 2 : 1
  const maxHp = 10 + (2 + intelligence) * c.level
  const array = c.mechanicTurretArray && TURRET_ARRAYS[c.mechanicTurretArray]
  const mines = mechanicMineState(c)
  const deployed = Array.from({ length: mines.deployed }, (_, index) => c.mechanicDeployedMines?.[index] ?? {})
  const updateMines = (carried: number, next: MechanicMine[]) => save({
    mechanicMines: { carried, deployed: next.length }, mechanicDeployedMines: next,
  })
  return <div className="col">
    {c.subclass === 'Mine' && <>
      <strong>Mine exocortex</strong>
      <span>Mine capacity: {mines.capacity}; disable DC {classDc}</span>
      <span>Carried {mines.carried}/{mines.capacity}; deployed {mines.deployed}.</span>
      <div className="row">
        <button type="button" disabled={!mines.carried} onClick={() => updateMines(mines.carried - 1, [...deployed, {}])}>Deploy mine</button>
        <button type="button" disabled={!mines.deployed || mines.carried + mines.deployed > mines.capacity}
          onClick={() => updateMines(mines.carried + mines.deployed, [])}>Collect mines</button>
        <button type="button" disabled={mines.carried >= mines.capacity}
          onClick={() => updateMines(Math.min(mines.capacity, mines.carried + 2), deployed)}>Craft mines (10 minutes)</button>
        <button type="button" onClick={() => {
          const reset = () => save({ mechanicMines: { carried: mines.capacity, deployed: 0 },
            mechanicDeployedMines: [] })
          if (mines.deployed) confirmRemoval('deployed mines at daily preparations', reset)
          else reset()
        }}>Daily preparations</button>
      </div>
      {mines.deployed > 0 && mines.carried + mines.deployed > mines.capacity
        && <small role="status">Not enough carrying capacity to collect all deployed mines.</small>}
      {deployed.map((mine, index) => {
        const result = mechanicMineDamage(c, mine)
        const healing = mine.healing && activeFeatsNamed(c, 'Healing Mines').length > 0
        const dice = 2 + Math.floor((Math.max(1, c.level) - 1) / 2)
        const healingIntelligence = c.level >= 8 ? intelligence : 0
        const healingAmount = activeFeatsNamed(c, 'Impressive Healing Mines').length
          ? `${dice}d6${healingIntelligence ? signed(healingIntelligence) : ''}`
          : String(Math.max(0, dice + healingIntelligence))
        const medicMods = ['Numbing Analgesic', 'Powerful Stimulant', 'Protective Excretions', 'Restorative Boost'] as const
        const update = (patch: Partial<MechanicMine>) => updateMines(mines.carried,
          deployed.map((item, i) => i === index ? { ...item, ...patch } : item))
        return <div className="gear-card col" key={index}>
          <strong>Mine {index + 1}</strong>
          <label>Damage{' '}<select aria-label={`Mine ${index + 1} base damage`} value={mine.baseDamage ?? 'fire'} onChange={event => {
            if (event.target.value === 'fire' || event.target.value === 'piercing')
              update({ baseDamage: event.target.value, damageType: undefined })
          }}><option value="fire">Fire</option><option value="piercing">Piercing</option></select></label>
          <label><input type="checkbox" checked={!!mine.bigBoom} onChange={event => update({ bigBoom: event.target.checked })} /> Big Boom</label>
          <label><input type="checkbox" checked={!!mine.bunkerBuster} onChange={event => update({ bunkerBuster: event.target.checked })} /> Bunker Buster</label>
          <label><input type="checkbox" checked={!!mine.incapacitant} onChange={event => update({ incapacitant: event.target.checked })} /> Incapacitant</label>
          <label><input type="checkbox" checked={!!mine.smartMine} onChange={event => update({ smartMine: event.target.checked })} /> Smart Mine</label>
          {mine.smartMine && <div className="col"><small>Targets within 60 feet are excluded from all mines you detonate while this mod lasts.</small>
            {Array.from({ length: c.level >= 10 ? 6 : c.level >= 5 ? 3 : 1 }, (_, targetIndex) => <label key={targetIndex}>
              Protected target {targetIndex + 1}{' '}<input aria-label={`Mine ${index + 1} protected target ${targetIndex + 1}`}
                value={mine.smartTargets?.[targetIndex] ?? ''} onChange={event => {
                  const next = [...(mine.smartTargets ?? [])]
                  while (next.length <= targetIndex) next.push('')
                  next[targetIndex] = event.target.value
                  update({ smartTargets: next })
                }} />
            </label>)}
          </div>}
          <label><input type="checkbox" checked={!!mine.targeting} onChange={event => update({ targeting: event.target.checked })} /> Targeting Mine</label>
          {activeFeatsNamed(c, 'Healing Mines').length > 0 && <label>
            <input type="checkbox" checked={!!mine.healing} onChange={event => update({ healing: event.target.checked })} /> Healing Mines
          </label>}
          {healing && activeFeatsNamed(c, 'High-tech Medic').length > 0 && medicMods.map(mod => <label key={mod}>
            <input type="checkbox" checked={!!mine.medicMods?.includes(mod)} onChange={event => update({
              medicMods: event.target.checked ? [...(mine.medicMods ?? []), mod] : (mine.medicMods ?? []).filter(item => item !== mod),
            })} /> {mod}
          </label>)}
          {healing && mine.medicMods?.includes('Numbing Analgesic') && activeFeatsNamed(c, 'High-tech Medic').length > 0
            && <small>Reduce sickened by 1.</small>}
          {healing && mine.medicMods?.includes('Powerful Stimulant') && activeFeatsNamed(c, 'High-tech Medic').length > 0
            && <small>Reduce enfeebled or frightened by 1.</small>}
          {healing && mine.medicMods?.includes('Protective Excretions') && activeFeatsNamed(c, 'High-tech Medic').length > 0
            && <small>Attempt a DC 10 flat check to end one persistent damage type.</small>}
          {healing && mine.medicMods?.includes('Restorative Boost') && activeFeatsNamed(c, 'High-tech Medic').length > 0
            && <small>Fast healing equal to half the item's level, rounded up, for 3 rounds; determine the mine's item level with your GM.</small>}
          {activeFeatsNamed(c, 'Maneuvering Mines').length > 0 && <>
            <label><input type="checkbox" checked={!!mine.bigBang} onChange={event => update({ bigBang: event.target.checked })} /> Big Bang</label>
            <label><input type="checkbox" checked={!!mine.blackHole} onChange={event => update({ blackHole: event.target.checked })} /> Black Hole</label>
            {!healing && mine.bigBang && <small>Failed save: push 5 feet; critical failure: push 10 feet and knock prone.</small>}
            {!healing && mine.blackHole && <small>Failed save: pull 5 feet; critical failure: pull 10 feet and slowed 1.</small>}
          </>}
          <TransmutativeCasing c={c} value={mine.transmutativeCasing} onChange={value => update({ transmutativeCasing: value })} />
          <ExploitiveAssault c={c} value={mine.exploitiveAssault} onChange={value => update({ exploitiveAssault: value })} />
          <DebilitatingExocortex c={c} choices={mine.debilitation} onChange={choices => update({ debilitation: choices })} />
          {c.level >= 5 && <label>Damage versatility{' '}<select aria-label={`Mine ${index + 1} damage versatility`}
            value={mine.damageType && result.types.includes(mine.damageType) ? mine.damageType : ''} onChange={event => {
              const choice = result.types.find(type => type === event.target.value)
              if (!event.target.value || choice) update({ damageType: choice })
            }}>
            <option value="">Normal damage</option>
            {result.types.map(type => <option key={type}>{type}</option>)}
          </select></label>}
          <small>{healing ? `Heals ${healingAmount} HP; no save` : `${result.damage}${mine.incapacitant ? ' nonlethal' : ''}; basic Reflex DC ${classDc}`};
            {` ${result.radius}-foot burst.`} Detonate within 150 feet as one action or as a reaction when a creature enters or leaves the burst area.</small>
          {mine.bunkerBuster && <small>+5 damage to objects, structures, vehicles, and creatures with Hardness.</small>}
          <small>Turn mods off when they expire.</small>
          <button type="button" onClick={() => updateMines(mines.carried, deployed.filter((_, i) => i !== index))}>
            Detonate mine {index + 1}
          </button>
        </div>
      })}
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
      <DebilitatingExocortex c={c} choices={c.mechanicExocortexDebilitation}
        onChange={choices => save({ mechanicExocortexDebilitation: choices })} />
      <small>Manage turret grade, upgrades, and Strikes in Weapons.</small>
    </>}
    {c.subclass === 'Drone' && <small>Manage your drone and its customizations in Minions.</small>}
    {c.level >= 9 && <small>Remote Mods: Modify your exocortex and its weapons within {c.level >= 15 ? 150 : 60} feet.</small>}
    {c.level >= 13 && <div className="col"><strong>Enduring Mod</strong>
      <small>During daily preparations, Modify one item; that mod lasts 24 hours. Apply its effect using the item's controls.</small>
      <label>Item{' '}<input aria-label="Enduring mod item" value={c.mechanicEnduringMod?.item ?? ''} onChange={event => save({
        mechanicEnduringMod: { item: event.target.value, mod: c.mechanicEnduringMod?.mod ?? '' },
      })} /></label>
      <label>Mod{' '}<input aria-label="Enduring mod name" value={c.mechanicEnduringMod?.mod ?? ''} onChange={event => save({
        mechanicEnduringMod: { item: c.mechanicEnduringMod?.item ?? '', mod: event.target.value },
      })} /></label>
    </div>}
    {c.level >= 15 && <small>Manifold Mods: apply two mods whenever you Modify an item.</small>}
    {c.level >= 19 && <small>Instant Mods: once per round, Modify as a free action.</small>}
    <small><a href="https://2e.aonsrd.com/actions/546-modify" target="_blank" rel="noreferrer">Modify rules</a>:
      use item and exocortex controls for mods; track expiration and Troubleshoot manually.</small>
  </div>
}
