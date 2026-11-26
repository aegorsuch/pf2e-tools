import { SearchableSelect } from './SearchableSelect'
import type { SectionProps } from './builder'
import { TECHNOMANCER_LANGUAGE_RULES, TECHNOMANCER_PROGRAMMING_LANGUAGES } from './technomancer'

export function TechnomancerFeatures({ c, save }: SectionProps) {
  if (!c.systems.includes('sf2e') || c.className !== 'Technomancer') return null
  const language = c.technomancerProgrammingLanguage
  const rules = language ? TECHNOMANCER_LANGUAGE_RULES[language] : undefined
  return <>
    <SearchableSelect label="Programming Language" aria-label="Technomancer Programming Language" value={language ?? ''}
      onChange={event => {
        const selected = TECHNOMANCER_PROGRAMMING_LANGUAGES.find(option => option === event.target.value)
        save({ technomancerProgrammingLanguage: selected })
      }}>
      <option value="">Choose programming language</option>
      {TECHNOMANCER_PROGRAMMING_LANGUAGES.map(option => <option key={option} value={option}>{option}</option>)}
    </SearchableSelect>
    {rules && <details className="character-subsection">
      <summary>{language} programming language benefits</summary>
      <p><strong>Overclock gear:</strong> {rules.gear}</p>
      <p><strong>Spell cache:</strong> {rules.spellCache.map((spell, index) => `${index + 1}: ${spell}`).join('; ')}</p>
      <p><strong>Initial magic hack:</strong> {rules.initialHack}</p>
      <p><strong>Spellshape:</strong> {rules.spellshape}</p>
      <p><strong>Firmware enhancement:</strong> {rules.firmware}</p>
      <p><strong>Overclock boost:</strong> {rules.overclockBoost}</p>
      <p><strong>Overclock pulse:</strong> {rules.overclockPulse}</p>
      <p><strong>Jailbreak (level 3):</strong> {rules.jailbreak}</p>
      <p><strong>Advanced Jailbreak (level 8):</strong> {rules.advancedJailbreak}</p>
    </details>}
  </>
}
