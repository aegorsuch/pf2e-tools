import { abilityMod, activeFeatsNamed, mechanicExocortexes, proficiencyBonus, signed, type SectionProps } from './builder'
import { confirmRemoval } from './confirmRemoval'
import { EXTRA_TURRET_NAMES, turretArray, turretArrays } from './mechanicTurret'
import { mechanicClassDC } from './mechanicRules'
import { TransmutativeCasing } from './TransmutativeCasing'
import { DebilitatingExocortex } from './DebilitatingExocortex'
import { ExploitiveAssault } from './ExploitiveAssault'
import { enduringMineMods, setEnduringMod } from './mechanicEnduring'
import { ItemTroubleshoot } from './ItemTroubleshoot'
import type { Character, MechanicMine } from './types'
import { boostingTheBasics } from './mechanicMods'
import { TurretWeapon } from './GearSection'
import { DamageRoll } from './SpellDamage'

const MEDIC_MINE_MODS = ['Numbing Analgesic', 'Powerful Stimulant', 'Protective Excretions', 'Restorative Boost'] as const

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
    radius: (c.level >= 15 ? 20 : c.level >= 10 ? 15 : 10) + (mine.bigBoom ? boostingTheBasics(c) ? 10 : 5 : 0),
    damageType,
    types,
  }
}

export function TurretFeatures({ c, entries, save }: SectionProps) {
  if (!c.systems.includes('sf2e') || !mechanicExocortexes(c).includes('Turret')) return null
  const intelligence = abilityMod(c.abilities.int)
  const classDc = mechanicClassDC(c)
  const rank = c.level >= 15 ? 3 : c.level >= 10 ? 2 : 1
  const maxHp = 10 + (2 + intelligence) * c.level
  const array = turretArray(c)
  const choices = c.mechanicTurretExtraArrays ?? []
  const expansive = c.feats.filter(feat => feat.name === 'Expansive Array')
  const activeExpansive = new Set(activeFeatsNamed(c, 'Expansive Array'))
  const dice = 2 + Math.floor(Math.max(0, c.level - 4) / 4)
  return <div className="col">
    {expansive.flatMap((feat, featIndex) => activeExpansive.has(feat) && !feat.choice
      ? [featIndex * 2, featIndex * 2 + 1] : []).map(index => <label key={index}>Expansive Array {index + 1}{' '}
      <select aria-label={`Expansive Array ${index + 1}`} value={choices[index] ?? ''} onChange={event => {
        const selected = EXTRA_TURRET_NAMES.find(name => name === event.target.value)
        if (event.target.value && (!selected || turretArrays(c).some(name => name === selected && choices[index] !== selected))) return
        const next = [...choices]
        next[index] = selected ?? null
        save({ mechanicTurretExtraArrays: next })
      }}>
        <option value="">Choose array</option>
        {EXTRA_TURRET_NAMES.map(name => <option key={name} value={name}
          disabled={turretArrays(c).includes(name) && choices[index] !== name}>{name}</option>)}
      </select>
    </label>)}
    <label>Turret array{' '}
      <select aria-label="Turret array" value={c.mechanicTurretArray ?? ''} onChange={event => {
        const selected = turretArrays(c).find(name => name === event.target.value)
        if (!event.target.value || selected) save({ mechanicTurretArray: selected })
      }}>
        <option value="">Choose array</option>
        {c.mechanicTurretArray && !turretArrays(c).includes(c.mechanicTurretArray)
          && <option value={c.mechanicTurretArray} disabled>{c.mechanicTurretArray} (unavailable)</option>}
        {turretArrays(c).map(name => <option key={name}>{name}</option>)}
      </select>
    </label>
    {array && <span>Turret array: {array.damage}; range {array.range} feet; {array.trait}, {array.group}.</span>}
    {activeFeatsNamed(c, 'Shielded Turret').length > 0 && <span>Shielded Turret: provides standard cover; Take Cover for greater cover.</span>}
    <span>AC {classDc}; HP {maxHp}; broken {Math.floor(maxHp / 2)}; hardness {5 + 5 * Math.min(3, Math.floor(c.level / 5))};
      Fortitude and Reflex {signed(intelligence + proficiencyBonus(rank, c.level))}.</span>
    <DebilitatingExocortex c={c} choices={c.mechanicExocortexDebilitation}
      onChange={choices => save({ mechanicExocortexDebilitation: choices,
        ...(!choices.some(Boolean) && c.mechanicEnduringMod?.kind === 'exo' ? { mechanicEnduringMod: undefined } : {}) })}
      enduring={{ active: c.mechanicEnduringMod?.kind === 'exo', onChange: active => save(setEnduringMod(c, active
        ? { kind: 'exo', item: 'mechanic:exo', mod: 'debilitation', value: c.mechanicExocortexDebilitation ?? [], label: 'Turret' }
        : undefined)) }} />
    <TurretWeapon c={c} entries={entries} save={save} displayOnly={false} />
    {activeFeatsNamed(c, 'Self-destruct').length > 0 && <span>Self-destruct{' '}
      <DamageRoll name="Self-destruct" actions="Two Actions" toggleResult damage={{ label: 'Damage',
        dice, sides: 6, type: 'piercing', additional: { label: 'Fire damage', dice, sides: 6, type: 'fire' } }} />
      {' '}15-foot emanation; basic Reflex DC {classDc}. Turret must be deployed within 150 feet; it is reduced to 0 HP and recalled.
    </span>}
  </div>
}

