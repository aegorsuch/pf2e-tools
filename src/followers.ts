import { activeFeatsNamed } from './builder'
import type { Character } from './types'

type Attribute = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
type Stage = 0 | 1 | 2 | 3
type Attack = { name: string; ability: Attribute; die: number; type: string; traits: string; ranged?: boolean }
type Profile = {
  abilities: [number, number, number, number, number, number][]
  hp: number
  armor: number[]
  dexCap: number
  saves: [number, number, number][]
  perception: number[]
  skills: { name: string; ability: Attribute; ranks: number[]; item?: number[] }[]
  attacks: Attack[]
}

const profiles: Record<string, Profile> = {
  Berserker: {
    abilities: [[3, 0, 2, 0, 0, 2], [4, 0, 3, 0, 0, 2], [4, 0, 4, 0, 1, 3], [5, 1, 4, 0, 2, 4]],
    hp: 8, armor: [3, 3, 4, 5], dexCap: 2, saves: [[1, 1, 1], [2, 1, 2], [2, 1, 2], [3, 2, 3]], perception: [1, 1, 2, 2],
    skills: [{ name: 'Athletics', ability: 'str', ranks: [1, 1, 2, 3] }, { name: 'Intimidation', ability: 'cha', ranks: [1, 1, 2, 2] }, { name: 'Warfare Lore', ability: 'int', ranks: [1, 1, 2, 2] }],
    attacks: [{ name: 'Falchion', ability: 'str', die: 10, type: 'slashing', traits: 'forceful, sweep' }],
  },
  Medic: {
    abilities: [[0, 2, 1, 1, 3, 0], [0, 3, 1, 1, 4, 0], [1, 4, 2, 1, 4, 0], [2, 4, 3, 2, 5, 0]],
    hp: 6, armor: [1, 1, 2, 3], dexCap: 4, saves: [[1, 1, 1], [2, 1, 2], [2, 1, 2], [3, 2, 3]], perception: [1, 1, 2, 2],
    skills: [{ name: 'Medicine', ability: 'wis', ranks: [1, 2, 3, 3], item: [0, 0, 1, 2] }, { name: 'Herbalism Lore', ability: 'int', ranks: [1, 1, 2, 2] }, { name: 'Nature', ability: 'wis', ranks: [1, 1, 2, 2] }, { name: 'Survival', ability: 'wis', ranks: [1, 1, 2, 2] }, { name: 'Acrobatics', ability: 'dex', ranks: [0, 0, 0, 2] }],
    attacks: [{ name: 'Scalpel', ability: 'dex', die: 4, type: 'piercing', traits: 'agile, deadly d8, finesse, versatile S' }],
  },
  Scout: {
    abilities: [[1, 3, 1, 0, 2, 0], [1, 4, 1, 0, 3, 0], [2, 4, 2, 1, 3, 0], [3, 5, 3, 1, 4, 0]],
    hp: 6, armor: [1, 1, 2, 3], dexCap: 4, saves: [[1, 1, 1], [1, 2, 2], [1, 2, 2], [2, 3, 3]], perception: [1, 2, 2, 3],
    skills: [{ name: 'Acrobatics', ability: 'dex', ranks: [1, 1, 2, 2] }, { name: 'Stealth', ability: 'dex', ranks: [1, 1, 2, 3], item: [0, 0, 1, 2] }, { name: 'Survival', ability: 'wis', ranks: [1, 1, 2, 2] }, { name: 'Settlement or Terrain Lore', ability: 'int', ranks: [1, 1, 2, 2] }],
    attacks: [{ name: 'Shortsword', ability: 'dex', die: 6, type: 'piercing', traits: 'agile, finesse, versatile S' }],
  },
  Sharpshooter: {
    abilities: [[0, 3, 1, 0, 2, 1], [0, 4, 1, 0, 3, 1], [0, 4, 2, 1, 3, 2], [0, 5, 3, 1, 4, 3]],
    hp: 4, armor: [1, 1, 2, 3], dexCap: 4, saves: [[1, 1, 1], [2, 2, 1], [2, 2, 1], [2, 3, 3]], perception: [1, 1, 2, 2],
    skills: [{ name: 'Acrobatics', ability: 'dex', ranks: [1, 1, 2, 3] }, { name: 'Hunting Lore', ability: 'int', ranks: [1, 1, 2, 2] }, { name: 'Stealth', ability: 'dex', ranks: [1, 1, 2, 2] }, { name: 'Intimidation', ability: 'cha', ranks: [0, 0, 2, 2] }],
    attacks: [{ name: 'Shortbow', ability: 'dex', die: 6, type: 'piercing', traits: 'deadly d10, propulsive, range 60 feet, reload 0', ranged: true }],
  },
  Shieldbearer: {
    abilities: [[3, 1, 2, 0, 1, 0], [4, 1, 3, 0, 1, 0], [4, 1, 4, 1, 2, 0], [5, 2, 4, 2, 3, 0]],
    hp: 8, armor: [5, 5, 6, 7], dexCap: 1, saves: [[1, 1, 1], [2, 1, 2], [2, 1, 2], [3, 2, 3]], perception: [1, 1, 2, 2],
    skills: [{ name: 'Athletics', ability: 'str', ranks: [1, 1, 2, 3] }, { name: 'Survival', ability: 'wis', ranks: [1, 1, 2, 2] }, { name: 'Warfare Lore', ability: 'int', ranks: [1, 1, 2, 2] }, { name: 'Crafting', ability: 'int', ranks: [0, 0, 2, 2] }, { name: 'Acrobatics', ability: 'dex', ranks: [0, 0, 0, 2] }],
    attacks: [{ name: 'Longsword', ability: 'str', die: 8, type: 'slashing', traits: 'versatile P' }, { name: 'Shield Boss', ability: 'str', die: 6, type: 'bludgeoning', traits: '' }],
  },
  Adept: {
    abilities: [[0, 1, 1, 3, 2, 0], [0, 2, 1, 4, 2, 0], [0, 3, 2, 4, 3, 0], [1, 3, 3, 5, 4, 0]],
    hp: 4, armor: [1, 1, 2, 3], dexCap: 4, saves: [[1, 1, 1], [1, 2, 2], [1, 2, 2], [2, 3, 3]], perception: [1, 1, 2, 2],
    skills: [{ name: 'Arcana', ability: 'int', ranks: [1, 1, 2, 3] }, { name: 'Lore 1', ability: 'int', ranks: [1, 1, 2, 3] }, { name: 'Lore 2', ability: 'int', ranks: [1, 1, 2, 3] }],
    attacks: [{ name: 'Dagger', ability: 'dex', die: 4, type: 'piercing', traits: 'agile, finesse, thrown 10 feet, versatile S' }, { name: 'Energy Blast', ability: 'int', die: 6, type: 'chosen energy', traits: 'magical, range 60 feet', ranged: true }],
  },
}

