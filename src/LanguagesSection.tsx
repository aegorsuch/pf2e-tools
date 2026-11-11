import { languageAllowance, languageGroups, type SectionProps } from './builder'

export function LanguagesSection({ c, entries, save }: SectionProps) {
  const { locked, slots } = languageAllowance(c, entries)
  const groups = languageGroups(entries)
  const lockedKeys = new Set(locked.map((l) => l.toLowerCase()))
  const listed = new Set(Object.values(groups).flat().map(([l]) => l.toLowerCase()))
  const picked = c.languages.filter((l) => !lockedKeys.has(l.toLowerCase()))
  const custom = picked.filter((l) => !listed.has(l.toLowerCase()))
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
      {Object.entries(groups).map(([category, langs]) => (
        <fieldset key={category}>
          <legend>{category} Languages</legend>
          <div className="language-grid">
            {langs.map(([lang, who]) => {
              const isLocked = lockedKeys.has(lang.toLowerCase())
              const on = isLocked || picked.some((l) => l.toLowerCase() === lang.toLowerCase())
              return (
                <label key={lang}>
                  <input type="checkbox" checked={on} disabled={isLocked || grantOnly.has(lang.toLowerCase()) || (!on && left <= 0)} onChange={() => toggle(lang)} /> {lang} {who && who !== lang && <small>({who})</small>}
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
    </div>
  )
}
