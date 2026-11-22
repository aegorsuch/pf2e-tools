import type { ContentEntry } from './types'

const grades = ['Tactical', 'Advanced', 'Superior', 'Elite', 'Ultimate', 'Paragon'] as const

export function sfSpecificWeapons(entries: ContentEntry[]): ContentEntry[] {
  const weapons = entries.filter(entry => entry.kind === 'weapon' && entry.source === 'official'
    && entry.systems.includes('sf2e') && !entry.deleted)
  const family = (base: string, title: string, id: string, minGrade: typeof grades[number],
    level: number, price: number, traits: string[], description: string, source: string,
    extra: ContentEntry['data'] = {}, homebrew = false) => {
    const first = grades.indexOf(minGrade)
    const baseEntry = weapons.find(entry => entry.name === `${minGrade} ${base}`)
    if (!baseEntry) return []
    return grades.slice(first).flatMap((grade, index) => {
      const weapon = weapons.find(entry => entry.name === `${grade} ${base}`)
      if (!weapon) return []
      const stun = id === 'stun-stick'
      const levels = [5, 11, 13, 17, 20]
      const prices = [1500, 13000, 28000, 140000, 600000]
      const dcs = [20, 28, 31, 36, 40]
      const modes = id === 'raptorial-edge' ? (weapon.weaponModes ?? baseEntry.weaponModes
        ?? weapons.find(entry => entry.name === base)?.weaponModes ?? [
          { id: 'mode-1', damageType: 'slashing', traits: ['Agile', 'Analog', 'Finesse', 'Sweep'] },
          { id: 'mode-2', damageType: 'void', traits: ['Agile', 'Finesse', 'Powered', 'Sweep', 'Tech'] },
        ]).map(mode => mode.damageType.toLowerCase() === 'void' ? { ...mode, damageType: 'mental' } : mode) : weapon.weaponModes
      const url = id.startsWith('starday-') ? 'https://2e.aonsrd.com/treasure/215'
        : id === 'slarp-laser' ? 'https://2e.aonsrd.com/treasure/235'
          : id === 'liminal-laser-rifle' ? 'https://2e.aonsrd.com/treasure/224'
            : id === 'stun-stick' ? 'https://2e.aonsrd.com/treasure/216' : 'https://2e.aonsrd.com/treasure/229'
      return [{
        ...weapon, id: `supplemental:sf2e:${id}${index ? `:${grade.toLowerCase()}` : ''}`,
        source: homebrew ? 'homebrew' as const : 'official' as const,
        name: `${index ? `${grade} ` : ''}${title}`,
        level: stun ? levels[index] : index ? weapon.level : level,
        traits: [...new Set([...weapon.traits.map(trait => id === 'raptorial-edge' && /^modular\b/i.test(trait)
          ? trait.replace(/\b(?:void|V)\b/gi, 'Mental') : trait), ...traits])],
        description: stun ? description.replace('{dc}', String(dcs[index])) : description,
        weaponModes: modes,
        data: { ...weapon.data, ...extra, url, ...(id === 'raptorial-edge' ? { damage_type: 'Slashing, Mental' } : {}),
          item_category: 'Weapons', item_subcategory: 'Specific Weapons',
          sourceBook: source, price: stun ? prices[index] : price + Math.max(0, Number(weapon.data.price ?? 0) - Number(baseEntry.data.price ?? 0)),
          weapon_grade_family: `supplemental:sf2e:${id}`, proficiency_base: base },
        updatedAt: 1,
      }]
    })
  }
  const lucky = 'Activate—Lucky Bullet Frequency once per day; Trigger your Strike critically fails. The target rolls twice and takes the worse result on its next check during its next turn.'
  const sample = 'Activate—Sample Return Frequency once per day; Trigger a successful Strike. Recall Knowledge about the target’s material, Hardness, and resistances using Geology Lore or Physical Science Lore.'
  const stun = 'Activate—Short, Sharp Shock Frequency once per hour; Make a melee Strike dealing electricity damage instead of bludgeoning. On a hit, the target attempts a DC {dc} Fortitude save or is stunned 1 for 1 round (incapacitation).'
  return [
    ...family('Semi-Auto Pistol', 'Starday Night Special (Semi-Auto Pistol)', 'starday-semi-auto', 'Tactical', 3, 580,
      ['Magical', 'Tech'], lucky, 'Starfinder Absalom Station', { special_weapon_source: 'Starday Night Special' }),
    ...family('Rotating Pistol', 'Starday Night Special (Rotating Pistol)', 'starday-rotating', 'Tactical', 3, 580,
      ['Magical', 'Tech'], lucky, 'Homebrew', { special_weapon_source: 'Starday Night Special' }, true),
    ...family('Gyrojet Pistol', 'Starday Night Special (Gyrojet Pistol)', 'starday-gyrojet', 'Tactical', 3, 580,
      ['Magical', 'Tech'], lucky, 'Homebrew', { special_weapon_source: 'Starday Night Special' }, true),
    ...family('Laser Pistol', 'SLARP Laser Pistol', 'slarp-laser', 'Advanced', 4, 1100,
      ['Professional (Geology Lore or Physical Science Lore)', 'Razing'], sample, 'Starfinder Society Scenario #2-00: Moon Busters',
      { special_weapon_source: 'SLARP', professional_skills: 'Geology Lore;Physical Science Lore' }),
    ...family('Laser Rifle', 'Liminal Laser Rifle', 'liminal-laser-rifle', 'Advanced', 4, 1230,
      ['Magical'], 'Activate—Liminal Lock; Cost 2 charges. The next ranged Strike against a target with cover reduces its cover bonus to AC by 1.',
      'Starfinder Absalom Station', { special_weapon_source: 'Liminal Laser Rifle' }),
    ...family('Baton', 'Stun Stick', 'stun-stick', 'Advanced', 5, 1500,
      ['Magical'], stun, 'Starfinder Absalom Station', { special_weapon_source: 'Stun Stick' }),
    ...family('Phase Cutlass', 'Raptorial Edge', 'raptorial-edge', 'Superior', 11, 14000,
      ['Rare', 'Biotech', 'Magical'],
      'Its powered mode deals mental rather than void damage. A permanent upgrade occupies one slot and adds 1d6 acid damage and 1d10 persistent acid on a critical hit. Improving it costs 60,000 credits, increases persistent acid to 2d10, and ignores acid resistance.\n\nActivate—Mind Slice Trigger a critical hit; unless the target succeeds at a DC 28 Will save, learn whether its Intelligence is higher than, equal to, or lower than yours.',
      'Secrets of the Swarm', { special_weapon_source: 'Raptorial Edge', rarity: 'rare', raptorial_edge: true }),
  ]
}
