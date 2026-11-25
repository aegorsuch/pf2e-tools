import { expect, it } from 'vitest'
import { autoClassSkills, focusSpells } from './builder'
import { apparitionLimit, normalizeApparitions } from './apparitions'
import type { Character } from './types'

const hit = { _id: 'apparition-3', _source: { name: 'Crafter in the Vault', markdown: '[Crafter](/Apparitions.aspx?ID=3)\n\n**Apparition Skills** Architecture Lore, Engineering Lore\n\n**Apparition Spells**\n- **Cantrip** [Sigil](/Spells.aspx?ID=1673)\n- **1st** [Mending](/Spells.aspx?ID=1597)\n\n**Vessel Spell** [Traveling Workshop](/Spells.aspx?ID=2137)' } }

it('parses apparitions and applies attunement skills, vessel focus spell, and focus points', () => {
  const [apparition] = normalizeApparitions([hit])
  expect(apparition).toMatchObject({ id: '3', skills: ['Architecture Lore', 'Engineering Lore'], vessel: 'Traveling Workshop',
    spells: [{ name: 'Sigil', rank: 0 }, { name: 'Mending', rank: 1 }] })
  const c = { id: 'a', name: 'A', systems: ['pf2e'], className: 'Animist', level: 7, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    feats: [], equipment: [], lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0, attunedApparitions: [apparition] } as unknown as Character
  expect(autoClassSkills(c, [])).toEqual(expect.arrayContaining(['Architecture Lore', 'Engineering Lore']))
  const focus = focusSpells(c, [])
  expect(focus.spells.map(spell => spell.name)).toContain('Traveling Workshop')
  expect(focus.points).toBe(2)
  expect([apparitionLimit({ level: 1 }), apparitionLimit({ level: 7 }), apparitionLimit({ level: 15 })]).toEqual([2, 3, 4])
})
