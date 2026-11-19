import { adoptedAncestryText, hasWardenChoice, isCompanionAdvancement, isCompanionSpecialization, wardenSpellOptions } from './featChoices'
import { CANNY_STATS, SKILL_GRANT_REPLACEMENT_FEATS, cannyAcumenOptions, availableOrders, clanLoreLabel, combinationName, dailyLongevityRanks, featChoiceOptions, lizardfolkLoreReplacementChoices, orderMagicOptions, statDefs, terrainExpertiseOptions, weaponEntry } from './builder'
import type { SectionProps } from './builder'
import { DOMAIN_FEATS, featSpellOptions } from './featSpells'
import { featRarity } from './featAccess'
import { SearchableSelect } from './SearchableSelect'
import { isFixedAncestralWeaponFamiliarity } from './weaponFamiliarity'
import { EntryDescription } from './EntryDescription'

const repeatableFeatNames = new WeakMap<SectionProps['entries'], Set<string>>()
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

export function FeatChoice({ c, entries, save, index }: SectionProps & { index: number }) {
  const feat = c.feats[index]
  if (!feat) return null
  if (SKILL_GRANT_REPLACEMENT_FEATS.includes(feat.name)) {
    const options = featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index)
    if (!options) return null
    return <SearchableSelect label={`${feat.name} replacement skill`} aria-label={`${feat.name} replacement skill`}
      value={feat.choice ?? ''} onChange={event => {
        const choice = event.target.value || undefined
        if (choice && !options.includes(choice)) return
        save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice } : existing) })
      }}>
      <option value="">Choose replacement skill</option>
      {feat.choice && !options.includes(feat.choice) && <option disabled>{feat.choice}</option>}
      {options.map(skill => <option key={skill}>{skill}</option>)}
    </SearchableSelect>
  }
  if (feat.name === 'Carry Their Memories' || feat.name === 'Dongun Education'
    || isFixedAncestralWeaponFamiliarity(c, entries, feat)) return null
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
        {[...options].sort((a, b) => a.localeCompare(b)).map(option => <option key={option}>{option}</option>)}
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
    const replacements = lizardfolkLoreReplacementChoices(c, entries, index)
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
      {replacements.map(row => <label key={row.index}>{row.skill} replacement{' '}
        <select aria-label={`Lizardfolk Lore ${row.skill} replacement`} value={row.value ?? ''}
          onChange={event => setReplacement(row.index, event.target.value)}>
          <option value="">Choose replacement skill</option>
          {row.value && !row.options.includes(row.value) && <option disabled>{row.value}</option>}
          {row.options.map(option => <option key={option}>{option}</option>)}
        </select>
      </label>)}
    </span>
  }
  if (['Eye for Treasure', "Officer's Medical Training", 'Shiny', 'Adaptive Visual Receptors', 'Additional Arms', 'Augmented Body', 'Experienced Laborer'].includes(feat.name)) return null
  if (['Ancestral Linguistics', 'Ancestral Longevity', 'Expert Longevity', "Officer's Education"].includes(feat.name)) return null
  if (feat.name === 'Elemental Wrath') return null
  if (['Unconventional Weaponry', 'Tengu Weapon Familiarity', 'Surki Weapon Familiarity'].includes(feat.name)) {
    const choice = feat.choice ? combinationName(entries, feat.choice) : ''
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
        <SearchableSelect label="Weapon" aria-label={`${feat.name} weapon`} value={choice} onChange={event => {
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
        {[...options].sort((a, b) => a.localeCompare(b)).map(option => <option key={option}>{option}</option>)}
      </select>
    </label>
  }
  if (feat.name === 'Versatile Rogue' || feat.name === 'Multifarious Muse') {
    const options = featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index) ?? []
    const rogue = feat.name === 'Versatile Rogue'
    const kind = rogue ? 'racket' : 'muse'
    const subclass = entries.find(entry => entry.kind === 'subclass' && entry.name === feat.choice && entry.data.class === (rogue ? 'Rogue' : 'Bard'))
    return <span className="feat-choice feat-choice-with-note">
      <SearchableSelect label={`Additional ${kind}`} aria-label={`${feat.name} ${kind}`} value={feat.choice ?? ''} onChange={event => {
        const choice = event.target.value
        if (choice && !options.includes(choice)) return
        save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice: choice || undefined } : existing) })
      }}>
        <option value="">{`Choose ${kind}`}</option>
        {feat.choice && !options.includes(feat.choice) && <option value={feat.choice} disabled>{feat.choice} (unavailable)</option>}
        {[...options].sort((a, b) => a.localeCompare(b)).map(option => <option key={option}>{option}</option>)}
      </SearchableSelect>
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
  if (feat.name === 'Additional Lore') {
    return <label className="feat-choice">
      Lore subcategory{' '}
      <input key={`${index}:${feat.name}:${feat.choice ?? ''}`} aria-label="Additional Lore subcategory" defaultValue={feat.choice ?? ''}
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
  const spellOptions = featSpellOptions(c, entries, feat)
  if (['First World Magic', 'Ancestral Magic', 'Ancestral Cantrip', 'Free Heart', 'Bone Magic', 'Widespread Fascination'].includes(feat.name)) return null
  if (spellOptions) return <span className="feat-choice">
    <SearchableSelect aria-label={`${feat.name} spell`} value={feat.choice ?? ''} onChange={event => {
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
    || isCompanionAdvancement(feat.name) || isCompanionSpecialization(feat.name)) return null
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
      <SearchableSelect aria-label={`${feat.name} warden spell`} value={feat.choice ?? ''} onChange={(e) => {
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
