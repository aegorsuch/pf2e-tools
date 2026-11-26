import { adoptedAncestryText, hasWardenChoice, isCompanionAdvancement, isCompanionSpecialization, selectedFeatEntry, wardenSpellOptions } from './featChoices'
import { CANNY_STATS, cannyAcumenOptions, availableOrders, clanLoreLabel, combinationName, dailyLongevityRanks, featChoiceOptions, featSkillChoiceLabel, knownSpellNames, nephilimLineageLore, orderMagicOptions, statDefs, subclassOptions, subclassSkillChoice, terrainExpertiseOptions, unconventionalWeaponChoice, weaponEntry } from './builder'
import { automaticFeatGrants } from './builder'
import type { SectionProps } from './builder'
import { DOMAIN_FEATS, automaticFeatChoiceKey, coreAttunementOptions, featSpellOptions, isInnateSpellChoice } from './featSpells'
import { featRarity } from './featAccess'
import { SearchableSelect } from './SearchableSelect'
import { isFixedAncestralWeaponFamiliarity } from './weaponFamiliarity'
import { EntryDescription } from './EntryDescription'
import { getSettings } from './settings'

const repeatableFeatNames = new WeakMap<SectionProps['entries'], Set<string>>()
const PLANAR_LORE_CHOICES = [
  'Abaddon', 'Astral Plane', 'Axis', 'Boneyard', "Creation's Forge", 'Dimension of Time', 'Dreamlands',
  'Elysium', 'Ethereal Plane', 'First World', 'Heaven', 'Hell', 'Maelstrom', 'Netherworld', 'Nirvana',
  'Outer Rifts', 'Plane of Air', 'Plane of Earth', 'Plane of Fire', 'Plane of Metal', 'Plane of Water',
  'Plane of Wood', 'Universe', 'Void',
]
function isRepeatableFeat(entries: SectionProps['entries'], name: string) {
  let names = repeatableFeatNames.get(entries)
  if (!names) {
    names = new Set(entries.filter(entry => entry.kind === 'feat' && entry.data.repeatable === true).map(entry => entry.name))
    repeatableFeatNames.set(entries, names)
  }
  return names.has(name)
}

export function CarryTheirMemoriesChoice({ c, entries, save, index }: SectionProps & { index: number }) {
  const feat = c.feats[index]
  if (!feat) return null
  const ranks = dailyLongevityRanks(c, entries)
  const options = [...new Set([...statDefs(c).filter(stat => stat.kind === 'skill').map(stat => stat.name),
    ...c.lores.map(lore => lore.name), ...Object.keys(ranks).filter(name => /\blore$/i.test(name))])]
    .filter(skill => (ranks[skill] ?? 0) >= 1).sort()
  return <span className="feat-choice feat-choice-with-note">
    <label>Daily Assurance skill{' '}
      <select aria-label="Carry Their Memories daily Assurance skill" value={feat.choice ?? ''} onChange={event => {
        const choice = event.target.value
        if (choice && !options.includes(choice)) return
        save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice: choice || undefined } : existing) })
      }}>
        <option value="">Choose trained skill</option>
        {feat.choice && !options.includes(feat.choice) && <option disabled>{feat.choice}</option>}
        {options.map(skill => <option key={skill}>{skill}</option>)}
      </select>
    </label>
  </span>
}