export const FOLLOWER_TYPES = Object.keys(profiles)
export function followerStage(c: Character): Stage {
  return activeFeatsNamed(c, 'Exceptional Follower').length ? 3 : activeFeatsNamed(c, 'Veteran Follower').length ? 2
    : activeFeatsNamed(c, 'Experienced Follower').length ? 1 : 0
}
export const FOLLOWER_STAGES = ['Novice', 'Experienced', 'Veteran', 'Exceptional'] as const

export function followerStats(c: Character, type?: string, adeptSkill?: string) {
  const profile = profiles[type ?? '']
  if (!profile) return undefined
  const stage = followerStage(c)
  const [str, dex, con, int, wis, cha] = profile.abilities[stage]
  const attributes = { str, dex, con, int, wis, cha }
  const modifier = (attribute: Attribute, rank: number, item = 0) => attributes[attribute] + (rank ? c.level + rank * 2 : 0) + item
  const skills = [...profile.skills]
  if (type === 'Adept') {
    for (const name of ['Nature', 'Occultism', 'Religion']) {
      const selected = name === adeptSkill
      skills.push({ name, ability: name === 'Nature' || name === 'Religion' ? 'wis' : 'int',
        ranks: [Number(selected), Number(selected), selected ? 2 : 1, selected ? 2 : 1] })
    }
  }
  const attackRank = stage >= 2 ? 2 : 1
  const attackItem = Math.max(0, stage - 1)
  return {
    stage, attributes, hp: profile.hp + c.level * (6 + con), armor: profile.armor[stage], dexCap: profile.dexCap,
    ac: 10 + c.level + 2 + profile.armor[stage] + Math.min(dex, profile.dexCap),
    saves: (['con', 'dex', 'wis'] as const).map((ability, index) => modifier(ability, profile.saves[stage][index], stage === 3 ? 1 : 0)),
    perception: modifier('wis', profile.perception[stage]),
    skills: skills.filter(skill => skill.ranks[stage] > 0).map(skill => ({
      name: skill.name, value: modifier(skill.ability, skill.ranks[stage], skill.item?.[stage] ?? 0),
    })),
    attacks: profile.attacks.map(attack => {
      const weaponDamage = attack.ranged ? Math.floor(Math.max(0, str) / 2) : str
      const bonus = stage >= 2 ? type === 'Berserker' ? (stage === 3 ? 6 : 3)
        : type === 'Adept' && attack.name === 'Dagger' ? 0 : stage === 3 ? 4 : 2 : 0
      const damage = weaponDamage + bonus
      return { ...attack, bonus: modifier(attack.ability, attackRank, attackItem),
        damage: `${stage === 0 ? 1 : stage === 3 ? 3 : 2}d${attack.die}${damage ? `+${damage}` : ''} ${attack.type}` }
    }),
  }
}
