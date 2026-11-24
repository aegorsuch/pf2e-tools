import { activeFeatsNamed, activeStance, activeUntamedShiftEffects, armorEntry, armorProficiencyRank, boneShieldActive, conditionValue, equippedShield, featEffectChange, hasHuntPrey, hasParryWeapon, isBucklerShield, isFeatEffectActive, isSpellActive, knowsSpell, ownedArmors, parryValue, selectedFeatEntry, shieldAcBonus, shieldParagonActive, shieldRaised, shieldRaisedChange, spellActiveChange, twinnedDefenseActive, warriorLegendWeakness, wornArmor, type SectionProps } from './builder'
import { grantedFeatSpells } from './featSpells'
import { FavoredTerrainSelector, HardenFleshToggle, RageToggle } from './SkillsSection'
import { StancesContent } from './StancesSection'
import { ActiveSpellActions, automatedSpellStatusControls, ProtectCompanionOptions, SpellEffectActions, ZealousConvictionToggle } from './SpellsSection'
import { EntryDescription } from './EntryDescription'
import { SimplePoisons } from './GearSection'
import { isAncestralEmbrace, isBastionNamedArmor, isIncendiaryArmor, isMountainArmor, mountainPoisonImmunities } from './namedArmor'
import { DamageRoll } from './SpellDamage'
import { ANCESTRAL_AVATAR } from './battleForms'
import { FULMINATING_SHOT_ELEMENTS, fulminatingShotBonus } from './fulminatingShot'
import { confirmRemoval } from './confirmRemoval'
import { PURIFY_AIR_DESCRIPTION, purifyAirActive, purifyAirAvailable } from './familiarAbilities'
import type { ContentEntry } from './types'

const canDeviseAStratagem = (c: SectionProps['c']) => c.systems.includes('pf2e') && c.className === 'Investigator'

const HUNT_PREY: ContentEntry = {
  id: 'action:hunt-prey', systems: ['pf2e'], kind: 'classFeature', source: 'official', name: 'Hunt Prey',
  level: 1, traits: ['Concentrate'], effects: [], updatedAt: 0,
  description: 'Choose one creature you can see or hear, or are tracking during exploration, as your prey. '
    + 'Gain a +2 circumstance bonus to Perception checks to Seek it and Survival checks to Track it. '
    + 'Ignore the ranged attack penalty in the second range increment against it. '
    + 'You can designate only one prey at a time; choosing another replaces it. The designation lasts until your next daily preparations.',
  data: { url: 'https://2e.aonprd.com/Actions.aspx?ID=2257' },
}

const PARRY: ContentEntry = {
  id: 'trait:parry', systems: ['pf2e'], kind: 'trait', source: 'official', name: 'Parry',
  level: 0, traits: [], effects: [], updatedAt: 0,
  description: 'While wielding a parry weapon with trained or better proficiency, spend one action to gain a +1 circumstance bonus to AC until the start of your next turn.',
  data: { url: 'https://2e.aonprd.com/Traits.aspx?ID=667' },
}

const FAVORED_TERRAIN: ContentEntry = {
  id: 'feat:favored-terrain', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Favored Terrain',
  level: 2, traits: ['Ranger'], effects: [], updatedAt: 0,
  description: 'Choose a favored terrain. Ignore non-magical difficult terrain there; Unimpeded Journey grants an additional benefit based on the terrain.',
  data: {},
}

const LIVING_FLAME: ContentEntry = {
  id: 'armor:living-flame', systems: ['pf2e'], kind: 'item', source: 'official', name: 'Living Flame',
  level: 20, traits: ['Aura', 'Concentrate', 'Fire'], effects: [], updatedAt: 0,
  description: 'Once per day, engulf yourself in living fire for 10 minutes in a 15-foot emanation. Creatures entering the aura or starting their turn in it take 10d6 fire damage (DC 40 basic Reflex save). The area is difficult terrain for other creatures.',
  data: { actions: 'Two Actions', url: 'https://2e.aonprd.com/Equipment.aspx?ID=3814' },
}

function entrenchMeleeActive(c: SectionProps['c'], entries: SectionProps['entries']) {
  return ownedArmors(c, entries).some(armor => {
    if (!isBastionNamedArmor(armor.name) || !armor.entrenchMeleeActive || !armor.worn || armor.inheritorCloakRed) return false
    const entry = armorEntry(c, entries, armor.name, armor.id)
    return !!entry && armorProficiencyRank(c, entries, entry) > 0
  })
}

