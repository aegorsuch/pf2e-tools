import { useId, useLayoutEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { Character, ContentEntry } from './types'
import type { PrerequisiteCheck } from './featPrerequisites'
import { ignoresFeatPrerequisites } from './featPrerequisites'
import type { FeatAccessCheck } from './featAccess'
import { featRarity } from './featAccess'
import { ActionIcon } from './ActionIcon'
import { adoptedAncestryText, featDisplayName } from './featChoices'
import { equipmentDisplayName } from './equipmentGroups'
import { spellDCText } from './builder'
import { getSettings } from './settings'
import { hellknightTrainingBenefit } from './hellknight'
import { domainSpellDescription, featSpellOptions } from './featSpells'
import { TECHNOMANCER_LANGUAGE_RULES, TECHNOMANCER_PROGRAMMING_LANGUAGES } from './technomancer'

const featIndexes = new WeakMap<ContentEntry[], { urls: Map<string, ContentEntry>; names: Map<string, ContentEntry> }>()
const STAFF_ACROBAT_FEATS = new Set([
  'Staff Acrobat Dedication', 'Bullying Staff', 'Staff Sweep', 'Levering Strike', 'Whirlwind Stance', 'Pivot Strike',
])

function featIndex(entries: ContentEntry[]) {
  let index = featIndexes.get(entries)
  if (!index) {
    index = { urls: new Map(), names: new Map() }
    for (const candidate of entries) {
      if (candidate.kind !== 'feat' || candidate.deleted) continue
      if (typeof candidate.data.url === 'string' && !index.urls.has(candidate.data.url)) index.urls.set(candidate.data.url, candidate)
      for (const system of candidate.systems) {
        const key = `${system}:${candidate.name.toLowerCase()}`
        if (!index.names.has(key)) index.names.set(key, candidate)
      }
    }
    featIndexes.set(entries, index)
  }
  return index
}

type EntryDescriptionProps = {
  name: string; entry?: ContentEntry; choice?: string; className?: string; prerequisites?: PrerequisiteCheck; access?: FeatAccessCheck; buttonLabel?: string; buttonSuffix?: string; buttonActions?: string; hideButtonActions?: boolean; grantSource?: string; descriptionNote?: string; entries?: ContentEntry[]; character?: Character
  deferDetails?: boolean
}

export function EntryDescription({ name, entry, className, prerequisites, access, buttonLabel, buttonSuffix, buttonActions, hideButtonActions, grantSource, entries, character, deferDetails, ...details }: EntryDescriptionProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [history, setHistory] = useState<ContentEntry[]>([])
  const [openRequested, setOpenRequested] = useState(false)
  useLayoutEffect(() => {
    if (!openRequested || !deferDetails) return
    dialog.current?.showModal()
    dialog.current?.querySelector('h4')?.focus()
  }, [openRequested, deferDetails])
  const text = (value: string) => {
    if (!character) return value
    const adopted = adoptedAncestryText(character, value)
    return entries ? spellDCText(character, entries, adopted) : adopted
  }
  const buttonTitle = text(entry && ['item', 'weapon', 'armor', 'shield'].includes(entry.kind)
    ? equipmentDisplayName(name) : featDisplayName(entry, name))
  return (
    <>
      <button type="button" className={className} aria-label={buttonLabel ? `${buttonLabel}: ${buttonTitle}` : undefined}
        aria-haspopup="dialog" onClick={() => {
          if (deferDetails) setOpenRequested(true)
          else {
            setOpenRequested(true)
            dialog.current?.showModal()
            dialog.current?.querySelector('h4')?.focus()
          }
        }}>
        {buttonLabel ?? buttonTitle}{buttonSuffix}{(!!prerequisites?.missing.length || access && !access.automatic && !access.approved) && <> <span role="img"
          aria-label={prerequisites?.missing.length ? 'Prerequisites unmet' : 'Access information'}>*</span></>}
        {!hideButtonActions && !buttonLabel && (buttonActions || entry?.kind === 'feat' && typeof entry.data.actions === 'string' && entry.data.actions.trim())
          && <> <ActionIcon entry={entry} actions={buttonActions} /></>}
        {grantSource && <> <small>({text(grantSource)})</small></>}
      </button>
      {(!deferDetails || openRequested) && <dialog ref={dialog} className="entry-dialog" aria-labelledby={titleId}
        onClose={() => { setHistory([]); setOpenRequested(false) }}
        onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close() }}>
        <EntryDescriptionContents {...details} name={name} entry={entry} prerequisites={prerequisites}
          access={access} entries={entries} character={character} history={history} setHistory={setHistory} dialog={dialog} titleId={titleId}
          includeChoiceSpell={openRequested} />
      </dialog>}
    </>
  )
}