export function AutomaticFeatChoice({ c, entries, save, name, source, choice, choiceKey, choiceIndex }: SectionProps & {
  name: string; source: string; choice?: string; choiceKey?: string; choiceIndex?: number
}) {
  if (name === 'Additional Lore') {
    const key = choiceKey ?? automaticFeatChoiceKey(source, name)
    if (source === 'Nephilim Lore') {
      const fixedPlane = nephilimLineageLore(c, entries)
      const planes = fixedPlane ? [fixedPlane] : PLANAR_LORE_CHOICES
      const current = choice?.trim().replace(/\s+lore$/i, '') ?? ''
      const selected = fixedPlane ?? planes.find(option => option.toLowerCase() === current.toLowerCase()) ?? current
      const feat = entries.find(entry => entry.kind === 'feat' && entry.name === name && entry.systems.includes('pf2e') && !entry.deleted)
      return <>
        <SearchableSelect aria-label="Nephilim Lore Additional Lore" alwaysSearchable value={selected} disabled={!!fixedPlane}
          renderDetails={() => <EntryDescription character={c} name={name} entry={feat} entries={entries}
            buttonLabel="Details" className="picker-details" deferDetails />}
          onChange={event => {
            const value = event.target.value
            if (fixedPlane || !PLANAR_LORE_CHOICES.includes(value)) return
            save({ automaticFeatChoices: { ...c.automaticFeatChoices, [key]: value } })
          }}>
          <option value="" disabled>Additional Lore</option>
          {selected && !planes.includes(selected) && <option value={selected} disabled>Additional Lore ({selected}) (unavailable)</option>}
          {planes.map(plane => <option key={plane} value={plane}>Additional Lore ({plane})</option>)}
        </SearchableSelect>
        {' '}<small>({source})</small>
      </>
    }
    return <label className="feat-choice">
      Lore subcategory{' '}
      <input key={`${key}:${choice ?? ''}`} aria-label={`${source} Additional Lore subcategory${choiceIndex ? ` ${choiceIndex}` : ''}`} defaultValue={choice ?? ''}
        onInput={event => event.currentTarget.setCustomValidity('')}
        onBlur={event => {
          const selected = event.target.value.trim() || undefined
          if (choiceKey && selected) {
            const normalize = (value: string) => value.trim().replace(/\s+lore$/i, '').toLowerCase()
            const others = automaticFeatGrants(c, entries).filter(grant => grant.name === name && grant.choiceKey !== key)
              .map(grant => grant.choice ?? c.automaticFeatChoices?.[grant.choiceKey ?? automaticFeatChoiceKey(grant.source, grant.name)])
            others.push(...c.feats.filter(feat => feat.name === name && (feat.takenLevel ?? feat.level) <= c.level).map(feat => feat.choice))
            if (others.some(other => other && normalize(other) === normalize(selected))) {
              event.target.setCustomValidity('Choose a different Lore subcategory.')
              event.target.reportValidity()
              return
            }
          }
          const automaticFeatChoices = { ...c.automaticFeatChoices }
          if (selected) automaticFeatChoices[key] = selected
          else delete automaticFeatChoices[key]
          save({ automaticFeatChoices })
        }} />
    </label>
  }
  if (name === 'Terrain Expertise' && source !== 'Pioneer Human') {
    const key = automaticFeatChoiceKey(source, name)
    const used = automaticFeatGrants(c, entries).filter(grant => grant.name === name && grant.source !== source)
      .map(grant => grant.choice ?? c.automaticFeatChoices?.[automaticFeatChoiceKey(grant.source, grant.name)])
      .filter((terrain): terrain is string => !!terrain)
    const options = terrainExpertiseOptions(c, -1, used)
    return <SearchableSelect label={`${name} terrain`} aria-label={`${name} terrain`} value={choice ?? ''} onChange={event => {
      const selected = event.target.value || undefined
      if (selected && !options.includes(selected)) return
      const automaticFeatChoices = { ...c.automaticFeatChoices }
      if (selected) automaticFeatChoices[key] = selected
      else delete automaticFeatChoices[key]
      save({ automaticFeatChoices })
    }}>
      <option value="">Choose terrain</option>
      {choice && !options.includes(choice) && <option value={choice} disabled>{choice} (unavailable)</option>}
      {options.map(terrain => <option key={terrain}>{terrain}</option>)}
    </SearchableSelect>
  }
  if (name !== 'Kitsune Spell Familiarity') return null
  const known = getSettings().uniqueInnateSpellChoices ? knownSpellNames(c, entries) : new Set<string>()
  const options = (featSpellOptions(c, entries, { name, type: 'Ancestry Feat', level: 1, slot: '' }) ?? [])
    .filter(spell => spell.name === choice || !known.has(spell.name.toLowerCase()))
  return <label className="feat-choice">
    <SearchableSelect label="Daily cantrip" aria-label={`${name} spell`} value={choice ?? ''}
      optionSpell={value => options.find(spell => spell.name === value)} onChange={event => {
      const selected = event.target.value || undefined
      if (selected && !options.some(spell => spell.name === selected)) return
      const key = automaticFeatChoiceKey(source, name)
      const automaticFeatChoices = { ...c.automaticFeatChoices }
      if (selected) automaticFeatChoices[key] = selected
      else delete automaticFeatChoices[key]
      save({ automaticFeatChoices })
    }}>
      <option value="">Choose cantrip</option>
      {choice && !options.some(spell => spell.name === choice) && <option value={choice} disabled>{choice}</option>}
      {options.map(spell => <option key={spell.id} value={spell.name}>{spell.name}</option>)}
    </SearchableSelect>
  </label>
}