function defenseToggles(c: SectionProps['c'], entries: SectionProps['entries']) {
  const shield = equippedShield(c)
  const parry = parryValue(c, entries)
  const boneShield = boneShieldActive(c)
  return {
    shield, parry, boneShield,
    shieldLabel: shield?.id === 'granted-shield:chitinous' ? 'Raise Chitinous Shield'
      : shield && isBucklerShield(shield.name) ? 'Raise Buckler' : 'Raise Shield',
    cantrip: knowsSpell(c, entries, 'Shield'),
    parryWeapon: hasParryWeapon(c, entries),
    stanceParry: twinnedDefenseActive(c, entries),
  }
}

export function StatusesSummary({ c, entries }: SectionProps) {
  const defense = defenseToggles(c, entries)
  const stance = activeStance(c, entries)
  const poisonTotal = Math.max(0, Math.floor(c.level))
  const poisonSpent = Math.max(0, Math.min(poisonTotal, Math.floor(c.simplePoisonsSpent ?? 0)))
  const active = [
    ...(canDeviseAStratagem(c) && c.deviseAStratagemActive ? ['Devise a Stratagem'] : []),
    ...(hasHuntPrey(c, entries) && c.huntPreyActive ? ['Hunt Prey'] : []),
    ...(c.raging ? ['Rage'] : []),
    ...(defense.shield && shieldRaised(c) ? [defense.shieldLabel] : []),
    ...(defense.boneShield ? (c.boneShieldRaised ? ['Raise Bone Shield'] : [])
      : defense.cantrip && isSpellActive(c, entries, 'Shield') ? ['Raise Shield Cantrip'] : []),
    ...(defense.parryWeapon && defense.parry > 0 && (c.parrying || defense.stanceParry) ? ['Parry'] : []),
    ...(stance ? [stance.name] : []),
    ...(activeFeatsNamed(c, 'Poison Weapon').length
      ? [`Poison Weapon ${poisonTotal - poisonSpent}/${poisonTotal}${c.poisonWeaponActive ? ' (active)' : ''}`] : []),
    ...(entrenchMeleeActive(c, entries) ? ['Entrench Melee'] : []),
    ...(mountainPoisonImmunities(c).length ? ['Poison Immunity'] : []),
    ...((c.armors ?? []).some(armor => isIncendiaryArmor(armor.name) && armor.livingFlameActive) ? ['Living Flame'] : []),
    ...(fulminatingShotBonus(c) ? [`Fulminating Shot (${fulminatingShotBonus(c)})`] : []),
    ...(purifyAirActive(c) ? ['Purify Air'] : []),
    ...(c.hardenFleshActive && activeFeatsNamed(c, 'Harden Flesh').length ? ['Harden Flesh'] : []),
    ...(c.activeSpells ?? []).flatMap(name => name === ANCESTRAL_AVATAR
      ? isAncestralEmbrace(wornArmor(c, entries)?.name) ? ['Avatar'] : []
      : [name]),
    ...(c.summonedUndead ? ['Summon Undead'] : []),
    ...(c.summonedFiend ? ['Summon Fiend'] : []),
    ...(c.systems.includes('sf2e') && activeFeatsNamed(c, 'Creature Ally').length
      && (c.ancestry === 'Vesk' && c.creatureAllyActive || c.ancestry === 'Shirren' && c.shirrenCreatureAllyActive
        || c.ancestry === 'Lashunta' && c.lashuntaCreatureAlly) ? ['Summon Animal'] : []),
    ...c.activeFeatEffects ?? [],
    ...(c.zealousConvictionRank !== undefined ? ['Zealous Conviction'] : []),
    ...(activeFeatsNamed(c, 'Favored Terrain').length && isFeatEffectActive(c, 'Favored Terrain') ? ['Favored Terrain'] : []),
    ...(['frightened', 'sickened', 'enfeebled'] as const).flatMap(name =>
      conditionValue(c, name) ? [`${name[0].toUpperCase() + name.slice(1)} ${conditionValue(c, name)}`] : []),
  ]
  return <summary className="character-section-summary"><strong>Statuses</strong>
    <span>{[...new Set(active)].sort((a, b) => a.localeCompare(b)).join(', ') || 'None active'}</span>
  </summary>
}

