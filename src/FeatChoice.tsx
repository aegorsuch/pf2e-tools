import { hasWardenChoice, isCompanionAdvancement, isCompanionSpecialization, wardenSpellOptions } from './featChoices'
import { CANNY_STATS, cannyAcumenOptions, availableOrders, deityDomains, researchedSpellResistanceChoices, featChoiceOptions, orderMagicOptions, terrainExpertiseOptions, weaponHasAncestryTrait } from './builder'
import type { SectionProps } from './builder'
import { DOMAIN_FEATS, featSpellOptions } from './featSpells'
import { SearchableSelect } from './SearchableSelect'

export function FeatChoice({ c, entries, save, index }: SectionProps & { index: number }) {
  const feat = c.feats[index]
  if (!feat) return null
  if (['Unconventional Weaponry', 'Tengu Weapon Familiarity', 'Surki Weapon Familiarity'].includes(feat.name)) {
    const options = featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index) ?? []
    const weapon = entries.find(entry => entry.kind === 'weapon' && entry.name === feat.choice && !entry.deleted)
    const cultural = feat.name === 'Unconventional Weaponry' && !!weapon && !weaponHasAncestryTrait(weapon, entries)
    return <span className="feat-choice feat-choice-with-note">
      <SearchableSelect label="Weapon" aria-label={`${feat.name} weapon`} value={feat.choice ?? ''} onChange={event => {
        const choice = event.target.value || undefined
        if (choice && !options.includes(choice)) return
        save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice, culturalWeapon: undefined } : existing) })
      }}>
        <option value="">Choose weapon</option>
        {feat.choice && !options.includes(feat.choice) && <option disabled>{feat.choice}</option>}
        {options.map(name => <option key={name}>{name}</option>)}
      </SearchableSelect>
      {cultural && <label><input type="checkbox" checked={!!feat.culturalWeapon}
        onChange={event => save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, culturalWeapon: event.target.checked } : existing) })} />
        {' '}GM confirmed weapon is common in another culture</label>}
      {cultural && !feat.culturalWeapon && <small>Access and familiarity require confirmation of cultural eligibility.</small>}
    </span>
  }
  if (feat.name === 'Favored Terrain') return null
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
  if (feat.name === 'Adopted Ancestry' || feat.name === 'Skill Training' || feat.name === 'Shiny' || feat.name === 'Weapon Proficiency' || feat.name === 'Technomagical Scrapper') {
    const options = featChoiceOptions(feat.name, c, entries, feat.slot ?? '', index)
    if (!options) return null
    const label = feat.name === 'Adopted Ancestry' ? 'ancestry' : feat.name === 'Weapon Proficiency' ? 'advanced weapon' : 'skill'
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
    const options = featChoiceOptions(feat.name, c, entries, feat.slot ?? '') ?? []
    const available = feat.name.startsWith('Advanced') ? options : deityDomains(c, entries)
    return <span className="feat-choice">
      <SearchableSelect aria-label={feat.name} value={feat.choice ?? ''} onChange={(e) => {
        const choice = e.target.value || undefined
        if (choice && !available.includes(choice)) return
        save({ feats: c.feats.map((f, i) => i === index ? { ...f, choice } : f) })
      }}>
        <option value="">Choose domain</option>
        {feat.choice && !options.includes(feat.choice) && <option disabled value={feat.choice}>{feat.choice}</option>}
        {options.map((domain) => <option key={domain} disabled={!available.includes(domain)}>{domain}</option>)}
      </SearchableSelect>
    </span>
  }
  const spellOptions = featSpellOptions(c, entries, feat)
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