export function FeatChoice({ c, entries, save, index }: SectionProps & { index: number }) {
  const feat = c.feats[index]
  if (!feat) return null
  if (feat.name === "Trickster's Ace" && c.className === 'Investigator' && c.systems.includes('pf2e')) return null
  if (feat.name === 'Bloodrager Dedication' && feat.slot === 'class:2:0') {
    const options = featChoiceOptions(feat.name, c, entries, feat.slot, index) ?? []
    return <SearchableSelect label="Tradition" aria-label="Bloodrager Dedication tradition" value={feat.choice ?? ''} onChange={event => {
      const choice = event.target.value || undefined
      if (choice && !options.includes(choice)) return
      save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice } : existing) })
    }}>
      <option value="">Choose tradition</option>
      {feat.choice && !options.includes(feat.choice) && <option value={feat.choice} disabled>{feat.choice} (unavailable)</option>}
      {options.map(option => <option key={option}>{option}</option>)}
    </SearchableSelect>
  }
  if (feat.name === 'Carry Their Memories' || feat.name === 'Dongun Education'
    || isFixedAncestralWeaponFamiliarity(c, entries, feat)) return null
  if (c.systems.includes('sf2e') && ['Lashunta', 'Shirren'].includes(c.ancestry ?? '')
    && ['Creature Shape', 'Creature Ally'].includes(feat.name)) return null
  if (feat.name === 'Memories of Valor' && c.systems.includes('sf2e')) {
    const options = featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index) ?? []
    return <SearchableSelect label="Memories of Valor skill" aria-label="Memories of Valor skill" value={feat.choice ?? ''}
      onChange={event => {
        const choice = event.target.value || undefined
        if (choice && !options.includes(choice)) return
        save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice } : existing) })
      }}>
      <option value="">Choose skill</option>
      {feat.choice && !options.includes(feat.choice) && <option value={feat.choice} disabled>{feat.choice} (unavailable)</option>}
      {options.map(skill => <option key={skill}>{skill}</option>)}
    </SearchableSelect>
  }
  if (c.systems.includes('sf2e') && feat.name === 'Exocortex Experimenter') return null
  if (c.systems.includes('sf2e') && ['Advanced Drone', 'Superior Drone', 'Convertible Chassis'].includes(feat.name)) {
    const options = featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index) ?? []
    return <label className="feat-choice">{feat.name === 'Advanced Drone' ? 'Advancement' : feat.name === 'Superior Drone' ? 'Specialization'
      : 'Additional chassis'}{' '}
      <select aria-label={`${feat.name} choice`} value={feat.choice ?? ''} onChange={event => {
        const choice = event.target.value
        if (choice && !options.includes(choice)) return
        save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice: choice || undefined } : existing) })
      }}>
        <option value="">Choose</option>
        {feat.choice && !options.includes(feat.choice) && <option value={feat.choice} disabled>{feat.choice} (unavailable)</option>}
        {options.map(option => <option key={option}>{option}</option>)}
      </select>
    </label>
  }
  if (feat.name === 'Orc Warmask') {
    const options = featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index) ?? []
    return <span className="feat-choice feat-choice-with-note">
      <label>Power source{' '}<select aria-label={adoptedAncestryText(c, 'Orc Warmask power source')} value={feat.choice ?? ''} disabled={!!feat.choice}
        onChange={event => {
          const choice = event.target.value
          if (!options.includes(choice)) return
          save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice } : existing) })
        }}>
        <option value="">Choose source</option>
        {[...options].sort((a, b) => a.localeCompare(b)).map(option => <option key={option} value={option}>{featSkillChoiceLabel(feat.name, option)}</option>)}
      </select></label>
      <small>Source cannot be changed after selection.</small>
    </span>
  }
  if (feat.name === 'Clan Lore' || feat.name === 'Dwarven Lore') {
    const clans = feat.name === 'Clan Lore' ? featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index) ?? [] : []
    if (feat.name === 'Dwarven Lore') return null
    return <span className="feat-choice feat-choice-with-note">
      {feat.name === 'Clan Lore' && <SearchableSelect label="Clan" aria-label="Clan Lore clan" value={feat.choice ?? ''}
        onChange={event => {
          if (event.target.value && !clans.includes(event.target.value)) return
          save({ feats: c.feats.map((existing, i) => i === index ? {
            ...existing, choice: event.target.value || undefined, replacements: undefined,
          } : existing) })
        }}>
        <option value="">Choose clan</option>
        {feat.choice && !clans.includes(feat.choice) && <option disabled>{feat.choice}</option>}
        {clans.map(clan => <option key={clan} value={clan}>{clanLoreLabel(clan)}</option>)}
      </SearchableSelect>}
    </span>
  }
  if (feat.name === 'Lizardfolk Lore') {
    if (feat.choice?.includes(', ')) return null
    const options = ['Nature', 'Occultism']
    const setReplacement = (replacementIndex: number, value: string) => {
      const next = [...(feat.replacements ?? [])]
      next[replacementIndex] = value
      while (next.length && !next[next.length - 1]) next.pop()
      save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, replacements: next.length ? next : undefined } : existing) })
    }
    return <span className="feat-choice feat-choice-with-note">
      <label>Skill{' '}
        <select aria-label="Lizardfolk Lore skill" value={feat.choice ?? ''} onChange={event => {
          const choice = event.target.value || undefined
          if (choice && !options.includes(choice)) return
          save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice } : existing) })
        }}>
          <option value="">Choose Nature or Occultism</option>
          {feat.choice && !options.includes(feat.choice) && <option disabled>{feat.choice}</option>}
          {options.map(option => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label>Additional Lore{' '}
        <select aria-label="Lizardfolk Lore additional lore" value={feat.replacements?.[0] ?? ''} onChange={event => setReplacement(0, event.target.value)}>
          <option value="">Choose lore</option>
          <option>Astrology Lore</option>
          <option>Lizardfolk Lore</option>
        </select>
      </label>
    </span>
  }
  if (['Eye for Treasure', 'Expressive Face', "Officer's Medical Training", 'Shiny', 'Adaptive Visual Receptors', 'Additional Arms', 'Augmented Body', 'Experienced Laborer', 'Distant Telepath'].includes(feat.name)) return null
  if (['Ancestral Linguistics', 'Ancestral Longevity', 'Expert Longevity', "Officer's Education"].includes(feat.name)) return null
  if (feat.name === 'Elemental Wrath') return null
  if (['Unconventional Weaponry', 'Tengu Weapon Familiarity', 'Surki Weapon Familiarity'].includes(feat.name)) {
    const choice = feat.choice ? feat.name === 'Unconventional Weaponry'
      ? unconventionalWeaponChoice(entries, feat.choice) : combinationName(entries, feat.choice) : ''
    const weapon = weaponEntry(entries, choice)
      ?? entries.find(entry => entry.kind === 'weapon' && combinationName(entries, entry.name) === choice && !entry.deleted)
    const options = (featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index) ?? []).map(option =>
      choice && weapon && /^Shobhad Longrifle(?: \((?:Pathfinder|Starfinder)\))?$/.test(choice)
        && weaponEntry(entries, option)?.id === weapon.id ? choice : option)
    const rareException = feat.name === 'Unconventional Weaponry' && !!weapon
      && /^Shobhad Longrifle(?: \(Pathfinder\))?$/.test(weapon.name) && featRarity(weapon) === 'Rare'
    return <details className="feat-choice-details">
      <summary>{choice ? `Weapon: ${choice}` : 'Choose weapon'}</summary>
      <span className="feat-choice feat-choice-with-note">
        <SearchableSelect label="Weapon" aria-label={`${feat.name} weapon`} value={choice}
          optionLevel={value => weaponEntry(entries, value)?.level} onChange={event => {
          const choice = event.target.value || undefined
          if (choice && !options.includes(choice)) return
          save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice, culturalWeapon: undefined, rareWeaponOverride: undefined } : existing) })
        }}>
          <option value="">Choose weapon</option>
          {choice && !options.includes(choice) && <option disabled>{choice}</option>}
          {options.map(name => <option key={name}>{name}</option>)}
        </SearchableSelect>
        {rareException && <label><input type="checkbox" checked={!!feat.rareWeaponOverride}
          onChange={event => save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, rareWeaponOverride: event.target.checked } : existing) })} />
          {' '}GM allows rare Shobhad Longrifle for this feat (house rule)</label>}
        {rareException && !feat.rareWeaponOverride && <small>Official rules exclude this rare weapon without a house rule.</small>}
      </span>
    </details>
  }
  if (feat.name === 'Favored Terrain') return null
  if (feat.name === 'Mercy') {
    const options = featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index) ?? []
    return <label>Mercy{' '}
      <select aria-label="Mercy choice" value={feat.choice ?? ''} onChange={event => {
        const choice = event.target.value
        if (choice && !options.includes(choice)) return
        save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice: choice || undefined } : existing) })
      }}>
        <option value="">Choose mercy</option>
        {feat.choice && !options.includes(feat.choice) && <option value={feat.choice} disabled>{feat.choice} (unavailable)</option>}
        {[...options].sort((a, b) => a.localeCompare(b)).map(option => <option key={option}>{option}</option>)}
      </select>
    </label>
  }
  if (feat.name === 'Beast Trainer' || feat.name === 'Hold Mark' || feat.name === 'Alloyed Attacks'
    || feat.name === 'Reinforced Skeleton') {
    const options = featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index) ?? []
    const label = feat.name === 'Beast Trainer' ? 'Granted feat' : feat.name === 'Hold Mark' ? 'Emblem'
      : feat.name === 'Alloyed Attacks' ? 'Metal' : 'Resistance'
    return <label>{label}{' '}
      <select aria-label={`${feat.name} choice`} value={feat.choice ?? ''} onChange={event => {
        const choice = event.target.value
        if (choice && !options.includes(choice)) return
        save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice: choice || undefined } : existing) })
      }}>
        <option value="">Choose {label.toLowerCase()}</option>
        {feat.choice && !options.includes(feat.choice) && <option disabled>{feat.choice}</option>}
        {[...options].sort((a, b) => a.localeCompare(b)).map(option => <option key={option} value={option}>{featSkillChoiceLabel(feat.name, option)}</option>)}
      </select>
    </label>
  }
  if (feat.name === 'Versatile Rogue' || feat.name === 'Versatile Investigator'
    || feat.name === 'Versatile Gunslinger' || feat.name === 'Versatile Envoy'
    || feat.name === 'Versatile Operative' || feat.name === 'Multifarious Muse') {
    const options = featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index) ?? []
    const className = feat.name === 'Versatile Rogue' ? 'Rogue'
      : feat.name === 'Versatile Investigator' ? 'Investigator'
        : feat.name === 'Versatile Gunslinger' ? 'Gunslinger' : feat.name === 'Versatile Envoy' ? 'Envoy'
          : feat.name === 'Versatile Operative' ? 'Operative' : 'Bard'
    const kind = className === 'Rogue' ? 'racket' : className === 'Investigator' ? 'methodology'
      : className === 'Gunslinger' ? 'way' : className === 'Envoy' ? 'leadership style'
        : className === 'Operative' ? 'specialization' : 'muse'
    const subclass = className === 'Envoy' || className === 'Operative'
      ? subclassOptions({ ...c, className }, entries).find(entry => entry.name === feat.choice)
      : entries.find(entry => entry.kind === 'subclass' && entry.name === feat.choice && entry.data.class === className)
    const investigatorVariants = className === 'Investigator' ? options.flatMap(method => {
      const choice = subclassSkillChoice({ ...c, className: 'Investigator', subclass: method }, entries)
      return choice?.options.length
        ? choice.options.map(skill => ({ value: `${method}|${skill}`, label: `${method} (${skill})` }))
        : [{ value: method, label: method }]
    }) : []
    const gunslingerVariants = className === 'Gunslinger' ? options.flatMap(way => {
      const choice = subclassSkillChoice({ ...c, className: 'Gunslinger', subclass: way }, entries)
      return choice?.options.length
        ? choice.options.map(skill => ({ value: `${way}|${skill}`, label: `${way} (${skill})` }))
        : [{ value: way, label: way }]
    }) : []
    const investigatorChoice = feat.choice
      ? subclassSkillChoice({ ...c, className: 'Investigator', subclass: feat.choice }, entries) : undefined
    const investigatorSkill = investigatorChoice ? c.subclassSkillChoices?.[investigatorChoice.key] ?? '' : ''
    const investigatorValue = feat.choice && investigatorChoice?.options.length
      ? investigatorSkill ? `${feat.choice}|${investigatorSkill}` : feat.choice : feat.choice ?? ''
    const gunslingerChoice = feat.choice
      ? subclassSkillChoice({ ...c, className: 'Gunslinger', subclass: feat.choice }, entries) : undefined
    const gunslingerSkill = gunslingerChoice ? c.subclassSkillChoices?.[gunslingerChoice.key] ?? '' : ''
    const gunslingerValue = feat.choice && gunslingerChoice?.options.length
      ? gunslingerSkill ? `${feat.choice}|${gunslingerSkill}` : feat.choice : feat.choice ?? ''
    return <span className="feat-choice feat-choice-with-note">
      {className === 'Investigator' ? <SearchableSelect label={`Additional ${kind}`} aria-label={`${feat.name} ${kind}`}
        value={investigatorValue} onChange={event => {
          const value = event.target.value
          const separator = value.indexOf('|')
          const choice = separator < 0 ? value : value.slice(0, separator)
          const skill = separator < 0 ? undefined : value.slice(separator + 1)
          if (choice && !options.includes(choice)) return
          const skillChoice = choice ? subclassSkillChoice({ ...c, className: 'Investigator', subclass: choice }, entries) : undefined
          if (skillChoice?.options.length && (!skill || !skillChoice.options.includes(skill))) return
          save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice: choice || undefined } : existing),
            ...(skillChoice ? { subclassSkillChoices: { ...c.subclassSkillChoices, [skillChoice.key]: skill ?? '' } } : {}) })
        }}>
        <option value="">Choose methodology</option>
        {feat.choice && !investigatorVariants.some(option => option.value === investigatorValue)
          && <option value={investigatorValue} disabled>{feat.choice}{investigatorChoice?.options.length ? ' (choose skill)' : ' (unavailable)'}</option>}
        {[...investigatorVariants].sort((a, b) => a.label.localeCompare(b.label))
          .map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </SearchableSelect> : className === 'Gunslinger' ? <SearchableSelect label={`Additional ${kind}`} aria-label={`${feat.name} ${kind}`}
        value={gunslingerValue} onChange={event => {
          const value = event.target.value
          const separator = value.indexOf('|')
          const choice = separator < 0 ? value : value.slice(0, separator)
          const skill = separator < 0 ? undefined : value.slice(separator + 1)
          if (choice && !options.includes(choice)) return
          const skillChoice = choice ? subclassSkillChoice({ ...c, className: 'Gunslinger', subclass: choice }, entries) : undefined
          if (skillChoice?.options.length && (!skill || !skillChoice.options.includes(skill))) return
          save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice: choice || undefined } : existing),
            ...(skillChoice ? { subclassSkillChoices: { ...c.subclassSkillChoices, [skillChoice.key]: skill ?? '' } } : {}) })
        }}>
        <option value="">Choose way</option>
        {feat.choice && !gunslingerVariants.some(option => option.value === gunslingerValue)
          && <option value={gunslingerValue} disabled>{feat.choice}{gunslingerChoice?.options.length ? ' (choose skill)' : ' (unavailable)'}</option>}
        {[...gunslingerVariants].sort((a, b) => a.label.localeCompare(b.label))
          .map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </SearchableSelect> : <SearchableSelect label={`Additional ${kind}`} aria-label={`${feat.name} ${kind}`} value={feat.choice ?? ''} onChange={event => {
        const choice = event.target.value
        if (choice && !options.includes(choice)) return
        save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice: choice || undefined } : existing) })
      }}>
        <option value="">{`Choose ${kind}`}</option>
        {feat.choice && !options.includes(feat.choice) && <option value={feat.choice} disabled>{feat.choice} (unavailable)</option>}
        {[...options].sort((a, b) => a.localeCompare(b)).map(option => <option key={option}>{option}</option>)}
      </SearchableSelect>}
      {subclass && <EntryDescription name={subclass.name} entry={subclass} buttonLabel="Subclass details" />}
    </span>
  }
  if (feat.name === 'Terrain Expertise') {
    const options = terrainExpertiseOptions(c, index)
    const choice = options.find(terrain => terrain.toLowerCase() === feat.choice?.trim().toLowerCase()) ?? feat.choice ?? ''
    return <SearchableSelect label="Terrain" aria-label="Terrain Expertise terrain" value={choice} onChange={event => {
      if (event.target.value && !options.includes(event.target.value)) return
      save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice: event.target.value || undefined } : existing) })
    }}>
      <option value="">Choose terrain</option>
      {choice && !options.includes(choice) && <option disabled>{choice}</option>}
      {options.map(terrain => <option key={terrain}>{terrain}</option>)}
    </SearchableSelect>
  }
  if (feat.name === 'Researched Spell Resistance' || feat.name === 'Assurance') return null
  if (['Inventor Dedication', 'Second Innovation', 'Third Innovation'].includes(feat.name)) {
    const options = featChoiceOptions(feat.name, c, entries, feat.slot ?? '') ?? []
    return <SearchableSelect label="Innovation" aria-label={`${feat.name} innovation`} value={feat.choice ?? ''} onChange={event => {
      const choice = event.target.value || undefined
      if (choice && !options.includes(choice)) return
      save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice } : existing) })
    }}>
      <option value="">Choose innovation</option>
      {[...options].sort((a, b) => a.localeCompare(b)).map(option => <option key={option}>{option}</option>)}
    </SearchableSelect>
  }
  const atavism = feat.name === 'Elf Atavism' || feat.name === 'Elven Atavism'
  if (atavism || ['Adopted Ancestry', 'Skill Training', 'Weapon Proficiency', 'Technomagical Scrapper', 'Exceptional Artisan'].includes(feat.name)) {
    const options = featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index)
    if (!options) return null
    const label = atavism ? 'heritage' : feat.name === 'Adopted Ancestry' ? 'ancestry'
      : feat.name === 'Weapon Proficiency' ? 'advanced weapon' : 'skill'
    const choiceControl = <span className="feat-choice">
      <SearchableSelect aria-label={`${feat.name} ${label}`} value={feat.choice ?? ''} onChange={(e) => {
        const choice = e.target.value || undefined
        if (choice && !options.includes(choice)) return
        save({ feats: c.feats.map((f, i) => i === index ? { ...f, choice } : f) })
      }}>
        <option value="">{`Choose ${label}`}</option>
        {feat.choice && !options.includes(feat.choice) && <option disabled value={feat.choice}>{feat.choice}</option>}
        {options.map((choice) => <option key={choice}>{choice}</option>)}
      </SearchableSelect>
      {atavism && feat.choice && <EntryDescription name={feat.choice} buttonLabel="Heritage details"
        entry={entries.find(entry => entry.kind === 'heritage' && entry.name === feat.choice && !entry.deleted
          && entry.systems.some(system => c.systems.includes(system)))} />}
      {atavism && feat.choice === 'Ancient Elf' && <small role="status">Ancient Elf requires a non-elf ancestry with a lifespan measured in multiple centuries; alternate benefits require GM approval. Choose its multiclass dedication separately.</small>}
      {atavism && feat.choice && !options.includes(feat.choice)
        && <small role="status">Saved heritage is unavailable. Sync content or choose an enabled Elf heritage.</small>}
      {feat.name === 'Adopted Ancestry' && feat.choice && !options.includes(feat.choice)
        && <small role="status">Saved ancestry is unavailable. Check content and GM access, or choose another ancestry.</small>}
      {feat.name === 'Technomagical Scrapper' && feat.choice && !options.includes(feat.choice)
        && <small>Saved skill variant is unavailable at this feat's level. Choose another variant.</small>}
    </span>
    return feat.name === 'Adopted Ancestry'
      ? <details className="feat-choice-details">
        <summary>{feat.choice ? `Ancestry: ${feat.choice}${options.includes(feat.choice) ? '' : ' (unavailable)'}` : 'Choose ancestry'}</summary>
        {choiceControl}
      </details>
      : choiceControl
  }
  if (feat.name === 'Additional Lore' || feat.name === 'Historian' && c.systems.includes('sf2e')) {
    return <label className="feat-choice">
      Lore subcategory{' '}
      <input key={`${index}:${feat.name}:${feat.choice ?? ''}`} aria-label={`${feat.name} subcategory`} defaultValue={feat.choice ?? ''}
        onBlur={(e) => {
          const choice = e.target.value.trim() || undefined
          if (choice !== feat.choice) save({ feats: c.feats.map((f, i) => i === index ? { ...f, choice } : f) })
        }} />
    </label>
  }
  if (DOMAIN_FEATS.includes(feat.name)) {
    const options = featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index) ?? []
    const choice = options.find(domain => domain.toLowerCase() === feat.choice?.trim().toLowerCase()) ?? feat.choice ?? ''
    return <span className="feat-choice">
      <SearchableSelect aria-label={feat.name} value={choice} onChange={(e) => {
        const choice = e.target.value || undefined
        if (choice && !options.includes(choice)) return
        save({ feats: c.feats.map((f, i) => i === index ? { ...f, choice } : f) })
      }}>
        <option value="">Choose domain</option>
        {choice && !options.includes(choice) && <option disabled value={choice}>{choice} (unavailable)</option>}
        {options.map((domain) => <option key={domain}>{domain}</option>)}
      </SearchableSelect>
      {choice && !options.includes(choice) && <small>Saved domain is unavailable for the current deity or earlier feat choices.</small>}
    </span>
  }
  if (feat.name === 'Core Attunement' && c.systems.includes('pf2e')) {
    const chosen = (feat.choice ?? '').split('|')
    return <span className="feat-choice">{([0, 1] as const).map(slot => {
      const options = coreAttunementOptions(c, entries, slot)
      return <SearchableSelect key={slot} aria-label={`Core Attunement ${slot === 0 ? '1st-rank' : '2nd-rank or lower'} spell`} value={chosen[slot] ?? ''}
        optionLevel={value => options.find(spell => spell.name === value)?.level}
        optionSpell={value => options.find(spell => spell.name === value)} onChange={event => {
        const name = event.target.value
        if (name && !options.some(spell => spell.name === name)) return
        const next = [chosen[0] ?? '', chosen[1] ?? '']
        next[slot] = name
        const choice = next[0] || next[1] ? next.join('|') : undefined
        save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice } : existing) })
      }}>
        <option value="">{slot === 0 ? 'Choose 1st-rank spell' : 'Choose 2nd-rank or lower spell'}</option>
        {[...new Set(options.map(spell => spell.name))].map(name => <option key={name}>{name}</option>)}
      </SearchableSelect>
    })}</span>
  }
  const allSpellOptions = featSpellOptions(c, entries, feat)
  const source = selectedFeatEntry(c, entries, feat.name, feat.sourceId)
  const known = getSettings().uniqueInnateSpellChoices && allSpellOptions && source && isInnateSpellChoice(source) ? knownSpellNames(c, entries) : undefined
  const spellOptions = known ? allSpellOptions?.filter(spell => spell.name === feat.choice || !known.has(spell.name.toLowerCase())) : allSpellOptions
  if (['First World Magic', 'Ancestral Magic', 'Ancestral Cantrip', 'Free Heart', 'Bone Magic', 'Widespread Fascination', 'Psychic Talent', 'Psychic Master', 'Psychic Mastery', 'Psychic Paragon', 'Divine Warrior', 'Primal Warrior'].includes(feat.name)) return null
  if (spellOptions) return <span className="feat-choice">
    <SearchableSelect aria-label={`${feat.name} spell`} value={feat.choice ?? ''}
      optionLevel={value => spellOptions.find(spell => spell.name === value)?.level}
      optionSpell={value => spellOptions.find(spell => spell.name === value)} onChange={event => {
      const choice = event.target.value || undefined
      if (choice && !spellOptions.some(spell => spell.name === choice)) return
      save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice } : existing) })
    }}>
      <option value="">Choose spell</option>
      {feat.choice && !spellOptions.some(spell => spell.name === feat.choice) && <option disabled>{feat.choice}</option>}
      {[...new Set(spellOptions.map(spell => spell.name))].map(name => <option key={name}>{name}</option>)}
    </SearchableSelect>
    {!spellOptions.length && <small>Spell choices unavailable. Import official spell data.</small>}
  </span>
  if (feat.name === 'Living Weapon' || feat.name === 'General Training' || feat.name === 'Advanced General Training'
    || feat.name === 'Ancestral Paragon' || feat.name === 'Multitalented' || feat.name === 'Armor Proficiency' || feat.name === 'Multilingual'
    || isCompanionAdvancement(feat.name) && feat.name !== 'Splendid Companion' || isCompanionSpecialization(feat.name)) return null
  if (feat.name === 'Canny Acumen') {
    const available = cannyAcumenOptions(c, entries)
    return (
      <span className="feat-choice">
        <SearchableSelect aria-label="Canny Acumen statistic" value={feat.choice ?? ''} onChange={(e) => {
          const choice = e.target.value || undefined
          if (choice && !available.includes(choice)) return
          save({ feats: c.feats.map((f, i) => i === index ? { ...f, choice } : f) })
        }}>
          <option value="">Choose statistic…</option>
          {[...CANNY_STATS].sort((a, b) => a.localeCompare(b)).map((stat) => <option key={stat} value={stat} disabled={!available.includes(stat)}>{stat}{!available.includes(stat) ? ' (no improvement)' : ''}</option>)}
        </SearchableSelect>
      </span>
    )
  }
  if (feat.name === 'Order Magic') {
    const options = orderMagicOptions(c, index)
    return (
      <span className="feat-choice">
        <SearchableSelect aria-label="Order Magic order" value={feat.choice ?? ''} onChange={(e) => {
          const choice = e.target.value || undefined
          save({ feats: c.feats.map((f, i) => i === index ? { ...f, choice } : f) })
        }}>
          <option value="">Choose order…</option>
          {feat.choice && !options.includes(feat.choice) && <option value={feat.choice}>{feat.choice}</option>}
          {[...options].sort((a, b) => a.localeCompare(b)).map((o) => <option key={o} value={o}>{o}</option>)}
        </SearchableSelect>
      </span>
    )
  }
  if (feat.name === 'Order Explorer') {
    return (
      <span className="feat-choice">
        <SearchableSelect aria-label="Order Explorer order" value={feat.choice ?? ''} onChange={(e) => {
          const choice = e.target.value || undefined
          save({ feats: c.feats.map((f, i) => i === index ? { ...f, choice } : f) })
        }}>
          <option value="">Choose order…</option>
          {availableOrders(c, index).sort((a, b) => a.localeCompare(b)).map((o) => <option key={o} value={o}>{o}</option>)}
        </SearchableSelect>
      </span>
    )
  }
  const isWarden = hasWardenChoice(feat) && c.systems.includes('pf2e')
  if (feat.name === 'Additional Follower' && c.systems.includes('pf2e')) return null
  if (['Commercial Customization', 'Tactical Customization', 'Advanced Customization', 'Superior Customization', 'Superior Drone'].includes(feat.name)
    && c.className === 'Mechanic' && c.systems.includes('sf2e')) return null
  const repeatable = !isWarden && isRepeatableFeat(entries, feat.name)
  if (!isWarden && !repeatable) return null
  if (!isWarden) {
    return <label className="feat-choice">
      Choice{' '}
      <input key={`${index}:${feat.name}:${feat.choice ?? ''}`} aria-label={`${feat.name} choice`} defaultValue={feat.choice ?? ''}
        onBlur={(e) => {
          const choice = e.target.value.trim() || undefined
          if (choice !== feat.choice) save({ feats: c.feats.map((f, i) => i === index ? { ...f, choice } : f) })
        }} />
    </label>
  }
  const selected = new Set(c.feats.flatMap((f, i) => i !== index && hasWardenChoice(f) && f.choice ? [f.choice] : []))
  const available = wardenSpellOptions(feat, entries)
  const options = available.filter((spell) => !selected.has(spell.name) || spell.name === feat.choice)
  return (
    <span className="feat-choice">
      <SearchableSelect aria-label={`${feat.name} warden spell`} value={feat.choice ?? ''}
        optionLevel={value => options.find(spell => spell.name === value)?.level}
        optionSpell={value => options.find(spell => spell.name === value)} onChange={(e) => {
        const choice = e.target.value || undefined
        save({ feats: c.feats.map((f, i) => i === index ? { ...f, choice } : f) })
      }}>
        <option value="">Choose warden spell…</option>
        {feat.choice && !options.some((spell) => spell.name === feat.choice) && <option value={feat.choice}>{feat.choice}</option>}
        {options.map((spell) => <option key={spell.id} value={spell.name}>{spell.name}</option>)}
      </SearchableSelect>
      {available.length === 0 && <small>Warden spell data unavailable.</small>}
    </span>
  )
}