export function DeviseAStratagemToggle({ c, save, summary = false }: Pick<SectionProps, 'c' | 'save'> & { summary?: boolean }) {
  if (!canDeviseAStratagem(c)) return null
  const toggle = <label><input type="checkbox" aria-label="Devise a Stratagem active" checked={!!c.deviseAStratagemActive}
    onChange={event => save({ deviseAStratagemActive: event.target.checked })} /> Devise a Stratagem</label>
  return summary
    ? <span className="combat-summary-toggles" onClick={event => event.stopPropagation()}>{toggle}</span>
    : toggle
}

export function HuntPreyToggle({ c, entries, save, summary = false }: SectionProps & { summary?: boolean }) {
  if (!hasHuntPrey(c, entries)) return null
  const content = <><input type="checkbox" aria-label="Hunt Prey active" checked={!!c.huntPreyActive}
      onChange={event => save({ huntPreyActive: event.target.checked })} />{' '}
    <EntryDescription name="Hunt Prey" entry={HUNT_PREY} character={c} entries={entries} hideButtonActions />{' '}
    <ActiveSpellActions name="Hunt Prey" entry={HUNT_PREY} actions="Single Action">
      <label><input type="checkbox" aria-label="Hunt Prey active in options" checked={!!c.huntPreyActive}
        onChange={event => save({ huntPreyActive: event.target.checked })} /> Hunt Prey</label>
    </ActiveSpellActions></>
  return <span className={summary ? 'combat-summary-toggles' : undefined}
    onClick={summary ? event => event.stopPropagation() : undefined}>{content}</span>
}

