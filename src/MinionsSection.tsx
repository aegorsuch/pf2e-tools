import { Info, SourceNote } from './Info'
import { confirmRemoval } from './confirmRemoval'
import { ADVANCED_TYPES, companionAdvancement, companionStats, specializationOptions } from './companions'
import { ABILITY_LABEL, ABILITIES, isMagicHideActive, knowsSpell, magicHideChange, signed, type SectionProps } from './builder'
import { isCompanionAdvancement, isCompanionSpecialization } from './featChoices'
import { CompanionSpellOptions } from './SpellsSection'
import { newId } from './db'
import { SearchableSelect } from './SearchableSelect'

const RANK_LETTER = ['U', 'T', 'E', 'M', 'L']

export function MinionsSection({ c, entries, save }: SectionProps) {
  const companions = c.companions ?? []
  const magicHideKnown = knowsSpell(c, entries, 'Magic Hide')
  const types = entries.filter((e) => e.kind === 'companion').sort((a, b) => a.name.localeCompare(b.name))
  const advancement = companionAdvancement(c)
  const choices = c.feats.map((feat, featIndex) => ({ feat, featIndex }))
    .filter(({ feat }) => feat.level <= c.level && (isCompanionAdvancement(feat.name) || isCompanionSpecialization(feat.name)))
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
          {companions.length === 0 && c.feats.some((feat) => feat.name === 'Faithful Steed' && feat.level <= c.level) && <span>Faithful Steed{' '}
            <SearchableSelect aria-label="Choose Faithful Steed" value="" onChange={(e) => {
              const type = types.find((type) => type.name === e.target.value)
              if (type) save({ faithfulSteedGranted: true, companions: [{ id: newId(), type: type.name, name: '' }] })
            }}>
              <option value="">Choose companion...</option>
              {types.map((type) => <option key={type.id}>{type.name}</option>)}
            </SearchableSelect>
          </span>}
          {companions.map((comp, index) => {
            // Feats advance the first companion; any others stay young
            const stats = companionStats(c, entries, comp.type, index === 0 ? advancement : undefined, comp.id)
            const enlargeNote = stats?.enlarge ? `Enlarge Companion: ${stats.enlarge.size}; +${stats.enlarge.damage} status melee damage; +${stats.enlarge.reachIncrease} feet reach; clumsy 1.` : undefined
            const clumsyNote = stats?.clumsy ? '-1 Status (clumsy 1; Enlarge Companion)' : undefined
            const acNote = [stats?.magicHide ? '+1 Status (Magic Hide)' : undefined, clumsyNote].filter(Boolean).join('; ') || undefined
            const acSource = [stats?.magicHide ? 'Magic Hide' : undefined, stats?.clumsy ? 'Enlarge Companion' : undefined].filter(Boolean).join(', ')
            return (
              <article key={comp.id} className="gear-card">
                <header className="row">
                  <strong>{comp.name || comp.type}</strong>
                  <SearchableSelect aria-label="Companion type" value={comp.type} onChange={(e) => update(comp.id, { type: e.target.value })}>
                    {types.map((t) => <option key={t.id} value={t.name}>{t.name}{t.data.rarity && t.data.rarity !== 'common' ? ` (${t.data.rarity})` : ''}</option>)}
                  </SearchableSelect>
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
                        <SearchableSelect key={`${feat.name}:${featIndex}`} aria-label={advanced ? 'Companion advancement' : `Companion specialization ${featIndex + 1}`}
                          value={feat.choice ?? ''} onChange={(e) => setFeatChoice(featIndex, e.target.value)}>
                          <option value="">{advanced ? 'Choose advancement…' : 'Choose specialization…'}</option>
                          {feat.choice && !options.includes(feat.choice) && <option value={feat.choice}>{feat.choice}</option>}
                          {options.map((option) => <option key={option} value={option}>{option}</option>)}
                        </SearchableSelect>
                      )
                    })}
                  </div>
                )}
                {stats ? <>
                  {stats.auspice && <div className="row">
                    <label>Servitor{' '}
                      <select aria-label="Auspice servitor" value={comp.auspiceServitor ?? ''} onChange={(e) => {
                        const servitor = (['Celestial', 'Fiend', 'Monitor'] as const).find((type) => type === e.target.value)
                        update(comp.id, { auspiceServitor: servitor })
                      }}>
                        <option value="">Choose deity's servitor...</option>
                        {['Celestial', 'Fiend', 'Monitor'].map((type) => <option key={type}>{type}</option>)}
                      </select>
                    </label>
                    <label>Servitor language{' '}
                      <input aria-label="Auspice servitor language" value={comp.auspiceLanguage ?? ''}
                        onChange={(e) => update(comp.id, { auspiceLanguage: e.target.value })} />
                    </label>
                  </div>}
                  <div className="gear-traits">
                    <span>{index === 0 ? stage : 'Young'}</span><span>{stats.size}{enlargeNote && <SourceNote source="Enlarge Companion" note={enlargeNote} />}</span>
                    {index === 0 && [...advancement.specializations].sort((a, b) => a.localeCompare(b)).map((s) => <span key={s}>{s}</span>)}
                    {stats.mount && <span>Mount</span>}
                    {stats.grantedTraits.map((trait) => <span key={trait}>{trait}</span>)}
                  </div>
                  {stats.weakness && <small>Weakness: {stats.weakness}</small>}
                  <div className="gear-stats">
                    <span><small>Hit Points</small><b>{stats.hp}</b></span>
                    <span><small>Armor Class</small><b>{stats.ac}{acNote && <SourceNote source={acSource} note={acNote} inlineSource={false} />}</b></span>
                    <span><small>Perception</small><b>{signed(stats.perception)}</b></span>
                    <span><small>Fortitude</small>{signed(stats.fortitude)}</span>
                    <span><small>Reflex</small>{signed(stats.reflex)}{clumsyNote && <SourceNote source="Enlarge Companion" note={clumsyNote} />}</span>
                    <span><small>Will</small>{signed(stats.will)}</span>
                    {stats.enlarge && enlargeNote && <span><small>Reach bonus</small>+{stats.enlarge.reachIncrease} feet<SourceNote source="Enlarge Companion" note={enlargeNote} /></span>}
                  </div>
                  <div className="gear-stats">
                    {ABILITIES.map(k => <span key={k}><small>{ABILITY_LABEL[k]}</small>{signed(stats.mods[k])}</span>)}
                  </div>
                  <div><small>Speed</small> <span>{stats.speed}{stats.canopyCrawler
                    && <SourceNote source="Canopy Crawler" note="Climb Speed equal to highest Speed." />}</span>
                    {stats.speedBonuses.length > 0 && ` (${stats.speedBonuses.map((bonus) => `+${bonus.feet} ${bonus.source}`).join(', ')})`}
                    {stats.senses && <> · <small>Senses</small> {stats.senses}</>}</div>
                  {stats.ignoreDifficultTerrain > 0 && <small>Ignores the first {stats.ignoreDifficultTerrain} feet of difficult terrain each turn (Chiardmar Steed).</small>}
                  {stats.attacks.map((a) => (
                    <div key={a.name}><b>{a.name}</b> <span>{signed(a.attack)}{a.dexterityBased && clumsyNote
                      && <SourceNote source="Enlarge Companion" note={clumsyNote} />}</span> {a.traits && <small>({a.traits})</small>} — <span>{a.damage}{!a.ranged && enlargeNote
                      && <SourceNote source="Enlarge Companion" note={enlargeNote} />}</span></div>
                  ))}
                  {stats.skills.length > 0 && <div><small>Skills</small> {stats.skills.map((s, index) => <span key={s.name}>
                    {index > 0 && ', '}{s.name} {signed(s.bonus)}{s.clumsy && clumsyNote
                      && <SourceNote source="Enlarge Companion" note={clumsyNote} />} ({RANK_LETTER[s.rank]})
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
