import { Info } from './Info'
import { confirmRemoval } from './confirmRemoval'
import { ADVANCED_TYPES, companionAdvancement, companionStats, specializationOptions } from './companions'
import { isMagicHideActive, knowsSpell, magicHideChange, signed, type SectionProps } from './builder'
import { isCompanionAdvancement, isCompanionSpecialization } from './featChoices'
import { CompanionSpellOptions } from './SpellsSection'
import { newId } from './db'

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
          {companions.length === 0 && c.feats.some((feat) => feat.name === 'Faithful Steed' && feat.level <= c.level) && <label>Faithful Steed{' '}
            <select aria-label="Choose Faithful Steed" value="" onChange={(e) => {
              const type = types.find((type) => type.name === e.target.value)
              if (type) save({ faithfulSteedGranted: true, companions: [{ id: newId(), type: type.name, name: '' }] })
            }}>
              <option value="">Choose companion...</option>
              {types.map((type) => <option key={type.id}>{type.name}</option>)}
            </select>
          </label>}
          {companions.map((comp, index) => {
            // Feats advance the first companion; any others stay young
            const stats = companionStats(c, entries, comp.type, index === 0 ? advancement : undefined, comp.id)
            const enlargeNote = stats?.enlarge ? `Enlarge Companion: ${stats.enlarge.size}; +${stats.enlarge.damage} status melee damage; +${stats.enlarge.reachIncrease} feet reach; clumsy 1.` : undefined
            const clumsyNote = stats?.clumsy ? '-1 Status (clumsy 1; Enlarge Companion)' : undefined
            const acNote = [stats?.magicHide ? '+1 Status (Magic Hide)' : undefined, clumsyNote].filter(Boolean).join('; ') || undefined
            return (
              <article key={comp.id} className="gear-card">
                <header className="row">
                  <strong>{comp.name || comp.type}</strong>
                  <select aria-label="Companion type" value={comp.type} onChange={(e) => update(comp.id, { type: e.target.value })}>
                    {types.map((t) => <option key={t.id} value={t.name}>{t.name}{t.data.rarity && t.data.rarity !== 'common' ? ` (${t.data.rarity})` : ''}</option>)}
                  </select>
                  <button type="button" className="spell-remove" aria-label={`Remove ${comp.name || comp.type}`} title="Remove"
                    onClick={() => confirmRemoval(`companion "${comp.name || comp.type}"`, () => save({ companions: companions.filter((x) => x.id !== comp.id) }))}>×</button>
                </header>
                {magicHideKnown && <label><input type="checkbox" aria-label={`Magic Hide on ${comp.name || comp.type}`} checked={isMagicHideActive(c, entries, comp.id)}
                  onChange={(e) => save(magicHideChange(c, e.target.checked, comp.id))} /> Magic Hide</label>}
                {(['Canopy Crawler', 'Enlarge Companion'] as const).filter((name) => knowsSpell(c, entries, name)).map((name) =>
                  <CompanionSpellOptions key={name} c={c} entries={entries} save={save} name={name} companionId={comp.id} />)}
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
                    <span>{index === 0 ? stage : 'Young'}</span><span title={enlargeNote}>{stats.size}{!!stats.enlarge && '*'}</span>
                    {index === 0 && [...advancement.specializations].sort((a, b) => a.localeCompare(b)).map((s) => <span key={s}>{s}</span>)}
                    {stats.mount && <span>Mount</span>}
                  </div>
                  <div className="gear-stats">
                    <span><small>Level</small><b>{stats.level}</b></span>
                    <span><small>HP</small><b>{stats.hp}</b></span>
                    <span><small>AC</small><b title={acNote}>{stats.ac}{!!acNote && '*'}</b></span>
                    <span><small>Perception</small><b>{signed(stats.perception)}</b></span>
                    <span><small>Fort</small>{signed(stats.fortitude)}</span>
                    <span title={clumsyNote}><small>Ref</small>{signed(stats.reflex)}{!!stats.clumsy && '*'}</span>
                    <span><small>Will</small>{signed(stats.will)}</span>
                    {stats.enlarge && <span title={enlargeNote}><small>Reach bonus</small>+{stats.enlarge.reachIncrease} feet*</span>}
                  </div>
                  <div className="gear-stats">
                    {(Object.keys(ABILITY_NAMES) as (keyof typeof ABILITY_NAMES)[]).map((k) => <span key={k}><small>{ABILITY_NAMES[k]}</small>{signed(stats.mods[k])}</span>)}
                  </div>
                  <div><small>Speed</small> <span title={stats.canopyCrawler ? 'Climb Speed equal to highest Speed (Canopy Crawler)' : undefined}>{stats.speed}{stats.canopyCrawler && '*'}</span>
                    {stats.speedBonuses.length > 0 && ` (${stats.speedBonuses.map((bonus) => `+${bonus.feet} ${bonus.source}`).join(', ')})`}
                    {stats.senses && <> · <small>Senses</small> {stats.senses}</>}</div>
                  {stats.attacks.map((a) => (
                    <div key={a.name}><b>{a.name}</b> <span title={a.dexterityBased ? clumsyNote : undefined}>{signed(a.attack)}{a.dexterityBased && !!stats.clumsy && '*'}</span> {a.traits && <small>({a.traits})</small>} — <span title={!a.ranged ? enlargeNote : undefined}>{a.damage}{!a.ranged && !!stats.enlarge && '*'}</span></div>
                  ))}
                  {stats.skills.length > 0 && <div><small>Skills</small> {stats.skills.map((s, index) => <span key={s.name} title={s.clumsy ? clumsyNote : undefined}>
                    {index > 0 && ', '}{s.name} {signed(s.bonus)}{s.clumsy && '*'} ({RANK_LETTER[s.rank]})
                  </span>)}</div>}
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
