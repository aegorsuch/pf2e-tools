import type { SpellDefense } from './spellDefense'

export function SpellDefenseFilter({ value, onChange }: { value: SpellDefense; onChange: (value: SpellDefense) => void }) {
  return <select aria-label="Spell defense" value={value} onChange={event => {
    const choice = event.target.value
    if (choice === 'all' || choice === 'ac' || choice === 'save'
      || choice === 'fortitude' || choice === 'reflex' || choice === 'will') onChange(choice)
  }}>
    <option value="all">All defenses</option>
    <option value="ac">AC</option>
    <option value="save">Any save</option>
    <option value="fortitude">Fortitude</option>
    <option value="reflex">Reflex</option>
    <option value="will">Will</option>
  </select>
}
