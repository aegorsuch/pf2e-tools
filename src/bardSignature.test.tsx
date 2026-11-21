import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { SpellsSection } from './SpellsSection'
import type { Character, ContentEntry } from './types'

const spell = (name: string, level: number): ContentEntry => ({
  id: name, name, kind: 'spell', systems: ['pf2e'], source: 'official', level, traits: [],
  data: { tradition: 'Occult' }, description: '', effects: [], updatedAt: 0,
})
const bard = (feats: Character['feats'], signatureSpells?: Record<string, string>): Character => ({
  id: 'b', name: 'Bard', className: 'Bard', systems: ['pf2e'], level: 20,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 18 },
  feats, equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  spells: [{ name: 'Fear', rank: 1, cantrip: false, entryId: 'Fear' }],
  spellcasting: { ability: 'cha', tradition: 'Occult', rank: 4, slots: {}, prepared: { '1:0': 'Fear' }, signatureSpells },
})
const render = (c: Character) => renderToStaticMarkup(<SpellsSection c={c} entries={[spell('Fear', 1), { ...spell('Bard', 0), kind: 'class', data: { tradition: 'Occult', attribute: 'Charisma' } }]} save={() => {}} />)

it('lets a Bard mark a signature spell and cast it at a higher rank', () => {
  expect(render(bard([]))).toContain('aria-label="Signature spell rank 1 choice 1"')
  expect(render(bard([]))).not.toContain('Cast rank for Fear')
  const html = render(bard([], { 1: '1:0' }))
  expect(html).toContain('aria-label="Cast rank for Fear"')
  expect(html).toContain('<option value="9"')
})

it('makes every repertoire spell signature with Ultimate Polymath', () => {
  const html = render(bard([{ name: 'Ultimate Polymath', level: 20, type: 'Class Feat' }]))
  expect(html).toContain('aria-label="Cast rank for Fear"')
  expect(html).not.toContain('aria-label="Signature spell rank 1')
})
