import type { Effect } from './types'
import { confirmRemoval } from './confirmRemoval'

const defaults: Record<Effect['type'], Effect> = {
  sense: { type: 'sense', sense: 'darkvision' },
  bonus: { type: 'bonus', target: 'ac', bonusType: 'item', value: 1 },
  proficiency: { type: 'proficiency', target: 'perception', rank: 'trained' },
  speed: { type: 'speed', movement: 'fly', feet: 25 },
  resistance: { type: 'resistance', damage: 'fire', value: 5 },
  language: { type: 'language', name: '' },
  featSlot: { type: 'featSlot', category: 'general', level: 1, count: 1 },
  grant: { type: 'grant', entryId: '' },
}

const FIELDS: Record<Effect['type'], string[]> = {
  sense: ['sense', 'range'],
  bonus: ['target', 'bonusType', 'value'],
  proficiency: ['target', 'rank'],
  speed: ['movement', 'feet'],
  resistance: ['damage', 'value'],
  language: ['name'],
  featSlot: ['category', 'level', 'count'],
  grant: ['entryId'],
}

const NUMERIC = new Set(['range', 'value', 'feet', 'level', 'count'])

export function EffectsEditor({ effects, onChange }: { effects: Effect[]; onChange: (e: Effect[]) => void }) {
  const update = (i: number, key: string, v: string) =>
    onChange(effects.map((e, j) => (j === i ? ({ ...e, [key]: NUMERIC.has(key) ? +v : v } as Effect) : e)))

  return (
    <fieldset>
      <legend>Effects</legend>
      {effects.map((e, i) => (
        <div className="row" key={i}>
          <b>{e.type}</b>
          {FIELDS[e.type].map((f) => (
            <input key={f} placeholder={f} title={f}
              type={NUMERIC.has(f) ? 'number' : 'text'}
              value={(e as unknown as Record<string, string | number>)[f] ?? ''}
              onChange={(ev) => update(i, f, ev.target.value)} />
          ))}
          <button type="button" onClick={() => confirmRemoval(`"${e.type}" effect`, () => onChange(effects.filter((_, j) => j !== i)))}>Remove</button>
        </div>
      ))}
      <select value="" onChange={(ev) => ev.target.value && onChange([...effects, defaults[ev.target.value as Effect['type']]])}>
        <option value="">+ Add effect...</option>
        {(Object.keys(defaults) as Effect['type'][]).map((t) => <option key={t}>{t}</option>)}
      </select>
    </fieldset>
  )
}
