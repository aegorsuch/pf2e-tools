import { plain } from './aonQuery.ts'
import type { ContentEntry } from './types.ts'

type Link = { name: string; start: number; end: number }
type Grant = { name: string; choice?: string }

const names = (value: unknown) => typeof value === 'string'
  ? value.split(/,\s*(?![^()]*\))/).map(name => name.trim().replace(/\bLore(?:\s+Lore)+\b/gi, 'Lore')).filter(Boolean) : []
export const isOpenBackgroundLore = (name: string) => /\blore\b/i.test(name) && !/^[\w' -]+ Lore$/i.test(name)

export function deityBackgroundEntries(entries: ContentEntry[]) {
  const deities = entries.filter(entry => entry.kind === 'deity' && !entry.deleted
    && names(entry.data.skill).length && names(entry.data.attribute).length)
  return entries.flatMap(entry => {
    if (entry.kind !== 'background' || entry.name !== 'Disciple' || !entry.systems.includes('sf2e')) return [entry]
    return [
      { ...entry, data: { ...entry.data, background_choice_required: true } },
      ...deities.filter(deity => deity.systems.some(system => entry.systems.includes(system)))
        .map(deity => {
          const skills = names(deity.data.skill)
          return {
            ...entry, id: `${entry.id}:deity:${encodeURIComponent(deity.name)}`, name: `Disciple (${deity.name})`,
            data: { ...entry.data, background_base: entry.name, background_deity: deity.name,
              background_choice_required: false, attribute: deity.data.attribute,
              skill: [...(skills.length === 1 ? skills : []), `${deity.name} Lore`].join(', '),
              background_skill_options: skills.length > 1 ? skills.join(', ') : '' },
          }
        }),
    ]
  })
}

export function backgroundLoreCount(entry?: ContentEntry) {
  const open = names(entry?.data.skill).filter(isOpenBackgroundLore).length
  if (!open || !entry) return 0
  const count = /\btrained in (one|two|three|four|[1-4]) Lore skills?\b/i.exec(entry.description)?.[1]?.toLowerCase()
  const quantities: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 }
  return Math.max(open, count ? quantities[count] ?? Number(count) : 0)
}
const grant = (name: string): Grant => {
  const choice = /^(Assurance|Terrain Expertise|Specialty Crafting|Additional Lore) \(([^)]+)\)$/.exec(name)
  return choice ? { name: choice[1], choice: choice[2] } : { name }
}

function choiceNames(label: string) {
  label = label.replace(/\bLore(?:\s+Lore)+\b/gi, 'Lore')
  if (!/\bor\b/.test(label)) return [label]
  return label.split(/,\s*(?:or\s+)?|\s+or\s+/).filter(Boolean)
    .map(name => / Lore$/.test(label) && !/ Lore$/.test(name) ? `${name} Lore` : name)
}

function links(markdown: string, kind: 'skills' | 'feats'): Link[] {
  const found = [...markdown.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].filter(match =>
    new RegExp(`^/(?:${kind}\\.aspx|${kind}/)`, 'i').test(match[2]))
    .flatMap(match => choiceNames(match[1])
      .map(name => ({ name, start: match.index, end: match.index + match[0].length })))
  if (kind === 'skills') for (const match of markdown.matchAll(/\b(?:the|and|or)\s+(?:the\s+)?([A-Z][\w'-]*(?: [A-Z][\w'-]*)* Lore)\b/g)) {
    const start = match.index + match[0].length - match[1].length
    if (!found.some(link => start >= link.start && start < link.end))
      found.push({ name: match[1], start, end: start + match[1].length })
  }
  return found.sort((a, b) => a.start - b.start)
}

function alternatives(markdown: string, items: Link[]) {
  const groups: string[][] = []
  let run: Link[] = []
  const finish = () => {
    if (run.length > 1) {
      const body = markdown.slice(run[0].start, run.at(-1)!.end)
      const prefix = markdown.slice(0, run[0].start)
      const example = prefix.lastIndexOf('(') > prefix.lastIndexOf(')')
        && /\b(?:such as|for example)\b/i.test(prefix.slice(prefix.lastIndexOf('(')))
      if (/\bor\b/i.test(plain(body)) && !example) groups.push([...new Set(run.map(item => item.name))])
    }
    run = []
  }
  for (const item of items) {
    const previous = run.at(-1)
    if (previous && !/^(?:\s|,|\bor\b|\bthe\b|\bskills?\b|\bfeats?\b)*$/i.test(plain(markdown.slice(previous.end, item.start)))) finish()
    run.push(item)
  }
  finish()
  return groups
}

