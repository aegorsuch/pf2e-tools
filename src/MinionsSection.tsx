import { Info } from './Info'
import { confirmRemoval } from './confirmRemoval'
import { ADVANCED_TYPES, companionAdvancement, companionStats, specializationOptions } from './companions'
import { knowsSpell, signed, type SectionProps } from './builder'
import { isCompanionAdvancement, isCompanionSpecialization } from './featChoices'

const RANK_LETTER = ['U', 'T', 'E', 'M', 'L']
const ABILITY_NAMES = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' } as const

export function MinionsSection({ c, entries, save }: SectionProps) {
  const companions = c.companions ?? []
  const magicHideKnown = knowsSpell(c, entries, 'Magic Hide')
  const types = entries.filter((e) => e.kind === 'companion').sort((a, b) => a.name.localeCompare(b.name))
  const advancement = companionAdvancement(c)
  const choices = c.feats.map((feat, featIndex) => ({ feat, featIndex }))
    .filter(({ feat }) => isCompanionAdvancement(feat.name) || isCompanionSpecialization(feat.name))
    .sort((a, b) => Number(isCompanionAdvancement(b.feat.name)) - Number(isCompanionAdvancement(a.feat.name))
      || Number(!a.feat.choice) - Number(!b.feat.choice)
      || (a.feat.choice ?? '').localeCompare(b.feat.choice ?? ''))
  const update = (id: string, patch: Partial<NonNullable<typeof c.companions>[number]>) =>
    save({ companions: companions.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
  const setFeatChoice = (featIndex: number, choice: string) =>
    save({ feats: c.feats.map((feat, i) => i === featIndex ? { ...feat, choice: choice || undefined } : feat) })
  const stage = [advancement.advanced, advancement.mature ? 'Mature' : 'Young'].find(Boolean)

  return (
    <details className="character-section">
      <summary className="character-section-summary">
        <strong>Minions</strong>
        <span>{companions.length} animal companion{companions.length === 1 ? '' : 's'}</span>
      </summary>
      <div className="character-section-content">
        <details className="character-subsection" open>
          <summary><h4>Animal Companions ({companions.length})</h4></summary>
          {companions.map((comp, index) => {
            // Feats advance the first companion; any others stay young
            const stats = companionStats(c, entries, comp.type, index === 0 ? advancement : undefined, comp.id)
            return (
              <article key={comp.id} className="gear-card">
                <header className="row">
                  <input aria-label="Companion name" placeholder={comp.type} value={comp.name} onChange={(e) => update(comp.id, { name: e.target.value })} />
                  <select aria-label="Companion type" value={comp.type} onChange={(e) => update(comp.id, { type: e.target.value })}>
                    {types.map((t) => <option key={t.id} value={t.name}>{t.name}{t.data.rarity && t.data.rarity !== 'common' ? ` (${t.data.rarity})` : ''}</option>)}
                  </select>
                  <button type="button" className="spell-remove" aria-label={`Remove ${comp.name || comp.type}`} title="Remove"
                    onClick={() => confirmRemoval(`companion "${comp.name || comp.type}"`, () => save({ companions: companions.filter((x) => x.id !== comp.id) }))}>×</button>
                </header>
                {magicHideKnown && <label><input type="checkbox" aria-label={`Magic Hide on ${comp.name || comp.type}`} checked={!!stats?.magicHide}
                  onChange={(e) => save({ magicHideCompanionId: comp.id,
                    activeSpells: [...(c.activeSpells ?? []).filter((name) => name !== 'Magic Hide'), ...(e.target.checked ? ['Magic Hide'] : [])] })} /> Magic Hide (+1 status AC)</label>}
                {index === 0 && choices.length > 0 && (
                  <div className="row companion-choices">
                    {choices.map(({ feat, featIndex }) => {
                      const advanced = isCompanionAdvancement(feat.name)
                      const options: string[] = advanced ? [...ADVANCED_TYPES] : specializationOptions(c, entries, featIndex)
                      return (
                        <select key={`${feat.name}:${featIndex}`} aria-label={advanced ? 'Companion advancement' : `Companion specialization ${featIndex + 1}`}
                          value={feat.choice ?? ''} onChange={(e) => setFeatChoice(featIndex, e.target.value)}>
                          <option value="">{advanced ? 'Choose advancement…' : 'Choose specialization…'}</option>
                          {feat.choice && !options.includes(feat.choice) && <option value={feat.choice}>{feat.choice}</option>}
                          {options.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      )
                    })}
                  </div>
                )}
                {stats ? <>
                  <div className="gear-traits">
                    <span>{index === 0 ? stage : 'Young'}</span><span>{stats.size}</span>
                    {index === 0 && [...advancement.specializations].sort((a, b) => a.localeCompare(b)).map((s) => <span key={s}>{s}</span>)}
                    {stats.mount && <span>Mount</span>}
                  </div>
                  <div className="gear-stats">
                    <span><small>Level</small><b>{stats.level}</b></span>
                    <span><small>HP</small><b>{stats.hp}</b></span>
                    <span><small>AC</small><b>{stats.ac}</b></span>
                    <span><small>Perception</small><b>{signed(stats.perception)}</b></span>
                    <span><small>Fort</small>{signed(stats.fortitude)}</span>
                    <span><small>Ref</small>{signed(stats.reflex)}</span>
                    <span><small>Will</small>{signed(stats.will)}</span>
                  </div>
                  <div className="gear-stats">
                    {(Object.keys(ABILITY_NAMES) as (keyof typeof ABILITY_NAMES)[]).map((k) => <span key={k}><small>{ABILITY_NAMES[k]}</small>{signed(stats.mods[k])}</span>)}
                  </div>
                  <div><small>Speed</small> {stats.speed}{stats.senses && <> · <small>Senses</small> {stats.senses}</>}</div>
                  {stats.attacks.map((a) => (
                    <div key={a.name}><b>{a.name}</b> {signed(a.attack)} {a.traits && <small>({a.traits})</small>} — {a.damage}</div>
                  ))}
                  {stats.skills.length > 0 && <div><small>Skills</small> {stats.skills.map((s) => `${s.name} ${signed(s.bonus)} (${RANK_LETTER[s.rank]})`).join(', ')}</div>}
                  {stats.support && <Info label="Support benefit">{stats.support}</Info>}
                  {stats.maneuver && (index === 0 && (advancement.advanced) ? <div><small>Advanced maneuver</small> {stats.maneuver}</div> : <Info label="Advanced maneuver">{stats.maneuver}</Info>)}
                  {stats.entry.description && <Info label="About">{stats.entry.description}</Info>}
                </> : <small>Companion data is still loading.</small>}
              </article>
            )
          })}
        </details>
      </div>
    </details>
  )
}
