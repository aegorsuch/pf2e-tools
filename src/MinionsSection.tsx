import { Info, SourceNote } from './Info'
import { confirmRemoval } from './confirmRemoval'
import { ADVANCED_TYPES, companionAdvancement, companionStats, specializationOptions } from './companions'
import { ABILITY_LABEL, ABILITIES, activeFeatsNamed, armorClassBreakdown, featTakenLevel, isMagicHideActive, knowsSpell, magicHideChange, ranksAt, savingThrowBreakdown, signed, type SectionProps, type TotalBreakdown } from './builder'
import { isCompanionAdvancement, isCompanionSpecialization } from './featChoices'
import { CompanionSpellOptions } from './SpellsSection'
import { newId } from './db'
import { SearchableSelect } from './SearchableSelect'

const RANK_LETTER = ['U', 'T', 'E', 'M', 'L']
const PET_ABILITIES = ['Amphibious', 'Burrower', 'Climber', 'Darkvision', 'Echolocation', 'Fast Movement', 'Flier', 'Manual Dexterity', 'Scent', 'Tough']
const PET_ABILITY_NOTES: Record<string, string> = {
  Amphibious: 'Breathes air and water; land and swim Speeds equal highest land or swim Speed.',
  Burrower: 'Burrow Speed 5 feet; can dig Tiny holes.',
  Climber: 'Climb Speed 25 feet.',
  Darkvision: 'Darkvision.',
  Echolocation: 'Precise hearing within 20 feet.',
  'Fast Movement': 'Increase one 25-foot Speed to 40 feet.',
  Flier: 'Fly Speed 25 feet.',
  'Manual Dexterity': 'Can use up to two limbs as hands for manipulate actions.',
  Scent: 'Imprecise scent within 30 feet.',
  Tough: 'Maximum HP increases by 2 per level.',
}

