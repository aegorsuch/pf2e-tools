import { weaponCategory, weaponHands, signed, type SectionProps } from './builder'
import { confirmRemoval } from './confirmRemoval'
import { newId } from './db'
import { droneEquipmentCapacity, droneMountedWeapons, droneWeaponAttack } from './droneEquipmentRules'
import { EntryDescription } from './EntryDescription'
import { mechanicDamageSummary, MechanicWeaponMods, upgradeDamageSummary, WeaponUpgrades } from './GearSection'
import { SearchableSelect } from './SearchableSelect'
import { clearItemGlitching, setEnduringMod } from './mechanicEnduring'
import type { OwnedWeapon } from './types'

export function DroneEquipment({ c, entries, save }: SectionProps) {
  const capacity = droneEquipmentCapacity(c)
  const mounted = droneMountedWeapons(c, entries)
  const used = mounted.filter(item => item.active && !item.held).reduce((sum, item) => sum + (item.hands ?? 0), 0)
  const handsUsed = mounted.filter(item => item.active && item.held).reduce((sum, item) => sum + (item.hands ?? 0), 0)
  const weapons = c.mechanicDroneWeapons ?? []
  const available = (remaining: number) => entries.filter(entry => entry.kind === 'weapon' && !entry.deleted && entry.systems.includes('sf2e')
    && weaponCategory(entry) !== 'Unarmed'
    && (() => {
      const hands = weaponHands(entries, { id: '', name: entry.name, potency: 0, striking: 0, runes: [] })
      return !!hands && hands <= remaining
    })()).sort((a, b) => a.name.localeCompare(b.name) || a.level - b.level)
  const update = (id: string, patch: Partial<OwnedWeapon>) => save({
    mechanicDroneWeapons: weapons.map(weapon => weapon.id === id ? { ...weapon, ...patch } : weapon),
  })
  const armor = c.mechanicDroneArmorUpgrades ?? []
  const armorCatalog = entries.filter(entry => entry.kind === 'item' && !entry.deleted && entry.systems.includes('sf2e')
    && entry.data.item_subcategory === 'Armor Upgrades')
  const armorOptions = armorCatalog.filter(entry => !armor.some(id => {
    const installed = armorCatalog.find(item => item.id === id)
    return installed && (installed.id === entry.id || installed.data.url && installed.data.url === entry.data.url)
  })).sort((a, b) => a.name.localeCompare(b.name) || a.level - b.level)
  return <div className="col">
    <strong>Drone equipment</strong>
    <small>Weapon mounts: {used}/{capacity.mounts}. Mounted weapons do not use your hands.</small>
    {capacity.hands > 0 && <small>Drone hands used: {handsUsed}/{capacity.hands}.</small>}
    {mounted.map(({ weapon, entry, hands, active, held }) => {
      const attack = active ? droneWeaponAttack(c, entries, weapon) : undefined
      return <div className="gear-card col" key={weapon.id}>
        <strong>{weapon.name} ({held ? 'held' : 'mounted'})</strong>
        {!active && <small role="status">{!entry || !hands ? 'Weapon or hand requirement unavailable.'
          : held ? 'Insufficient drone hands; this weapon is inactive.' : 'Insufficient weapon mounts; this weapon is inactive.'}</small>}
        {attack && <small>Attack {signed(attack.attack)}; damage {attack.damage}
          {[...upgradeDamageSummary(attack), ...mechanicDamageSummary(c, weapon, attack)].map(upgrade => ` + ${upgrade.value}`)}
          {attack.range > 0 ? `; range ${attack.range} feet` : ''}.
          {attack.rank === 0 && ' Untrained in advanced weapons.'}</small>}
        {attack && <small>{attack.traits.join(', ')}.</small>}
        {attack && <MechanicWeaponMods c={c} weapon={weapon} attack={attack} save={save} />}
        {entry && <WeaponUpgrades entries={entries} weapon={entry} upgrades={weapon.upgrades ?? []}
          limit={typeof entry.data.upgrade_slots === 'number' ? entry.data.upgrade_slots : undefined}
          onChange={upgrades => update(weapon.id, { upgrades })} />}
        <button type="button" onClick={() => confirmRemoval(`mounted weapon "${weapon.name}"`,
          () => save({ mechanicDroneWeapons: weapons.filter(item => item.id !== weapon.id),
            mechanicDroneHeldWeaponIds: (c.mechanicDroneHeldWeaponIds ?? []).filter(id => id !== weapon.id),
            ...(c.mechanicEnduringMod?.kind === 'weapon' && c.mechanicEnduringMod.item === weapon.id ? setEnduringMod(c) : {}),
            ...clearItemGlitching(c, 'weapon', weapon.id) }))}>Remove {held ? 'held' : 'mounted'} weapon</button>
      </div>
    })}
    {([false, true] as const).map(held => {
      const options = available(held ? capacity.hands - handsUsed : capacity.mounts - used)
      return options.length > 0 && <SearchableSelect key={String(held)}
        aria-label={`Add drone ${held ? 'held' : 'mounted'} weapon`} value="" onChange={event => {
          const entry = options.find(item => item.id === event.target.value)
          if (entry) {
            const id = newId()
            save({ mechanicDroneWeapons: [...weapons, { id, name: entry.name, potency: 0, striking: 0, runes: [] }],
              ...(held ? { mechanicDroneHeldWeaponIds: [...(c.mechanicDroneHeldWeaponIds ?? []), id] } : {}) })
          }
        }}>
        <option value="">Add {held ? 'held' : 'mounted'} weapon...</option>
        {options.map(entry => <option value={entry.id} key={entry.id}>{entry.name} (Level {entry.level})</option>)}
      </SearchableSelect>
    })}
    <small>Armor upgrade slots: {armor.length}/{capacity.armorUpgrades}.</small>
    {armor.map((id, index) => {
      const entry = armorCatalog.find(item => item.id === id)
      return <div className="row" key={`${id}:${index}`}>
        <EntryDescription name={entry?.name ?? id} entry={entry} />
        {index >= capacity.armorUpgrades && <small role="status">Inactive: no upgrade slot.</small>}
        {entry && index < capacity.armorUpgrades && /^Energy Shielding(?: \((?:Commercial|Tactical|Advanced)\))?$/.test(entry.name)
          && <label>Shielded energy{' '}<select aria-label="Drone Energy Shielding type"
            value={c.mechanicDroneEnergyShielding?.[id] ?? ''} onChange={event => {
              const choice = (['acid', 'cold', 'electricity', 'fire'] as const).find(type => type === event.target.value)
              const next = { ...c.mechanicDroneEnergyShielding }
              if (choice) next[id] = choice
              else if (!event.target.value) delete next[id]
              else return
              save({ mechanicDroneEnergyShielding: next })
            }}>
            <option value="">Choose energy</option>
            {['acid', 'cold', 'electricity', 'fire'].map(type => <option key={type}>{type}</option>)}
          </select></label>}
        <button type="button" onClick={() => confirmRemoval(`drone armor upgrade "${entry?.name ?? id}"`,
          () => save({ mechanicDroneArmorUpgrades: armor.filter((_, i) => i !== index) }))}>Remove upgrade</button>
      </div>
    })}
    {capacity.armorUpgrades > armor.length && armorOptions.length > 0 && <SearchableSelect
      aria-label="Add drone armor upgrade" value="" onChange={event => {
        if (armorOptions.some(item => item.id === event.target.value)) save({ mechanicDroneArmorUpgrades: [...armor, event.target.value] })
      }}>
      <option value="">Add armor upgrade...</option>
      {armorOptions.map(entry => <option value={entry.id} key={entry.id}>{entry.name} (Level {entry.level})</option>)}
    </SearchableSelect>}
    <small>Check installed upgrade descriptions for effects not reflected in drone statistics.</small>
  </div>
}
