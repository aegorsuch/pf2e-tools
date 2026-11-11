import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { FeatSlots } from './FeatSlots'
import type { Character, ContentEntry } from './types'

it('prefixes ancestry slots and feat options with zero-padded levels', () => {
  const c: Character = {
    id: 'c', systems: ['pf2e'], name: 'Alex', level: 13, ancestry: 'Human',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
  }
  const feat: ContentEntry = {
    id: 'feat', systems: ['pf2e'], kind: 'feat', source: 'official', name: 'Natural Ambition', level: 1,
    traits: ['Human'], description: '', data: {}, effects: [], updatedAt: 0,
  }
  const markup = renderToStaticMarkup(<FeatSlots c={c} entries={[feat]} save={() => {}} categories={['ancestry']} title="Ancestry Feats" />)
  expect(markup).toContain('Ancestry Feats')
  expect(markup).toContain('L01 Ancestry')
  expect(markup).toContain('L13 Ancestry')
  expect(markup).toContain('L01 Natural Ambition')
})
