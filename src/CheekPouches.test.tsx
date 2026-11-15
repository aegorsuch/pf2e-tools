import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { CheekPouches } from './CheekPouches'
import { cheekPouchStatus, storeCheekItem } from './cheekPouchRules'
import { weaponEquipped, ownedWeapons } from './builder'
import type { Character, ContentEntry } from './types'

const item = (name: string, bulk?: number, kind: ContentEntry['kind'] = 'item'): ContentEntry => ({
  id: name, systems: ['sf2e'], kind, source: 'official', name, level: 0, traits: [], description: '',
  data: { ...(bulk !== undefined ? { bulk } : {}), ...(kind === 'weapon' ? { hands: 1 } : {}) },
  effects: [], updatedAt: 0,
})
const entries = [{ ...item('Grenade', 0.1), traits: ['Grenade'] }, item('Tool', 1), item('Unknown'),
  { ...item('Gun', 0.1, 'weapon'), data: { hands: 1, bulk: 0.1, weapon_type: 'Ranged', weapon_group: 'Laser' } },
  { ...item('Rifle', 2, 'weapon'), data: { hands: 2, bulk: 2, weapon_type: 'Ranged', weapon_group: 'Laser' } }]
const base: Character = {
  id: 'ysoki', systems: ['sf2e'], name: 'Test', level: 17,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  feats: [{ name: 'Cheek Pouches', type: 'Ancestry Feat', level: 1 }],
  equipment: [{ name: 'Grenade', qty: 5 }, { name: 'Tool', qty: 1 }, { name: 'Unknown', qty: 1 }],
  lores: [], languages: [], entryIds: [], extraSlots: [], updatedAt: 0,
}
const store = (c: Character, picked: string) => {
  const result = storeCheekItem(c, entries, picked)
  if ('error' in result) throw new Error(result.error)
  return { ...c, ...result.patch }
}

it('enforces pouch item count and bulk while preserving inventory', () => {
  let c = base
  for (let i = 0; i < 4; i++) c = store(c, 'e:0:Grenade')
  expect(c.equipment[0]).toMatchObject({ qty: 5, cheekQty: 4 })
  expect(storeCheekItem(c, entries, 'e:0:Grenade')).toEqual({ error: 'Item exceeds cheek pouch capacity.' })
  expect(storeCheekItem(base, entries, 'e:1:Tool')).toEqual({ error: 'Item exceeds cheek pouch capacity.' })
  expect(storeCheekItem(base, entries, 'e:2:Unknown')).toEqual({ error: 'Bulk unavailable; sync item data before storing.' })
  expect(storeCheekItem({ ...base, feats: [] }, entries, 'e:0:Grenade')).toEqual({ error: 'Cheek Pouches unavailable.' })
  expect(storeCheekItem(base, entries, 'e:1:Grenade')).toEqual({ error: 'Choose an available item.' })
  expect(JSON.parse(JSON.stringify(c)).equipment[0].cheekQty).toBe(4)
  expect(c.weapons).toBeUndefined()
})

it('applies Big Mouth and portal capacity and reports lost prerequisites', () => {
  let c = { ...base, feats: [...base.feats, { name: 'Big Mouth', type: 'Ancestry Feat', level: 9 }] }
  c = store(c, 'e:1:Tool')
  expect(cheekPouchStatus(c, entries).bulk).toBe(1)
  expect(storeCheekItem(c, entries, 'e:0:Grenade')).toEqual({ error: 'Item exceeds cheek pouch capacity.' })
  expect(cheekPouchStatus({ ...c, feats: base.feats }, entries).overLimit).toBe(true)
  const portal = { ...base, feats: [...base.feats, { name: 'Interdimensional Cheek Portal', type: 'Ancestry Feat', level: 17 }] }
  expect(cheekPouchStatus(store(portal, 'e:1:Tool'), entries).limit).toBe(10)
  const markup = renderToStaticMarkup(<CheekPouches c={portal} entries={entries} save={() => {}} />)
  expect(markup).toContain('Fits in mouth')
  expect(markup).toContain('Up to 10 Bulk')
})

it('stows weapons and prevents legacy pouch weapons from counting as held', () => {
  const gun = { id: 'gun', name: 'Gun', potency: 0, striking: 0, runes: [] }
  const c = store({ ...base, weapons: [gun], hardpointWeaponId: 'gun' }, 'w:gun')
  expect(c.weapons?.[0]).toMatchObject({ cheekStored: true, stowed: true })
  expect(c.hardpointWeaponId).toBeUndefined()
  expect(weaponEquipped(c, entries, c.weapons![0])).toBe(false)
  const legacy = store({ ...base, equipment: [{ name: 'Gun', qty: 1 }] }, 'e:0:Gun')
  const legacyGun = ownedWeapons(legacy, entries).find(weapon => weapon.name === 'Gun')!
  expect(weaponEquipped(legacy, entries, legacyGun)).toBe(false)
  expect(cheekPouchStatus({ ...legacy, feats: [] }, entries).hasPouches).toBe(false)
})

it('alphabetizes stored equipment and weapons together without changing their saved indexes', () => {
  const c: Character = { ...base,
    equipment: [{ name: 'Tool', qty: 1, cheekQty: 1 }, { name: 'Grenade', qty: 2 }],
    weapons: [{ id: 'gun', name: 'Gun', potency: 0, striking: 0, runes: [], cheekStored: true }],
  }
  const markup = renderToStaticMarkup(<CheekPouches c={c} entries={entries} save={() => {}} />)
  const list = markup.split('<ul>')[1].split('</ul>')[0]
  expect(list.indexOf('Gun')).toBeLessThan(list.indexOf('Tool'))
  expect(markup).toContain('value="e:1:Grenade"')
})

it('prepares eligible grenades and firearms and applies Cheek Holster size limits', () => {
  const c: Character = { ...base, feats: [...base.feats,
    { name: 'Explosive Surprise', type: 'Ancestry Feat', level: 13 },
    { name: 'Cheek Holster', type: 'Ancestry Feat', level: 13 }],
  weapons: [{ id: 'rifle', name: 'Rifle', potency: 0, striking: 0, runes: [] }] }
  const grenade = storeCheekItem(c, entries, 'e:0:Grenade', true)
  expect('patch' in grenade && grenade.patch.equipment?.[0]).toMatchObject({ cheekQty: 1, cheekPreparedQty: 1 })
  expect(storeCheekItem(c, entries, 'e:1:Tool', true)).toEqual({ error: 'Only grenades can be prepared with Explosive Surprise.' })
  expect(storeCheekItem(c, entries, 'w:rifle', true)).toEqual({ error: 'Cheek Holster requires an eligible firearm with known hands and Bulk.' })
  const big = { ...c, feats: [...c.feats, { name: 'Big Mouth', type: 'Ancestry Feat', level: 9 }] }
  const prepared = storeCheekItem(big, entries, 'w:rifle', true)
  expect('patch' in prepared && prepared.patch.weapons?.[0]).toMatchObject({ cheekStored: true, cheekHolstered: true })
  if ('patch' in prepared) {
    const stored = { ...big, ...prepared.patch }
    expect(cheekPouchStatus(stored, entries).overLimit).toBe(false)
    expect(cheekPouchStatus({ ...stored, feats: c.feats }, entries).invalid).toBe(true)
    expect(storeCheekItem(stored, entries, 'e:0:Grenade')).toEqual({ error: 'Item exceeds cheek pouch capacity.' })
  }
})