function choices(entry: ContentEntry, markdown: string) {
  const paragraphs = markdown.split(/\n\s*\n/).filter(paragraph => /\b(?:trained in|you gain)\b/i.test(plain(paragraph)))
  const rules = paragraphs.join('\n\n')
  const skillLinks = links(rules, 'skills')
  const featLinks = links(rules, 'feats')
  const skillGroups = alternatives(rules, skillLinks)
  const featGroups = alternatives(rules, featLinks)
  const paired = new Map<string, Grant[]>()
  for (const feat of featLinks) {
    const before = plain(rules.slice(0, feat.start))
    const after = plain(rules.slice(feat.end))
    const skill = skillGroups.flat().find(name =>
      after.startsWith(`if you chose ${name}`) || after.startsWith(`if you selected ${name}`)
      || before.endsWith(`If you selected ${name}, you gain the`) || before.endsWith(`If you chose ${name}, you gain the`))
    if (skill) paired.set(skill, [...(paired.get(skill) ?? []), grant(feat.name)])
  }
  const conditional = new Set([...paired.values()].flat().map(feat => feat.name))
  const indexedSkills = names(entry.data.skill).flatMap(name => / Lore$/i.test(name) ? choiceNames(name.replace(/^or\s+/, '')) : [name])
  const unlinkedLores = [...plain(rules).matchAll(/\b(?:the|and|or)\s+(?:the\s+)?([A-Z][\w'-]*(?: [A-Z][\w'-]*)* Lore)\b/g)]
    .map(match => match[1])
  const fixedSkills = [...new Set(indexedSkills.length ? indexedSkills : [...skillLinks.map(link => link.name), ...unlinkedLores])]
    .filter(name => /^[A-Z][\w'-]*(?: [A-Z][\w'-]*)*$/.test(name) || isOpenBackgroundLore(name))
    .filter(name => !skillGroups.some(group => group.includes(name) || group.includes(`${name} Lore`)))
  const fixedFeats = [...new Set([...names(entry.data.feat), ...featLinks.filter(feat =>
    /\byou (?:also )?gain(?: the)?$/i.test(plain(rules.slice(0, feat.start)))).map(feat => feat.name)])]
    .map(grant).filter(feat => !conditional.has(feat.name) && !featGroups.some(group => group.map(name => grant(name).name).includes(feat.name)))
  let variants = [{ labels: [] as string[], skills: fixedSkills, feats: fixedFeats, selectedSkill: '' }]
  for (const group of skillGroups) variants = variants.flatMap(variant => group.map(skill => ({
    labels: [...variant.labels, skill], skills: [...variant.skills, skill],
    feats: [...variant.feats, ...(paired.get(skill) ?? [])],
    selectedSkill: / lore$/i.test(skill) ? variant.selectedSkill : skill,
  })))
  for (const group of featGroups) variants = variants.flatMap(variant => group.map(name => ({
    ...variant, labels: [...variant.labels, name], feats: [...variant.feats, grant(name)],
  })))
  return { variants, fixedSkills, fixedFeats, hasChoices: skillGroups.length > 0 || featGroups.length > 0 }
}

export function backgroundEntries(entry: ContentEntry, markdown: string): ContentEntry[] {
  if (!markdown.trim()) return [entry]
  const packages = markdown.split(/\n\s*\n/).flatMap(paragraph => {
    const heading = /^\s*\*\*([^*:]+)\*\*:/.exec(paragraph)
    return heading && /\btrained in\b/i.test(paragraph) ? [{ label: heading[1], rules: paragraph }] : []
  })
  const former = /Choose whether[\s\S]*?through (\w+) or (\w+)[\s\S]*?For the former,([\s\S]*?)For the latter,([\s\S]*?)(?:<br|$)/i.exec(markdown)
  if (former) packages.push(...[former[1], former[2]].map((label, index) => ({
    label: label[0].toUpperCase() + label.slice(1), rules: former[index + 3],
  })))
  if (packages.length > 1) {
    const variants = packages.flatMap(pkg => backgroundEntries({
      ...entry, id: `${entry.id}:package:${encodeURIComponent(pkg.label)}`, name: `${entry.name} (${pkg.label})`,
      data: { ...entry.data, skill: '', feat: '', background_base: entry.name },
    }, pkg.rules).filter(variant => !variant.data.background_choice_required))
    const common = (field: 'skill' | 'feat') => names(variants[0]?.data[field])
      .filter(name => variants.every(variant => names(variant.data[field]).includes(name))).join(', ')
    return [{ ...entry, data: { ...entry.data, skill: common('skill'), feat: common('feat'), background_choice_required: true } }, ...variants]
  }
  const { variants, fixedSkills, fixedFeats, hasChoices } = choices(entry, markdown)
  if (!hasChoices && (markdown.match(/\btrained in\b/gi)?.length ?? 0) > 1) return [entry]
  if (!hasChoices) return [{ ...entry, data: { ...entry.data,
    skill: fixedSkills.join(', '), feat: fixedFeats.map(feat => feat.name).join(', '),
    ...Object.fromEntries(fixedFeats.filter(feat => feat.choice).map(feat => [`background_choice_${feat.name}`, feat.choice ?? ''])),
  } }]
  const commonSkills = variants[0].skills.filter(name => variants.every(variant => variant.skills.includes(name)))
  const commonFeats = variants[0].feats.filter(feat => variants.every(variant => variant.feats.some(other => other.name === feat.name)))
  return [{ ...entry, data: { ...entry.data, skill: commonSkills.join(', '), feat: commonFeats.map(feat => feat.name).join(', '),
    background_choice_required: true } }, ...variants.map(variant => {
    const label = variant.labels.join(', ')
    const terrain = [...plain(markdown).matchAll(/\b([a-z]+) if you have ([A-Z][\w' -]*? Lore)\b/g)]
      .find(match => variant.skills.includes(match[2]))?.[1]
    return { ...entry, id: `${entry.id}:variant:${encodeURIComponent(label)}`, name: `${entry.name} (${label})`,
      data: { ...entry.data, background_base: entry.name, background_skill: variant.selectedSkill,
        ...Object.fromEntries(variant.feats.filter(feat => feat.choice).map(feat => [`background_choice_${feat.name}`, feat.choice ?? ''])),
        ...(terrain && variant.feats.some(feat => feat.name === 'Terrain Expertise')
          ? { 'background_choice_Terrain Expertise': terrain[0].toUpperCase() + terrain.slice(1) } : {}),
        ...(/\bwith the chosen lore\b/i.test(plain(markdown)) && variant.feats.some(feat => feat.name === 'Assurance')
          ? { background_choice_Assurance: variant.skills.find(skill => / Lore$/i.test(skill)) ?? '' } : {}),
        skill: [...new Set(variant.skills)].join(', '), feat: [...new Set(variant.feats.map(feat => feat.name))].join(', ') } }
  })]
}