export function MinionsSection({ c, entries, save }: SectionProps) {
  const companions = c.companions ?? []
  const magicHideKnown = knowsSpell(c, entries, 'Magic Hide')
  const types = entries.filter((e) => e.kind === 'companion').sort((a, b) => a.name.localeCompare(b.name))
  const advancement = companionAdvancement(c)
  const leshy = activeFeatsNamed(c, 'Leshy Familiar').length > 0
  const familiar = leshy || c.className === 'Witch' || ['Animal Accomplice', 'Familiar'].some(name => activeFeatsNamed(c, name).length > 0)
  const familiarCapacity = (activeFeatsNamed(c, 'Incredible Familiar').length ? 6 : activeFeatsNamed(c, 'Enhanced Familiar').length ? 4 : 2)
    + (c.className === 'Witch' ? 2 + [6, 12, 18].filter(level => c.level >= level).length : 0)
  const familiarAbilities = (c.familiar?.abilities ?? []).slice(0, familiarCapacity).filter(Boolean)
  const familiarTough = familiarAbilities.some(ability => ability.trim().toLowerCase() === 'tough')
  const familiarDefense = familiar ? (() => {
    const base = (breakdown: TotalBreakdown) => breakdown.parts
      .filter(part => !/\((?:circumstance|status)\)/i.test(part.label)).reduce((sum, part) => sum + part.value, 0)
    const ranks = ranksAt(c, entries)
    return { ac: base(armorClassBreakdown(c, entries)), fortitude: base(savingThrowBreakdown(c, entries, 'Fortitude', ranks)),
      reflex: base(savingThrowBreakdown(c, entries, 'Reflex', ranks)), will: base(savingThrowBreakdown(c, entries, 'Will', ranks)) }
  })() : undefined
  const familiarSecrets = familiar && activeFeatsNamed(c, 'Leshy Familiar Secrets').length > 0
  const highestSlot = Math.max(c.className === 'Druid' ? Math.ceil(c.level / 2) : 0,
    ...Object.entries(c.spellcasting?.slots ?? {}).filter(([rank, count]) => Number(rank) >= 1 && count > 0).map(([rank]) => Number(rank)), 0)
  const seaFriend = activeFeatsNamed(c, 'Friend of the Sea').length > 0
  const pet = seaFriend || activeFeatsNamed(c, 'Pet').length > 0
    || activeFeatsNamed(c, 'Beast Trainer').some(feat => feat.choice === 'Pet')
  const petAbilities = c.pet?.abilities ?? []
  const choices = c.feats.map((feat, featIndex) => ({ feat, featIndex }))
    .filter(({ feat }) => featTakenLevel(feat) <= c.level && (isCompanionAdvancement(feat.name) || isCompanionSpecialization(feat.name)))
    .sort((a, b) => Number(isCompanionAdvancement(b.feat.name)) - Number(isCompanionAdvancement(a.feat.name))
      || (isCompanionAdvancement(a.feat.name) && isCompanionAdvancement(b.feat.name)
        ? Number(!ADVANCED_TYPES.some(type => type === a.feat.choice)) - Number(!ADVANCED_TYPES.some(type => type === b.feat.choice))
        : Number(!a.feat.choice) - Number(!b.feat.choice) || (a.feat.choice ?? '').localeCompare(b.feat.choice ?? '')))
    .filter(({ feat }, index, all) => !isCompanionAdvancement(feat.name)
      || all.findIndex(({ feat: other }) => isCompanionAdvancement(other.name)) === index)
  const update = (id: string, patch: Partial<NonNullable<typeof c.companions>[number]>) =>
    save({ companions: companions.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
  const setFeatChoice = (featIndex: number, choice: string) =>
    save({ feats: c.feats.map((feat, i) => i === featIndex ? { ...feat, choice: choice || undefined } : feat) })
  const stage = [advancement.advanced, advancement.mature ? 'Mature' : 'Young'].find(Boolean)

  return (
    <details className="character-section">
      <summary className="character-section-summary">
        <strong>Minions</strong>
        <span>{[...companions.map((comp, index) => `${index === 0 ? stage : 'Young'} ${comp.type}${comp.name ? ` (${comp.name})` : ''}`),
          ...(familiar ? [leshy ? 'Leshy Familiar' : 'Familiar'] : []), ...(pet ? [seaFriend ? 'Aquatic Pet' : 'Pet'] : [])].join(', ') || '0 minions'}</span>
      </summary>
      <div className="character-section-content">
        <details className="character-subsection" open>
          <summary><h4>Animal Companions ({companions.length})</h4></summary>
          {companions.length === 0 && activeFeatsNamed(c, 'Faithful Steed').length > 0 && <span>Faithful Steed{' '}
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
                {index === 0 && activeFeatsNamed(c, 'Faithful Steed').length > 0 && activeFeatsNamed(c, 'Pale Horse').length > 0
                  && <label>Pale Horse{' '}
                    <select aria-label="Pale Horse mounted damage type" value={comp.paleHorse ?? ''} onChange={event => {
                      const choice = (['Fire', 'Poison', 'Void'] as const).find(type => type === event.target.value)
                      update(comp.id, { paleHorse: choice })
                    }}>
                      <option value="">Not mounted</option>
                      {['Fire', 'Poison', 'Void'].map(type => <option key={type}>{type}</option>)}
                    </select>
                  </label>}
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
                  {stats.paleHorse && <div><small>Resistance</small> {stats.paleHorse.damage} {stats.paleHorse.resistance} (Pale Horse).
                    Creatures touching or hitting the steed with an adjacent melee Strike take {stats.paleHorse.retaliation} {stats.paleHorse.damage.toLowerCase()} damage.</div>}
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
                  {stats.stealthyCompanion && <div><small>Camouflage</small> In natural terrain, your companion can Hide and Sneak without cover or concealment.</div>}
                  {stats.primalHowl && <div><small>Advanced maneuver</small> <b>Primal Howl</b> (2 actions, primal, sonic; once per hour): 30-foot cone, {stats.primalHowl} sonic damage, basic Fortitude save against your spell DC; frightened 1 on a failure or frightened 2 on a critical failure. The fright is an emotion, fear, and mental effect.</div>}
                  {stats.entry.description && <Info label="About">{stats.entry.description}</Info>}
                </> : <small>Companion data is still loading.</small>}
              </article>
            )
          })}
        </details>
        {familiar && <details className="character-subsection" open>
          <summary><h4>{leshy ? 'Leshy Familiar' : 'Familiar'}</h4></summary>
          <label>Name <input aria-label="Familiar name" value={c.familiar?.name ?? ''}
            onChange={event => save({ familiar: { ...c.familiar, name: event.target.value } })} /></label>
          <div><small>Hit Points</small> <b>{c.level * (familiarTough ? 7 : 5)}</b>{familiarTough && ' (includes Tough)'}</div>
          {familiarDefense && <>
            <div className="gear-stats">
              <span><small>Armor Class</small><b>{familiarDefense.ac}</b></span>
              <span><small>Fortitude</small>{signed(familiarDefense.fortitude)}</span>
              <span><small>Reflex</small>{signed(familiarDefense.reflex)}</span>
              <span><small>Will</small>{signed(familiarDefense.will)}</span>
            </div>
            <small>Uses your AC and saves before your circumstance and status modifiers.</small>
          </>}
          {leshy && <label>Granted ability{' '}
            <select aria-label="Leshy familiar granted ability" value={c.familiar?.leshyAbility ?? ''} onChange={event => {
              const value = event.target.value
              save({ familiar: { ...c.familiar, leshyAbility: value === 'Plant' || value === 'Fungus' ? value : undefined } })
            }}>
              <option value="">Choose ability</option><option>Plant</option><option>Fungus</option>
            </select> <small>Does not count against daily choices.</small>
          </label>}
          <div><small>Daily familiar or master abilities ({familiarAbilities.length}/{familiarCapacity})</small></div>
          {Array.from({ length: familiarCapacity }, (_, index) => <label key={index}>Ability {index + 1}{' '}
            <input aria-label={`Familiar ability ${index + 1}`} value={c.familiar?.abilities?.[index] ?? ''}
              onChange={event => {
                const abilities = Array.from({ length: Math.max(c.familiar?.abilities?.length ?? 0, index + 1) },
                  (_, i) => c.familiar?.abilities?.[i] ?? '')
                abilities[index] = event.target.value
                save({ familiar: { ...c.familiar, abilities } })
              }} />
          </label>)}
          <small>Enter familiar or master abilities selected during daily preparations; verify eligibility and effects against their rules.</small>
          {familiarAbilities.filter((ability, index) => familiarAbilities.findIndex(other => other.trim().toLowerCase() === ability.trim().toLowerCase()) === index)
            .flatMap(ability => {
              const name = PET_ABILITIES.find(option => option.toLowerCase() === ability.trim().toLowerCase())
              return name && name !== 'Tough' ? [<small key={name}>{name}: {PET_ABILITY_NOTES[name]}</small>] : []
            })}
          {familiarSecrets && <div className="col">
            <label>Leshy Familiar Secrets{' '}
              <select aria-label="Leshy Familiar Secrets ability" value={c.familiar?.leshySecret ?? ''} onChange={event => {
                const value = event.target.value
                if (value === 'Verdant Burst' && highestSlot < 2) return
                if (value && !['Grasping Tendrils', 'Purify Air', 'Verdant Burst'].includes(value)) return
                save({ familiar: { ...c.familiar, leshySecret: value === 'Grasping Tendrils' || value === 'Purify Air'
                  || value === 'Verdant Burst' ? value : undefined } })
              }}>
                <option value="">Choose one extra ability</option>
                <option>Grasping Tendrils</option><option>Purify Air</option>
                <option disabled={highestSlot < 2}>Verdant Burst</option>
              </select>
            </label>
            {c.familiar?.leshySecret === 'Grasping Tendrils' && <small>Familiar reach 15 feet.</small>}
            {c.familiar?.leshySecret === 'Purify Air' && <small>Recycles air for one Medium creature; +2 circumstance to saves against inhaled effects within 15 feet, at GM discretion.</small>}
            {c.familiar?.leshySecret === 'Verdant Burst' && (highestSlot >= 2
              ? <small>On familiar death, three-action Heal at rank {highestSlot - 1}; plants regain an additional {2 * (highestSlot - 1)} HP.</small>
              : <small>Verdant Burst requires a 2nd-rank spell slot.</small>)}
          </div>}
          {c.className === 'Witch' && <small>One ability must be your patron's unique familiar ability.</small>}
          {leshy && activeFeatsNamed(c, 'Grown of Oak').length > 0 && knowsSpell(c, entries, 'Oaken Resilience') && <>
            <label><input type="checkbox" aria-label="Oaken Resilience active on leshy familiar" checked={!!c.familiar?.oakenResilienceActive}
              onChange={event => save({ familiar: { ...c.familiar, oakenResilienceActive: event.target.checked } })} /> Oaken Resilience active on leshy familiar</label>
            {c.familiar?.oakenResilienceActive && <>
              <label>Cast rank <select aria-label="Leshy familiar Oaken Resilience cast rank" value={c.familiar.oakenResilienceRank ?? ''}
                onChange={event => {
                  const rank = Number(event.target.value)
                  save({ familiar: { ...c.familiar, oakenResilienceRank: Number.isInteger(rank) && rank >= 2 && rank <= 10 ? rank : undefined } })
                }}><option value="">Choose cast rank</option>
                {Array.from({ length: 9 }, (_, i) => i + 2).map(rank => <option key={rank} value={rank}>{rank}</option>)}
              </select></label>
              {Number.isInteger(c.familiar.oakenResilienceRank) && c.familiar.oakenResilienceRank! >= 2 && c.familiar.oakenResilienceRank! <= 10
                ? <small>Bludgeoning and piercing resistance {2 * (1 + Math.floor((c.familiar.oakenResilienceRank! - 2) / 2))}; fire weakness {3 * (1 + Math.floor((c.familiar.oakenResilienceRank! - 2) / 2))}.</small>
                : <small>Choose the cast rank to calculate effects.</small>}
            </>}
            <small>Grown of Oak targets your leshy familiar only if within 30 feet when cast.</small>
          </>}
        </details>}
        {pet && <details className="character-subsection" open>
          <summary><h4>{seaFriend ? 'Aquatic Pet' : 'Pet'}</h4></summary>
          <label>Name <input aria-label="Pet name" value={c.pet?.name ?? ''}
            onChange={event => save({ pet: { ...c.pet, name: event.target.value } })} /></label>
          {!seaFriend && <label><input type="checkbox" aria-label="Aquatic pet" checked={!!c.pet?.aquatic}
            onChange={event => save({ pet: { ...c.pet, aquatic: event.target.checked } })} /> Aquatic</label>}
          <small>Level {c.level}; HP {c.level * (petAbilities.includes('Tough') || seaFriend ? 7 : 5)}; {seaFriend || c.pet?.aquatic ? 'swim Speed 25 feet; breathes water' : 'Speed 25 feet'}; low-light vision.</small>
          {seaFriend && <small>Friend of the Sea grants Darkvision and Tough in addition to two pet abilities.</small>}
          {Array.from({ length: 2 }, (_, index) => <label key={index}>Pet ability {index + 1}{' '}
            <select aria-label={`Pet ability ${index + 1}`} value={petAbilities[index] ?? ''} onChange={event => {
              const value = event.target.value
              if (value && (!PET_ABILITIES.includes(value) || petAbilities.some((other, i) => i !== index && other === value)
                || seaFriend && ['Darkvision', 'Tough'].includes(value))) return
              const abilities = Array.from({ length: Math.max(petAbilities.length, index + 1) }, (_, i) => petAbilities[i] ?? '')
              abilities[index] = value
              save({ pet: { ...c.pet, abilities } })
            }}>
              <option value="">Choose ability</option>
              {petAbilities[index] && !PET_ABILITIES.includes(petAbilities[index]) && <option value={petAbilities[index]}>{petAbilities[index]}</option>}
              {PET_ABILITIES.filter(ability => ability === petAbilities[index] || !petAbilities.includes(ability)
                && !(seaFriend && ['Darkvision', 'Tough'].includes(ability))).map(ability => <option key={ability} disabled={seaFriend && ['Darkvision', 'Tough'].includes(ability)}>{ability}</option>)}
            </select>
          </label>)}
          {[...new Set([...petAbilities.filter(ability => PET_ABILITIES.includes(ability)), ...(seaFriend ? ['Darkvision', 'Tough'] : [])])]
            .map(ability => <small key={ability}>{ability}: {PET_ABILITY_NOTES[ability]}</small>)}
          {seaFriend && petAbilities.some(ability => ['Darkvision', 'Tough'].includes(ability)) && <small>Choose a different pet ability; Darkvision and Tough are already granted.</small>}
          <small>Pet abilities must include abilities natural to the chosen animal; review ability effects and Command an Animal rules.</small>
        </details>}
      </div>
    </details>
  )
}