export function StatusesContent({ c, entries, save }: SectionProps) {
  const defense = defenseToggles(c, entries)
  const grant = grantedFeatSpells(c, entries).find(spell => spell.source === 'Heroic Presence')
  const summonedUndead = c.summonedUndead
  const summonedFiend = c.summonedFiend
  const entrenchArmors = ownedArmors(c, entries).filter(armor => isBastionNamedArmor(armor.name))
  const mountainArmors = ownedArmors(c, entries).filter(armor => isMountainArmor(armor.name))
  const incendiaryArmors = ownedArmors(c, entries).filter(armor => isIncendiaryArmor(armor.name))
  const cursedWeakness = warriorLegendWeakness(c, entries)
  const ancestralAvatarAvailable = isAncestralEmbrace(wornArmor(c, entries)?.name)
  const avatarEntry = entries.find(entry => entry.kind === 'spell' && !entry.deleted && entry.name === 'Avatar'
    && entry.systems.some(system => c.systems.includes(system)))
  const ancestralAvatarActive = ancestralAvatarAvailable && !!c.activeSpells?.includes(ANCESTRAL_AVATAR)
  const spellControls = automatedSpellStatusControls({ c, entries, save })
  const untamedShift = knowsSpell(c, entries, 'Untamed Shift')
  const shiftEntry = entries.find(entry => entry.kind === 'spell' && !entry.deleted && entry.name === 'Untamed Shift'
    && entry.systems.some(system => c.systems.includes(system)))
  const shiftActive = isSpellActive(c, entries, 'Untamed Shift')
  const shiftCanRestore = untamedShift && !!c.untamedShiftEffects?.length
    && activeUntamedShiftEffects({ ...c, ...spellActiveChange(c, 'Untamed Shift', true) }, entries).length > 0
  const purifyAirEntry: ContentEntry = { id: 'leshy-secret:Purify Air', systems: c.systems, kind: 'familiar', source: 'official',
    name: 'Purify Air', level: 1, traits: [], description: PURIFY_AIR_DESCRIPTION, data: {}, effects: [], updatedAt: 0 }
  const heroicDefianceEntry = entries.find(entry => entry.kind === 'feat' && !entry.deleted
    && entry.name === 'Heroic Defiance' && entry.systems.some(system => c.systems.includes(system)))
  const zealousEntry = grant?.entry ?? entries.find(entry => entry.kind === 'spell' && !entry.deleted
    && entry.name === 'Zealous Conviction' && entry.systems.some(system => c.systems.includes(system)))
  const zealousRank = grant?.rank ?? c.zealousConvictionRank
  const parryEntry = entries.find(entry => entry.kind === 'trait' && !entry.deleted && entry.name === 'Parry'
    && entry.systems.some(system => c.systems.includes(system))) ?? PARRY
  const terrainEntry = selectedFeatEntry(c, entries, 'Favored Terrain') ?? FAVORED_TERRAIN
  const terrainActive = isFeatEffectActive(c, 'Favored Terrain')
  const terrainLocked = activeFeatsNamed(c, 'Terrain Master').length > 0
  const controls = [
    { name: 'Active stance', element: <StancesContent c={c} entries={entries} save={save} /> },
    ...(activeFeatsNamed(c, 'Heroic Defiance').length ? [{ name: 'Heroic Defiance', element: <>
      <input type="checkbox" aria-label="Heroic Defiance active" checked={isFeatEffectActive(c, 'Heroic Defiance')}
        onChange={event => save(featEffectChange(c, 'Heroic Defiance', event.target.checked))} />{' '}
      <EntryDescription name="Heroic Defiance" entry={heroicDefianceEntry} entries={entries} character={c} hideButtonActions />{' '}
      {heroicDefianceEntry && <ActiveSpellActions name="Heroic Defiance" entry={heroicDefianceEntry}>
        <label><input type="checkbox" aria-label="Heroic Defiance active in options" checked={isFeatEffectActive(c, 'Heroic Defiance')}
          onChange={event => save(featEffectChange(c, 'Heroic Defiance', event.target.checked))} /> Heroic Defiance</label>
      </ActiveSpellActions>}
    </> }] : []),
    ...(activeFeatsNamed(c, 'Poison Weapon').length
      ? [{ name: 'Poison Weapon', element: <SimplePoisons c={c} entries={entries} save={save} /> }] : []),
    ...(canDeviseAStratagem(c)
      ? [{ name: 'Devise a Stratagem', element: <DeviseAStratagemToggle c={c} save={save} /> }] : []),
    ...(hasHuntPrey(c, entries)
      ? [{ name: 'Hunt Prey', element: <HuntPreyToggle c={c} entries={entries} save={save} /> }] : []),
    ...(purifyAirAvailable(c) ? [{ name: 'Purify Air', element: <>
      <input type="checkbox" aria-label="Purify Air status" checked={purifyAirActive(c)}
        onChange={event => save({ familiar: { ...c.familiar, purifyAirActive: event.target.checked } })} />{' '}
      <EntryDescription name="Purify Air" entry={purifyAirEntry} entries={entries} character={c} />
    </> }] : []),
    ...(activeFeatsNamed(c, 'Harden Flesh').length
      ? [{ name: 'Harden Flesh', element: <HardenFleshToggle c={c} save={save} /> }] : []),
    ...(ancestralAvatarAvailable ? [{ name: 'Avatar', element: <>
      <input type="checkbox" aria-label="Avatar status" checked={ancestralAvatarActive}
        onChange={event => save(spellActiveChange(c, ANCESTRAL_AVATAR, event.target.checked))} />{' '}
      <EntryDescription name="Avatar" entry={avatarEntry} entries={entries} character={c} hideButtonActions />{' '}
      <ActiveSpellActions name="Avatar" entry={avatarEntry} actions="Two Actions">
        <label><input type="checkbox" aria-label="Avatar active" checked={ancestralAvatarActive}
          onChange={event => save(spellActiveChange(c, ANCESTRAL_AVATAR, event.target.checked))} /> Active</label>
      </ActiveSpellActions>
    </> }] : []),
    ...(untamedShift ? [{ name: 'Untamed Shift', element: <>
      <input type="checkbox" aria-label="Untamed Shift status" checked={shiftActive} disabled={!shiftActive && !shiftCanRestore}
        onChange={event => save(spellActiveChange(c, 'Untamed Shift', event.target.checked))} />{' '}
      <EntryDescription name="Untamed Shift" entry={shiftEntry} entries={entries} character={c} />{' '}
      <SpellEffectActions c={c} entries={entries} save={save} entry={shiftEntry} name="Untamed Shift" />
    </> }] : []),
    ...(entrenchArmors.length ? [{ name: 'Entrench Melee', element: <div>{entrenchArmors.map(armor => {
      const entry = armorEntry(c, entries, armor.name, armor.id)
      const disabled = !armor.worn || !entry || !armorProficiencyRank(c, entries, entry) || !!armor.inheritorCloakRed
      return <label key={armor.id}><input type="checkbox" aria-label={`Entrench Melee: ${armor.name} status`}
        checked={!!armor.entrenchMeleeActive} disabled={disabled}
        onChange={event => save({ armors: ownedArmors(c, entries).map(current => current.id === armor.id
          ? { ...current, entrenchMeleeActive: event.target.checked } : current) })} />
        {' '}Entrench Melee: {armor.name}</label>
    })}</div> }] : []),
    ...(mountainArmors.length ? [{ name: 'Poison Immunity', element: <div>{mountainArmors.map(armor => {
      const active = !!armor.mountainPoisonImmunityActive
      const update = (patch: Partial<typeof armor>) => save({ armors: (c.armors ?? ownedArmors(c, entries))
        .map(current => current.id === armor.id ? { ...current, ...patch } : current) })
      return <div key={armor.id}>
        <label><input type="checkbox" aria-label={`Poison immunity: ${armor.name} status`}
          checked={active} disabled={!active && (!armor.worn || !!armor.mountainPoisonImmunityUsed)}
          onChange={event => update({ mountainPoisonImmunityActive: event.target.checked,
            ...(event.target.checked ? { mountainPoisonImmunityUsed: true } : {}) })} />
          {' '}Poison Immunity: {armor.name}</label>
        {armor.mountainPoisonImmunityUsed && <button type="button" aria-label={`Reset ${armor.name} poison immunity`}
          onClick={() => update({ mountainPoisonImmunityUsed: false, mountainPoisonImmunityActive: false })}>Daily preparations</button>}
      </div>
    })}</div> }] : []),
    ...(incendiaryArmors.length ? [{ name: 'Living Flame', element: <div>{incendiaryArmors.map(armor => {
      const active = !!armor.livingFlameActive
      const update = (patch: Partial<typeof armor>) => save({ armors: (c.armors ?? ownedArmors(c, entries))
        .map(current => current.id === armor.id ? { ...current, ...patch } : current) })
      const toggle = (checked: boolean) => update({ livingFlameActive: checked, ...(checked ? { livingFlameUsed: true } : {}) })
      const disabled = !active && (!armor.worn || !!armor.livingFlameUsed)
      return <div key={armor.id}>
        <input type="checkbox" aria-label={`Living Flame: ${armor.name} status`} checked={active} disabled={disabled}
          onChange={event => toggle(event.target.checked)} />{' '}
        <EntryDescription name={`Living Flame: ${armor.name}`} entry={LIVING_FLAME} hideButtonActions />{' '}
        <ActiveSpellActions name={`Living Flame: ${armor.name}`} entry={LIVING_FLAME} actions="Two Actions">
          <label><input type="checkbox" aria-label={`Living Flame: ${armor.name} active`} checked={active} disabled={disabled}
            onChange={event => toggle(event.target.checked)} /> Active</label>{' '}
          <DamageRoll name="Living Flame" damage={{ label: 'Damage', dice: 10, sides: 6, type: 'fire',
            note: 'DC 40 basic Reflex save' }} disabled={!active} />
        </ActiveSpellActions>
        {armor.livingFlameUsed && <button type="button" aria-label={`Reset ${armor.name} Living Flame`}
          onClick={() => update({ livingFlameUsed: false, livingFlameActive: false })}>Daily preparations</button>}
      </div>
    })}</div> }] : []),
    ...(cursedWeakness ? [{ name: 'Cursed Weakness', element: <button type="button" aria-label={`Took ${cursedWeakness.damage} damage`}
      disabled={conditionValue(c, 'doomed') >= 2}
      onClick={() => save({ conditions: { ...c.conditions, doomed: Math.max(2, conditionValue(c, 'doomed')) } })}>
      Took {cursedWeakness.damage} damage</button> }] : []),
    ...(c.systems.includes('pf2e') && activeFeatsNamed(c, 'Fulminating Shot').length ? [{
      name: 'Fulminating Shot',
      element: <div>
        <label><input type="checkbox" aria-label="Fulminating Shot status" checked={!!c.fulminatingShotActive}
          disabled={!FULMINATING_SHOT_ELEMENTS.includes(c.fulminatingShotElement as typeof FULMINATING_SHOT_ELEMENTS[number])}
          onChange={event => save({ fulminatingShotActive: event.target.checked })} />
          {' '}Fulminating Shot ({c.level >= 18 ? '3d6' : c.level >= 12 ? '2d6' : '1d6'})</label>{' '}
        <label>Element{' '}
          <select aria-label="Fulminating Shot element" value={c.fulminatingShotElement ?? ''}
            onChange={event => {
              const element = FULMINATING_SHOT_ELEMENTS.find(option => option === event.target.value)
              save({ fulminatingShotElement: element, ...(!element ? { fulminatingShotActive: false } : {}) })
            }}>
            <option value="">Choose</option>
            {FULMINATING_SHOT_ELEMENTS.map(element => <option key={element}>{element}</option>)}
          </select>
        </label>
      </div>,
    }] : []),
    ...(activeFeatsNamed(c, 'Sky Master Mask').length ? [{
      name: 'Sky Master Mask',
      element: <label><input type="checkbox" aria-label="Sky Master Mask doubled flight"
        checked={isFeatEffectActive(c, 'Sky Master Mask')}
        onChange={event => save(featEffectChange(c, 'Sky Master Mask', event.target.checked))} />
        {' '}Sky Master Mask doubled flight</label>,
    }] : []),
    ...(activeFeatsNamed(c, 'Thick Hide Mask').length ? [{
      name: 'Thick Hide Mask',
      element: <label><input type="checkbox" aria-label="Thick Hide Mask resistance active"
        checked={isFeatEffectActive(c, 'Thick Hide Mask')}
        onChange={event => save(featEffectChange(c, 'Thick Hide Mask', event.target.checked))} />
        {' '}Thick Hide Mask resistance</label>,
    }] : []),
    ...(defense.shield ? [{ name: 'Raise Shield', element: <label title={shieldParagonActive(c) ? 'Always raised by Shield Paragon' : undefined}>
      <input type="checkbox" aria-label={`${defense.shieldLabel} status`} checked={shieldRaised(c)} disabled={shieldParagonActive(c)}
        onChange={event => { if (!shieldParagonActive(c)) save(shieldRaisedChange(c, event.target.checked)) }} />
      {' '}{defense.shieldLabel} (+{shieldAcBonus(c, entries)} AC)</label> }] : []),
    ...(defense.boneShield ? [{ name: 'Raise Bone Shield', element: <label><input type="checkbox" aria-label="Raise Bone Shield status"
      checked={!!c.boneShieldRaised} onChange={event => save({ boneShieldRaised: event.target.checked })} /> Raise Bone Shield (+2 AC)</label> }]
      : defense.cantrip ? [{ name: 'Raise Shield Cantrip', element: <label><input type="checkbox" aria-label="Raise Shield Cantrip status"
        checked={isSpellActive(c, entries, 'Shield')}
        onChange={event => save(spellActiveChange(c, 'Shield', event.target.checked))} /> Raise Shield Cantrip (+1 AC)</label> }] : []),
    ...(defense.parryWeapon && defense.parry > 0 ? [{ name: 'Parry', element: <><input type="checkbox" aria-label="Parry status"
      checked={!!c.parrying || defense.stanceParry} disabled={defense.stanceParry}
      onChange={event => { if (!defense.stanceParry) save({ parrying: event.target.checked }) }} />{' '}
      <EntryDescription name="Parry" entry={parryEntry} entries={entries} character={c} /> (+{defense.parry} AC){' '}
      <ActiveSpellActions name="Parry" entry={parryEntry} actions="Single Action">
        <label><input type="checkbox" aria-label="Parry active in options" checked={!!c.parrying || defense.stanceParry}
          disabled={defense.stanceParry} onChange={event => { if (!defense.stanceParry) save({ parrying: event.target.checked }) }} /> Parry</label>
      </ActiveSpellActions></> }] : []),
    ...(['enfeebled', 'frightened', 'sickened', 'doomed'] as const).map(name => ({
      name, element: <label>
        {name[0].toUpperCase() + name.slice(1)}{' '}
        <input type="number" min="0" step="1" aria-label={`${name[0].toUpperCase() + name.slice(1)} status`}
          value={conditionValue(c, name)} onChange={event => {
            const value = Number(event.target.value)
            if (!Number.isSafeInteger(value) || value < 0) return
            save({ conditions: { ...c.conditions, [name]: value } })
          }} />
      </label>,
    })),
    ...(c.className === 'Barbarian' || activeFeatsNamed(c, 'Barbarian Dedication').length
      ? [{ name: 'Rage', element: <RageToggle c={c} save={save} /> }] : []),
    ...(zealousRank !== undefined ? [{ name: 'Zealous Conviction', element: <>
      <input type="checkbox" aria-label="Zealous Conviction active on self" checked={c.zealousConvictionRank !== undefined}
        onChange={event => save({ zealousConvictionRank: event.target.checked ? zealousRank : undefined })} />{' '}
      <EntryDescription name="Zealous Conviction" entry={zealousEntry} entries={entries} character={c} />{' '}
      {zealousEntry && <ActiveSpellActions name="Zealous Conviction" entry={zealousEntry} rank={zealousRank}
        actions={grant?.source === 'Heroic Presence' ? 'Single Action' : undefined}>
        <ZealousConvictionToggle c={c} save={save} rank={zealousRank} />
      </ActiveSpellActions>}
    </> }] : []),
    ...(activeFeatsNamed(c, 'Favored Terrain').length
      ? [{ name: 'Favored Terrain', element: <><input type="checkbox" aria-label="Favored Terrain status"
        checked={terrainActive} disabled={terrainLocked}
        onChange={event => save(featEffectChange(c, 'Favored Terrain', event.target.checked))} />{' '}
        <EntryDescription name="Favored Terrain" entry={terrainEntry} entries={entries} character={c} hideButtonActions />{' '}
        <ActiveSpellActions name="Favored Terrain" entry={terrainEntry}>
          <label><input type="checkbox" aria-label="Favored Terrain active in options" checked={terrainActive} disabled={terrainLocked}
            onChange={event => save(featEffectChange(c, 'Favored Terrain', event.target.checked))} /> Favored Terrain</label>
          <FavoredTerrainSelector c={c} save={save} />
        </ActiveSpellActions>{' '}
        <FavoredTerrainSelector c={c} save={save} status /></> }] : []),
    ...(knowsSpell(c, entries, 'Protect Companion') || c.activeSpells?.includes('Protect Companion')
      ? [{ name: 'Protect Companion', element: <ProtectCompanionOptions c={c} save={save} entries={entries} showDetails /> }] : []),
    ...(summonedUndead ? [{
      name: 'Summon Undead',
      element: <label><input type="checkbox" aria-label="Summon Undead status" checked
        onChange={event => {
          if (event.target.checked) return
          confirmRemoval(`summoned ${summonedUndead.name}`, () => save({
            summonedUndead: undefined, activeSpells: c.activeSpells?.filter(spell => spell !== 'Summon Undead'),
            ...(c.mountedSummon?.startsWith('undead:') ? { mountedSummon: undefined } : {}),
          }))
        }} /> Summon Undead: {summonedUndead.name}</label>,
    }] : []),
    ...(summonedFiend ? [{
      name: 'Summon Fiend',
      element: <label><input type="checkbox" aria-label="Summon Fiend status" checked
        onChange={event => {
          if (event.target.checked) return
          confirmRemoval(`summoned ${summonedFiend.name}`, () => save({
            summonedFiend: undefined, activeSpells: c.activeSpells?.filter(spell => spell !== 'Summon Fiend'),
            ...(c.mountedSummon?.startsWith('fiend:') ? { mountedSummon: undefined } : {}),
          }))
        }} /> Summon Fiend: {summonedFiend.name}</label>,
    }] : []),
    ...spellControls,
  ].sort((a, b) => a.name.localeCompare(b.name))
  return <div className="character-section-content">
    <div className="condition-controls" role="group" aria-label="Statuses">
      {controls.map(control => {
        const entry = !['Heroic Defiance', 'Hunt Prey'].includes(control.name) && !spellControls.some(spell => spell.name === control.name) && entries.find(candidate => (candidate.kind === 'feat' || candidate.kind === 'classFeature')
          && !candidate.deleted && candidate.name.toLowerCase() === control.name.toLowerCase()
          && candidate.systems.some(system => c.systems.includes(system))
          && typeof candidate.data.actions === 'string' && /(?:single|one|two|three) action|free action|reaction/i.test(candidate.data.actions))
        return <div className="status-row" key={control.name}>{entry ? <>
          {control.name === 'Harden Flesh' && <><input type="checkbox" aria-label="Harden Flesh status"
            checked={!!c.hardenFleshActive} onChange={event => save({ hardenFleshActive: event.target.checked })} />{' '}</>}
          <EntryDescription name={control.name} entry={entry} entries={entries} character={c} hideButtonActions />{' '}
          <ActiveSpellActions name={control.name} entry={entry}>{control.element}</ActiveSpellActions>
        </> : control.element}</div>
      })}
    </div>
  </div>
}