function EntryDescriptionContents({ name, entry, choice, prerequisites, access, descriptionNote, entries, character, history, setHistory, dialog, titleId, includeChoiceSpell }: EntryDescriptionProps & {
  history: ContentEntry[]; setHistory: Dispatch<SetStateAction<ContentEntry[]>>
  dialog: RefObject<HTMLDialogElement | null>; titleId: string; includeChoiceSpell: boolean
}) {
  const active = history.at(-1) ?? entry
  const text = (value: string) => {
    if (!character) return value
    const adopted = adoptedAncestryText(character, value)
    return entries ? spellDCText(character, entries, adopted) : adopted
  }
  const title = (value: string, source = active) => text(source && ['item', 'weapon', 'armor', 'shield'].includes(source.kind)
    ? equipmentDisplayName(value) : featDisplayName(source, value))
  const featActions = active?.kind === 'feat' && typeof active.data.actions === 'string' && active.data.actions.trim() !== ''
  const rarity = active && featRarity(active)
  const index = entries && active?.featLinks?.length ? featIndex(entries) : undefined
  const leads = index && active?.featLinks?.map(link => ({
    ...link, target: index.urls.get(link.url)
      ?? active.systems.map(system => index.names.get(`${system}:${link.name.toLowerCase()}`)).find(Boolean),
  }))
  let originalDescription = leads?.length ? active?.description.replace(/\n\n[^\n]*\bleads to\.\.\.[\s\S]*$/i, '') : active?.description
  if (active?.kind === 'feat' && STAFF_ACROBAT_FEATS.has(active.name) && getSettings().staffAcrobatSpear) {
    originalDescription = originalDescription?.replace(/\bStaff Acrobat\b/gi, 'Spear Acrobat')
      .replace(/\byour staff\b/gi, 'your spear')
  }
  if (active?.kind === 'feat' && active.name === 'Anchoring Arrow' && active.systems.includes('pf2e')) {
    originalDescription = originalDescription?.replace(/\bbow Strike\b/gi, 'ranged Strike')
  }
  if (active?.kind === 'feat' && active.name === 'Tectonic Psychic' && active.systems.includes('sf2e')) {
    originalDescription = originalDescription?.replace(/\n\n[^\n]*Nethys Note:[^\n]*uncanny eruption[^\n]*/i, '')
      .replace(/\buncanny eruption\b/i, 'Burstmoji (substituted for uncanny eruption)')
  }
  if (active?.kind === 'feat' && active.name === 'Captain Dedication' && active.systems.includes('pf2e')) {
    originalDescription = originalDescription
      ?.replace(/;\s*you don['’]t have an animal companion, construct companion, or other companion that functions similarly\.?/i, '')
      .replace(/(?:^|\n\n)Special\s+Once you have a follower, you can never take a feat or class feature that grants an animal companion or another companion that prevents you from having an animal companion\.?/i, '')
  }
  if (active && ignoresFeatPrerequisites(active) && typeof active.data.prerequisite === 'string') {
    const prerequisite = active.data.prerequisite.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    originalDescription = originalDescription?.replace(new RegExp(`(?:^|\\n\\n)Prerequisites?\\s*:?\\s*${prerequisite}\\.?(?=\\n\\n|$)`, 'i'), '')
  }
  if (!history.length && choice) {
    for (const section of active?.choiceDescriptions ?? []) {
      const option = Object.entries(section.options).find(([name]) => name.toLowerCase() === choice.trim().toLowerCase())
      if (!option) continue
      const detail = option[1].replace(/\b(arcane|divine|occult|primal) tradition\b/gi,
        (_, tradition: string) => `${tradition[0].toUpperCase()}${tradition.slice(1).toLowerCase()} Tradition`)
      originalDescription = originalDescription?.replace(section.text, () => `${option[0]}: ${detail}`)
    }
  }
  const description = active?.kind === 'feat' && ['Tenacious Endurance', 'Heightened Instincts'].includes(active.name)
    && getSettings().singleAnimalCompanion
    ? originalDescription?.replace(/\bone of your (animal )?companions\b/gi, 'your $1companion')
      .replace(/\byour companions['\u2019]/gi, "your companion's") : originalDescription
  const training = character && active?.kind === 'feat'
    ? hellknightTrainingBenefit(character, active.name, history.length ? undefined : choice) : undefined
  const technomancerLanguage = character?.className === 'Technomancer' && character.systems.includes('sf2e')
    ? TECHNOMANCER_PROGRAMMING_LANGUAGES.find(language => language === choice) : undefined
  const technomancerHackName = entry?.kind === 'feat' && technomancerLanguage
    ? entry.name === 'Cross-platform Application' ? TECHNOMANCER_LANGUAGE_RULES[technomancerLanguage].initialHack
      : entry.name === 'Advanced Cross-platform Application' ? TECHNOMANCER_LANGUAGE_RULES[technomancerLanguage].advancedHack
        : entry.name === 'Greater Cross-platform Application' ? TECHNOMANCER_LANGUAGE_RULES[technomancerLanguage].greaterHack
        : undefined
    : undefined
  const technomancerFirmware = entry?.kind === 'feat' && entry.name === 'Versatile Firmware' && technomancerLanguage
    ? TECHNOMANCER_LANGUAGE_RULES[technomancerLanguage].firmware : undefined
  const choiceSpell = includeChoiceSpell && !history.length && character && entries && entry?.kind === 'feat' && choice
    ? technomancerHackName
      ? entries.find(spell => spell.kind === 'spell' && !spell.deleted && spell.name === technomancerHackName
        && spell.systems.includes('sf2e'))
      : featSpellOptions(character, entries, character.feats.find(feat => feat.name === entry.name && feat.choice === choice)
        ?? { name: entry.name, type: '', level: entry.level, sourceId: entry.id, choice })
        ?.find(spell => spell.name.toLowerCase() === choice.trim().toLowerCase())
    : undefined
  const choiceSpellName = technomancerHackName ?? choiceSpell?.name
  return (
    <>
        <h4 id={titleId} tabIndex={-1}>{title(history.length ? active?.name ?? name : name)}{featActions && <> <ActionIcon entry={active} /></>}{active && active.kind !== 'trait' && <small> (Level {active.level}{rarity ? `; ${rarity}` : ''})</small>}</h4>
        {!history.length && !!prerequisites?.missing.length && <p className="feat-prerequisite-note" role="status">
          Prerequisites unmet: {text(prerequisites.missing.join('; '))}
        </p>}
        {!history.length && !!prerequisites?.manual.length && <p className="feat-prerequisite-note">
          Check prerequisites manually: {text(prerequisites.manual.join('; '))}
        </p>}
        {!history.length && access && !access.automatic && !access.approved && <p className="feat-prerequisite-note">
          Access: {access.requirement}{/[.!?]$/.test(access.requirement) ? '' : '.'} Access not established; GM permission required.
          {' '}Access does not replace prerequisites.
        </p>}
        <p>{text(description || 'Description unavailable. Sync Archives of Nethys content to load it.')}</p>
        {choiceSpellName && <p><strong>{text(choiceSpellName)}:</strong>{' '}
          {text(choiceSpell?.description || 'Spell description unavailable; sync Archives of Nethys content to load it.')}</p>}
        {technomancerFirmware && <p><strong>Firmware Enhancement:</strong> {text(technomancerFirmware)}</p>}
        {training && <p><strong>{training.name} ({training.order}):</strong> {training.description}
          {training.name === 'Dedication to the Five' && training.choice && character && entries
            && <> {text(domainSpellDescription(character, entries, 'Domain Initiate', training.choice))}</>}
        </p>}
        {!history.length && descriptionNote && <p>{text(descriptionNote)}</p>}
        {!!leads?.length && <p>Leads to: {leads.map((link, index) => <span key={`${link.url}:${index}`}>
          {index > 0 && ', '}{link.target
            ? <button type="button" onClick={() => { const target = link.target; if (target) setHistory(previous => [...previous, target]); dialog.current?.querySelector('h4')?.focus() }}>{title(link.name, link.target)}</button>
            : <span>{text(link.name)} (unavailable)</span>}
        </span>)}</p>}
        {typeof active?.data.url === 'string' && <p><a href={active.data.url} target="_blank" rel="noreferrer">Archives of Nethys</a></p>}
        {history.length > 0 && <button type="button" onClick={() => { setHistory(previous => previous.slice(0, -1)); dialog.current?.querySelector('h4')?.focus() }}>Back</button>}
        <form method="dialog"><button autoFocus>Close</button></form>
    </>
  )
}
