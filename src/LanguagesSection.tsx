import { useState } from 'react'
import { featTakenLevel, languageAllowance, languageGroups, type SectionProps } from './builder'
import { SearchableSelect } from './SearchableSelect'

export function AncestralLinguisticsChoice({ c, entries, save, index }: SectionProps & { index: number }) {
  const feat = c.feats[index]
  const known = new Set([...languageAllowance(c, entries).locked, ...c.languages].map(language => language.toLowerCase()))
  const options = Object.entries(languageGroups(entries)).flatMap(([rarity, languages]) =>
    languages.filter(([name]) => !known.has(name.toLowerCase())).map(([name]) => ({ name, rarity })))
  return <span className="feat-choice feat-choice-with-note">
    <SearchableSelect label="Ancestral Linguistics daily language" aria-label="Ancestral Linguistics daily language" value={feat.choice ?? ''} onChange={event => {
      const choice = event.target.value
      if (choice && !options.some(option => option.name === choice)) return
      save({ feats: c.feats.map((existing, i) => i === index ? { ...existing, choice: choice || undefined } : existing) })
    }}>
      <option value="">Choose language</option>
      {feat.choice && !options.some(option => option.name === feat.choice) && <option disabled value={feat.choice}>{feat.choice}</option>}
      {options.map(option => <option key={option.name} value={option.name}>{option.name} ({option.rarity})</option>)}
    </SearchableSelect>
    <small>Temporary until daily preparations; confirm access to non-common languages. Cannot satisfy permanent prerequisites.</small>
  </span>
}

export function LanguagesSection({ c, entries, save }: SectionProps) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const { locked, slots, sources } = languageAllowance(c, entries)
  const groups = languageGroups(entries)
  const lockedKeys = new Set(locked.map((l) => l.toLowerCase()))
  const listed = new Set(Object.values(groups).flat().map(([l]) => l.toLowerCase()))
  const picked = c.languages.filter((l) => !lockedKeys.has(l.toLowerCase()))
  const custom = picked.filter((l) => !listed.has(l.toLowerCase()) && (!q || l.toLowerCase().includes(q)))
  const shown = Object.entries(groups).map(([category, langs]) => ({
    category, langs: langs.filter(([lang, who]) => !q || `${lang} ${who}`.toLowerCase().includes(q)),
  })).filter(group => group.langs.length)
  const grantOnly = new Set(['wildsong'])
  const left = slots - picked.length
  const toggle = (lang: string) => {
    const on = picked.some((l) => l.toLowerCase() === lang.toLowerCase())
    if (!on && left <= 0) return
    const next = on ? picked.filter((l) => l.toLowerCase() !== lang.toLowerCase()) : [...picked, lang]
    save({ languages: [...locked, ...next] })
  }
  return (
    <div className="col language-picker">
      {c.feats.map((feat, index) => feat.name === 'Ancestral Linguistics' && featTakenLevel(feat) <= c.level
        ? <AncestralLinguisticsChoice key={feat.slot ?? index} c={c} entries={entries} save={save} index={index} /> : null)}
      <label>Search languages{' '}
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      {shown.map(({ category, langs }) => (
        <fieldset key={category}>
          <legend>{category} Languages</legend>
          <div className="language-grid">
            {langs.map(([lang, who]) => {
              const isLocked = lockedKeys.has(lang.toLowerCase())
              const on = isLocked || picked.some((l) => l.toLowerCase() === lang.toLowerCase())
              return (
                <label key={lang}>
                  <input type="checkbox" checked={on} disabled={isLocked || grantOnly.has(lang.toLowerCase()) || (!on && left <= 0)} onChange={() => toggle(lang)} /> {lang} {sources[lang.toLowerCase()] ? <small>({sources[lang.toLowerCase()]})</small> : who && who !== lang && <small>({who})</small>}
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}
      {custom.length > 0 && (
        <fieldset>
          <legend>Other</legend>
          <div className="language-grid">
            {custom.map((lang) => (
              <label key={lang}><input type="checkbox" checked onChange={() => toggle(lang)} /> {lang}</label>
            ))}
          </div>
        </fieldset>
      )}
      {q && !shown.length && !custom.length && <small role="status">No matching languages.</small>}
    </div>
  )
}