export function MechanicFeatures({ c, save }: Pick<SectionProps, 'c' | 'save'>) {
  if (c.className !== 'Mechanic' || !c.systems.includes('sf2e')) return null
  const intelligence = abilityMod(c.abilities.int)
  const classDc = mechanicClassDC(c)
  const mines = mechanicMineState(c)
  const deployed = Array.from({ length: mines.deployed }, (_, index) => c.mechanicDeployedMines?.[index] ?? {})
  const carried = c.mechanicCarriedMines ?? []
  const reserved = c.mechanicEnduringMod?.kind === 'mine' && c.mechanicEnduringMine && mines.carried > 0
    ? c.mechanicEnduringMine : undefined
  const canEndureMineMod = (mod: string) => (['damageType', 'transmutativeCasing', 'exploitiveAssault', 'debilitation', 'medicMods'].includes(mod)
    || enduringMineMods.some(value => value === mod))
    && (mod !== 'healing' || activeFeatsNamed(c, 'Healing Mines').length > 0)
    && (!['bigBang', 'blackHole'].includes(mod) || activeFeatsNamed(c, 'Maneuvering Mines').length > 0)
    && (mod !== 'transmutativeCasing' || activeFeatsNamed(c, 'Transmutative Casing').length > 0)
    && (mod !== 'exploitiveAssault' || activeFeatsNamed(c, 'Exploitive Assault').length > 0)
    && (mod !== 'debilitation' || activeFeatsNamed(c, 'Debilitating Exocortex').length > 0)
    && (mod !== 'medicMods' || activeFeatsNamed(c, 'Healing Mines').length > 0 && activeFeatsNamed(c, 'High-tech Medic').length > 0)
  const reservedValue = reserved ? c.mechanicEnduringMod?.mod === 'damageType' && reserved.damageType
    ? `damageType:${reserved.damageType}` : c.mechanicEnduringMod?.mod === 'medicMods'
      && typeof c.mechanicEnduringMod.value === 'string' ? `medic:${c.mechanicEnduringMod.value}`
      : c.mechanicEnduringMod?.mod ?? '' : ''
  const updateMines = (carried: number, next: MechanicMine[], extra?: Partial<Character>) => save({
    mechanicMines: { carried, deployed: next.length }, mechanicDeployedMines: next, ...extra,
  })
  return <div className="col">
    {mechanicExocortexes(c).includes('Mine') && <>
      <strong>Mine exocortex</strong>
      <span>Mine capacity: {mines.capacity}; disable DC {classDc}</span>
      <span>Carried {mines.carried}/{mines.capacity}; deployed {mines.deployed}.</span>
      <div className="row">
        <button type="button" disabled={mines.carried <= Number(!!reserved)} onClick={() =>
          updateMines(mines.carried - 1, [...deployed, carried[0] ?? {}], { mechanicCarriedMines: carried.slice(1) })}>Deploy mine</button>
        {reserved && <button type="button" disabled={c.level < 13 || !canEndureMineMod(c.mechanicEnduringMod?.mod ?? '')}
          onClick={() => updateMines(mines.carried - 1, [...deployed, reserved],
          { mechanicEnduringMine: undefined })}>Deploy enduring mine</button>}
        {reserved && c.level < 13 && <button type="button" onClick={() => save(setEnduringMod(c))}>End unavailable enduring mod</button>}
        <button type="button" disabled={!mines.deployed || mines.carried + mines.deployed > mines.capacity}
          onClick={() => updateMines(mines.carried + mines.deployed, [], {
            mechanicEnduringMine: deployed.find(mine => mine.enduring) ?? c.mechanicEnduringMine,
            mechanicCarriedMines: [...carried, ...deployed.filter(mine => !mine.enduring)],
          })}>Collect mines</button>
        <button type="button" disabled={mines.carried >= mines.capacity}
          onClick={() => updateMines(Math.min(mines.capacity, mines.carried + 2), deployed)}>Craft mines (10 minutes)</button>
        <button type="button" onClick={() => {
          const reset = () => {
            const glitching = { ...c.mechanicGlitching }
            for (const mine of [...carried, ...deployed, ...(c.mechanicEnduringMine ? [c.mechanicEnduringMine] : [])])
              if (mine.id) delete glitching[`mine:${mine.id}`]
            save({ ...(c.mechanicEnduringMod?.kind === 'mine' ? setEnduringMod(c) : {}),
              mechanicEnduringMine: undefined, mechanicCarriedMines: [], mechanicGlitching: glitching,
              mechanicMines: { carried: mines.capacity, deployed: 0 }, mechanicDeployedMines: [] })
          }
          if (mines.deployed) confirmRemoval('deployed mines at daily preparations', reset)
          else reset()
        }}>Daily preparations</button>
      </div>
      {mines.deployed > 0 && mines.carried + mines.deployed > mines.capacity
        && <small role="status">Not enough carrying capacity to collect all deployed mines.</small>}
      {c.level >= 13 && <label>Enduring mine mod{' '}<select aria-label="Enduring mine mod"
        disabled={!mines.carried || deployed.some(mine => mine.enduring)}
        value={reservedValue}
        onChange={event => {
          const mod = enduringMineMods.find(value => value === event.target.value)
          const type = (['acid', 'cold', 'electricity', 'fire', 'sonic', 'bludgeoning', 'piercing', 'slashing'] as const)
            .find(value => `damageType:${value}` === event.target.value)
          const medic = MEDIC_MINE_MODS.find(value => `medic:${value}` === event.target.value)
          if (mod && canEndureMineMod(mod) && mines.carried > 0 && !deployed.some(mine => mine.enduring))
            save(setEnduringMod(c, { kind: 'mine', item: 'mechanic:mine', mod, label: 'Mine' }))
          else if (type && mines.carried > 0 && !deployed.some(mine => mine.enduring))
            save(setEnduringMod(c, { kind: 'mine', item: 'mechanic:mine', mod: 'damageType', value: type, label: 'Mine' }))
          else if (medic && canEndureMineMod('medicMods') && mines.carried > 0 && !deployed.some(mine => mine.enduring))
            save(setEnduringMod(c, { kind: 'mine', item: 'mechanic:mine', mod: 'medicMods', value: medic, label: 'Mine' }))
          else if (!event.target.value && reserved) save(setEnduringMod(c))
        }}>
        <option value="">Not enduring</option>
        {reserved && !canEndureMineMod(c.mechanicEnduringMod?.mod ?? '')
          && <option value={reservedValue} disabled>Unavailable mod</option>}
        {reserved && ['transmutativeCasing', 'exploitiveAssault', 'debilitation'].includes(c.mechanicEnduringMod?.mod ?? '')
          && canEndureMineMod(c.mechanicEnduringMod?.mod ?? '')
          && <option value={c.mechanicEnduringMod?.mod} disabled>Configured below</option>}
        <option value="bigBoom">Big Boom</option>
        <option value="bunkerBuster">Bunker Buster</option>
        <option value="incapacitant">Incapacitant</option>
        <option value="smartMine">Smart Mine</option>
        <option value="targeting">Targeting Mine</option>
        {(['acid', 'cold', 'electricity', 'fire', 'sonic', 'bludgeoning', 'piercing', 'slashing'] as const)
          .map(type => <option value={`damageType:${type}`} key={type}>Damage Versatility ({type})</option>)}
        {activeFeatsNamed(c, 'Healing Mines').length > 0 && <option value="healing">Healing Mines</option>}
        {activeFeatsNamed(c, 'Maneuvering Mines').length > 0 && <>
          <option value="bigBang">Big Bang</option><option value="blackHole">Black Hole</option>
        </>}
        {canEndureMineMod('medicMods') && MEDIC_MINE_MODS.map(mod =>
          <option value={`medic:${mod}`} key={mod}>{mod} (healing mine)</option>)}
      </select></label>}
      {c.level >= 13 && mines.carried > 0 && !deployed.some(mine => mine.enduring)
        && ['Transmutative Casing', 'Exploitive Assault', 'Debilitating Exocortex'].some(name => activeFeatsNamed(c, name).length > 0)
        && <div className="col"><strong>Enduring mine feat mods</strong>
        <small>Choosing one replaces your previous enduring mod.</small>
        <TransmutativeCasing c={c} value={reserved?.transmutativeCasing} onChange={value => {
          if (value) save(setEnduringMod(c, { kind: 'mine', item: 'mechanic:mine', mod: 'transmutativeCasing', value, label: 'Mine' }))
          else if (c.mechanicEnduringMod?.kind === 'mine' && c.mechanicEnduringMod.mod === 'transmutativeCasing') save(setEnduringMod(c))
        }} />
        <ExploitiveAssault c={c} value={reserved?.exploitiveAssault} onChange={value => {
          if (value) save(setEnduringMod(c, { kind: 'mine', item: 'mechanic:mine', mod: 'exploitiveAssault', value, label: 'Mine' }))
          else if (c.mechanicEnduringMod?.kind === 'mine' && c.mechanicEnduringMod.mod === 'exploitiveAssault') save(setEnduringMod(c))
        }} />
        <DebilitatingExocortex c={c} choices={reserved?.debilitation} onChange={value => {
          if (value.some(Boolean)) save(setEnduringMod(c, { kind: 'mine', item: 'mechanic:mine', mod: 'debilitation', value, label: 'Mine' }))
          else if (c.mechanicEnduringMod?.kind === 'mine' && c.mechanicEnduringMod.mod === 'debilitation') save(setEnduringMod(c))
        }} />
      </div>}
      {deployed.map((mine, index) => {
        const result = mechanicMineDamage(c, mine)
        const healing = mine.healing && activeFeatsNamed(c, 'Healing Mines').length > 0
        const dice = 2 + Math.floor((Math.max(1, c.level) - 1) / 2)
        const healingIntelligence = c.level >= 8 ? intelligence : 0
        const healingAmount = activeFeatsNamed(c, 'Impressive Healing Mines').length
          ? `${dice}d6${healingIntelligence ? signed(healingIntelligence) : ''}`
          : String(Math.max(0, dice + healingIntelligence))
        const update = (patch: Partial<MechanicMine>) => {
          const selected = enduringMineMods.find(mod => mod === c.mechanicEnduringMod?.mod)
          const ending = mine.enduring && c.mechanicEnduringMod?.kind === 'mine'
            && (selected && patch[selected] === false
              || c.mechanicEnduringMod.mod === 'damageType' && 'damageType' in patch && patch.damageType === undefined
              || c.mechanicEnduringMod.mod === 'transmutativeCasing' && 'transmutativeCasing' in patch && patch.transmutativeCasing === undefined
              || c.mechanicEnduringMod.mod === 'exploitiveAssault' && 'exploitiveAssault' in patch && patch.exploitiveAssault === undefined
              || c.mechanicEnduringMod.mod === 'debilitation' && 'debilitation' in patch && !patch.debilitation?.some(Boolean)
              || c.mechanicEnduringMod.mod === 'medicMods' && 'medicMods' in patch
                && !patch.medicMods?.some(value => value === c.mechanicEnduringMod?.value))
          updateMines(mines.carried, deployed.map((item, i) => i === index
            ? { ...item, ...patch, ...(ending ? { enduring: false } : {}) } : item),
          ending ? { mechanicEnduringMod: undefined } : undefined)
        }
        return <div className="gear-card col" key={index}>
          <strong>Mine {index + 1}{mine.enduring ? ' (enduring)' : ''}</strong>
          <ItemTroubleshoot c={c} save={save} kind="mine" id={mine.id} label={`Mine ${index + 1}`}
            attach={id => ({ mechanicDeployedMines: deployed.map((item, i) => i === index ? { ...item, id } : item) })} />
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
          {mine.enduring && c.mechanicEnduringMod?.kind === 'mine' && c.mechanicEnduringMod.mod === 'medicMods' && !healing
            && <small>Apply Healing Mines separately before using the enduring medical mod.</small>}
          {healing && activeFeatsNamed(c, 'High-tech Medic').length > 0 && MEDIC_MINE_MODS.map(mod => <label key={mod}>
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
            {` ${result.radius}-foot burst.`}{activeFeatsNamed(c, 'Apocalyptic Explosions').length > 0 && ' Apocalyptic Explosions doubles the area.'}
            {' '}Detonate within 150 feet as one action or as a reaction when a creature enters or leaves the burst area.</small>
          {!healing && activeFeatsNamed(c, 'Critical Explosion').length > 0 && <small>
            Critical Explosion: on a failed save, 1 persistent {['bludgeoning', 'piercing', 'slashing'].includes(result.damageType)
              ? 'bleed' : result.damageType} damage; on a critical failure, {Math.max(0, intelligence)} persistent damage instead.
          </small>}
          {mine.bunkerBuster && <small>+{boostingTheBasics(c) ? 10 : 5} damage to objects, structures, vehicles, and creatures with Hardness.</small>}
          {!healing && mine.incapacitant && boostingTheBasics(c) && <small>Creatures critically failing their save become frightened 1.</small>}
          <button type="button" onClick={() => {
            const glitching = { ...c.mechanicGlitching }
            if (mine.id) delete glitching[`mine:${mine.id}`]
            updateMines(mines.carried, deployed.filter((_, i) => i !== index), { mechanicGlitching: glitching,
              ...(mine.enduring && c.mechanicEnduringMod?.kind === 'mine' ? { mechanicEnduringMod: undefined } : {}) })
          }}>
            Detonate mine {index + 1}
          </button>
        </div>
      })}
      <small>Deploy to an unoccupied square within 60 feet. Create two mines per 10 minutes; unused mines expire at daily preparations.</small>
    </>}
    {c.level >= 9 && <small>Remote Mods: Modify your exocortex and its weapons within {c.level >= 15 ? 150 : 60} feet.</small>}
    {c.level >= 13 && <div className="col"><strong>Enduring Mod</strong>
      {c.mechanicEnduringMod?.kind ? <>
        <span>Enduring item: {c.mechanicEnduringMod.label ?? c.mechanicEnduringMod.item}
          {' '}({c.mechanicEnduringMod.mod.replace(/([a-z])([A-Z])/g, '$1 $2')}).</span>
        <button type="button" onClick={() => save(setEnduringMod(c))}>End enduring mod</button>
      </> : <>
        <label>Item{' '}<input aria-label="Enduring mod item" value={c.mechanicEnduringMod?.item ?? ''} onChange={event => save({
          mechanicEnduringMod: { item: event.target.value, mod: c.mechanicEnduringMod?.mod ?? '' },
        })} /></label>
        <label>Mod{' '}<input aria-label="Enduring mod name" value={c.mechanicEnduringMod?.mod ?? ''} onChange={event => save({
          mechanicEnduringMod: { item: c.mechanicEnduringMod?.item ?? '', mod: event.target.value },
        })} /></label>
      </>}
    </div>}
    {c.level >= 15 && <small>Manifold Mods: apply two mods whenever you Modify an item.</small>}
    {c.level >= 19 && <small>Instant Mods: once per round, Modify as a free action.</small>}
    <a href="https://2e.aonsrd.com/actions/546-modify" target="_blank" rel="noreferrer">Modify rules</a>
  </div>
}
