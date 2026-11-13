import { hasWardenChoice, isCompanionAdvancement, isCompanionSpecialization, wardenSpellOptions } from './featChoices'
import { CANNY_STATS, cannyAcumenOptions, availableOrders, researchedSpellResistanceChoices, combinationForms, combinationName, dailyLongevityRanks, featChoiceOptions, languageAllowance, languageGroups, orderMagicOptions, statDefs, terrainExpertiseOptions, weaponEntry, weaponHasAncestryTrait, warmaskAlternateSkills } from './builder'
import type { SectionProps } from './builder'
import { DOMAIN_FEATS, featSpellOptions } from './featSpells'
import { featRarity } from './featAccess'
import { SearchableSelect } from './SearchableSelect'

export function FeatChoice({ c, entries, save, index }: SectionProps & { index: number }) {
  const feat = c.feats[index]
  if (!feat) return null
  if (feat.name === 'Carry Their Memories') {
    const ranks = dailyLongevityRanks(c, entries)
    const options = [...new Set([...statDefs(c).filter(stat => stat.kind === 'skill').map(stat => stat.name), ...c.lores.map(lore => lore.name)])]
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
      <small>Temporary Assurance until daily preparations; cannot satisfy permanent prerequisites.</small>
    </span>
  }
  if (feat.name === 'Orc Warmask') {
    const options = featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index) ?? []
    const alternatives = warmaskAlternateSkills(c, entries, index)
    return <span className="feat-choice feat-choice-with-note">
      <label>Power source{' '}<select aria-label="Orc Warmask power source" value={feat.choice ?? ''} disabled={!!feat.choice}
        onChange={event => {
          const choice = event.target.value
          if (!options.includes(choice)) return
          save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice } : existing) })
        }}>
        <option value="">Choose source</option>
        {options.map(option => <option key={option}>{option}</option>)}
      </select></label>
      <small>Source cannot be changed after selection.</small>
      {alternatives.length > 0 && <label>Alternate trained skill{' '}
        <select aria-label="Orc Warmask alternate skill" value={c.warmask?.alternateSkill ?? ''} onChange={event => {
          const alternateSkill = event.target.value
          if (alternateSkill && !alternatives.includes(alternateSkill)) return
          save({ warmask: { ...c.warmask, alternateSkill: alternateSkill || undefined } })
        }}>
          <option value="">Choose skill</option>
          {c.warmask?.alternateSkill && !alternatives.includes(c.warmask.alternateSkill)
            && <option disabled>{c.warmask.alternateSkill}</option>}
          {alternatives.map(skill => <option key={skill}>{skill}</option>)}
        </select>
      </label>}
    </span>
  }
  if (feat.name === 'Ancestral Linguistics') {
    const known = new Set([...languageAllowance(c, entries).locked, ...c.languages].map(language => language.toLowerCase()))
    const options = Object.entries(languageGroups(entries)).flatMap(([rarity, languages]) =>
      languages.filter(([name]) => !known.has(name.toLowerCase())).map(([name]) => ({ name, rarity })))
    return <span className="feat-choice feat-choice-with-note">
      <SearchableSelect label="Daily language" aria-label="Ancestral Linguistics daily language" value={feat.choice ?? ''} onChange={event => {
        const choice = event.target.value
        if (choice && !options.some(option => option.name === choice)) return
        save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice: choice || undefined } : existing) })
      }}>
        <option value="">Choose language</option>
        {feat.choice && !options.some(option => option.name === feat.choice) && <option disabled>{feat.choice}</option>}
        {options.map(option => <option key={option.name} value={option.name}>{option.name} ({option.rarity})</option>)}
      </SearchableSelect>
      <small>Temporary until daily preparations; confirm access to non-common languages. Cannot satisfy permanent prerequisites.</small>
    </span>
  }
  if (feat.name === 'Elemental Wrath') return null
  if (['Unconventional Weaponry', 'Tengu Weapon Familiarity', 'Surki Weapon Familiarity'].includes(feat.name)) {
    const choice = feat.choice ? combinationName(entries, feat.choice) : ''
    const weapon = weaponEntry(entries, choice)
      ?? entries.find(entry => entry.kind === 'weapon' && combinationName(entries, entry.name) === choice && !entry.deleted)
    const options = (featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index) ?? []).map(option =>
      choice && weapon && /^Shobhad Longrifle(?: \((?:Pathfinder|Starfinder)\))?$/.test(choice)
        && weaponEntry(entries, option)?.id === weapon.id ? choice : option)
    const cultural = feat.name === 'Unconventional Weaponry' && !!weapon
      && (!featRarity(weapon) || ![weapon, ...combinationForms(entries, weapon.name)].some(form => weaponHasAncestryTrait(form, entries)))
    const rareException = feat.name === 'Unconventional Weaponry' && !!weapon
      && /^Shobhad Longrifle(?: \(Pathfinder\))?$/.test(weapon.name) && featRarity(weapon) === 'Rare'
    return <span className="feat-choice feat-choice-with-note">
      <SearchableSelect label="Weapon" aria-label={`${feat.name} weapon`} value={choice} onChange={event => {
        const choice = event.target.value || undefined
        if (choice && !options.includes(choice)) return
        save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice, culturalWeapon: undefined, rareWeaponOverride: undefined } : existing) })
      }}>
        <option value="">Choose weapon</option>
        {choice && !options.includes(choice) && <option disabled>{choice}</option>}
        {options.map(name => <option key={name}>{name}</option>)}
      </SearchableSelect>
      {cultural && <label><input type="checkbox" checked={!!feat.culturalWeapon}
        onChange={event => save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, culturalWeapon: event.target.checked } : existing) })} />
        {' '}GM confirmed weapon is common in another culture</label>}
      {cultural && !feat.culturalWeapon && <small>Access and familiarity require confirmation of cultural eligibility.</small>}
      {rareException && <label><input type="checkbox" checked={!!feat.rareWeaponOverride}
        onChange={event => save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, rareWeaponOverride: event.target.checked } : existing) })} />
        {' '}GM allows rare Shobhad Longrifle for this feat (house rule)</label>}
      {rareException && !feat.rareWeaponOverride && <small>Official rules exclude this rare weapon without a house rule.</small>}
    </span>
  }
  if (feat.name === 'Favored Terrain') return null
  if (feat.name === 'Beast Trainer' || feat.name === 'Hold Mark' || feat.name === 'Alloyed Attacks') {
    const options = featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index) ?? []
    const label = feat.name === 'Beast Trainer' ? 'Granted feat' : feat.name === 'Hold Mark' ? 'Emblem' : 'Metal'
    return <label>{label}{' '}
      <select aria-label={`${feat.name} choice`} value={feat.choice ?? ''} onChange={event => {
        const choice = event.target.value
        if (choice && !options.includes(choice)) return
        save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice: choice || undefined } : existing) })
      }}>
        <option value="">Choose {label.toLowerCase()}</option>
        {feat.choice && !options.includes(feat.choice) && <option disabled>{feat.choice}</option>}
        {options.map(option => <option key={option}>{option}</option>)}
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
        {options.map(option => <option key={option}>{option}</option>)}
      </SearchableSelect>
      {subclass && <small>{subclass.description}</small>}
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
  if (feat.name === 'Researched Spell Resistance') {
    const { rows } = researchedSpellResistanceChoices(c, entries, feat)
    return <span className="feat-choice feat-choice-with-note">
      {rows.map((row, choiceIndex) => <span className="searchable-select" key={choiceIndex}>
        <SearchableSelect label={choiceIndex === 0 ? 'Spell tradition' : 'Additional tradition'}
          aria-label={`Researched Spell Resistance tradition ${choiceIndex + 1}`} value={row.value}
          onChange={event => {
            const value = event.target.value
            if (value && !row.options.includes(value)) return
            const choice = [...rows.slice(0, choiceIndex).map(previous => previous.value), ...(value ? [value] : [])].join(', ') || undefined
            save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice } : existing) })
          }}>
          <option value="">Choose tradition</option>
          {row.value && !row.options.includes(row.value) && <option disabled value={row.value}>{row.value}</option>}
          {row.options.map(tradition => <option key={tradition}>{tradition}</option>)}
        </SearchableSelect>
        {row.value && !row.options.includes(row.value) && <small>Saved tradition is unavailable with current skill training or earlier choices.</small>}
      </span>)}
      <small>First tradition requires Expert. Each chosen tradition's Master skill unlocks one additional tradition with a Trained skill.</small>
    </span>
  }
  if (['Inventor Dedication', 'Second Innovation', 'Third Innovation'].includes(feat.name)) {
    const options = featChoiceOptions(feat.name, c, entries, feat.slot ?? '') ?? []
    return <SearchableSelect label="Innovation" aria-label={`${feat.name} innovation`} value={feat.choice ?? ''} onChange={event => {
      const choice = event.target.value || undefined
      if (choice && !options.includes(choice)) return
      save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice } : existing) })
    }}>
      <option value="">Choose innovation</option>
      {options.map(option => <option key={option}>{option}</option>)}
    </SearchableSelect>
  }
  if (['Adopted Ancestry', 'Skill Training', 'Shiny', 'Weapon Proficiency', 'Technomagical Scrapper',
    'Cite the Deep Lore', "Diplomat's Facade", 'Broken Hand Technique', 'Spelunker', 'Exceptional Artisan',
    'Ancestral Longevity', 'Expert Longevity'].includes(feat.name)) {
    const options = featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index)
    if (!options) return null
    const label = feat.name === 'Adopted Ancestry' ? 'ancestry'
      : feat.name === 'Weapon Proficiency' ? 'advanced weapon' : 'skill'
    const noteId = feat.name === 'Adopted Ancestry' ? `${c.id}:feat:${index}:note` : undefined
    return <span className={`feat-choice${noteId ? ' feat-choice-with-note' : ''}`}>
      <SearchableSelect aria-label={`${feat.name} ${label}`} aria-describedby={noteId} value={feat.choice ?? ''} onChange={(e) => {
        const choice = e.target.value || undefined
        if (choice && !options.includes(choice)) return
        save({ feats: c.feats.map((f, i) => i === index ? { ...f, choice } : f) })
      }}>
        <option value="">{`Choose ${label}`}</option>
        {feat.choice && !options.includes(feat.choice) && <option disabled value={feat.choice}>{feat.choice}</option>}
        {options.map((choice) => <option key={choice}>{choice}</option>)}
      </SearchableSelect>
      {noteId && <small id={noteId}>Ancestry access and physiological requirements need GM approval.</small>}
      {['Ancestral Longevity', 'Expert Longevity'].includes(feat.name)
        && <small>Temporary until daily preparations; cannot satisfy permanent prerequisites or skill increases.</small>}
      {feat.name === 'Technomagical Scrapper' && feat.choice && !options.includes(feat.choice)
        && <small>Saved skill variant is unavailable at this feat's level. Choose another variant.</small>}
    </span>
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
  if (['First World Magic', 'Ancestral Magic', 'Ancestral Cantrip', 'Free Heart'].includes(feat.name)) return null
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
          {CANNY_STATS.map((stat) => <option key={stat} value={stat} disabled={!available.includes(stat)}>{stat}{!available.includes(stat) ? ' (no improvement)' : ''}</option>)}
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
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
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
          {availableOrders(c, index).map((o) => <option key={o} value={o}>{o}</option>)}
        </SearchableSelect>
      </span>
    )
  }
  const isWarden = hasWardenChoice(feat) && c.systems.includes('pf2e')
  const repeatable = entries.some((entry) => entry.kind === 'feat' && entry.name === feat.name && entry.data.repeatable === true)
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
