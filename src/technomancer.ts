import type { Character, TechnomancerProgrammingLanguage } from './types'

export const TECHNOMANCER_PROGRAMMING_LANGUAGES: readonly TechnomancerProgrammingLanguage[] = [
  'DPS++', 'FORTRUN', 'ServoShell', 'Viper',
]

export const TECHNOMANCER_LANGUAGE_RULES: Record<TechnomancerProgrammingLanguage, {
  gear: string
  spellCache: string[]
  initialHack: string
  advancedHack: string
  greaterHack: string
  spellshape: string
  firmware: string
  overclockBoost: string
  overclockPulse: string
  jailbreak: string
  advancedJailbreak: string
}> = {
  'DPS++': {
    gear: 'Tech weapons',
    spellCache: ['Supercharge Weapon', 'Caustic Conversion', 'Electrotether', 'Hydraulic Torrent', 'Impaling Spike',
      'Disintegrate', 'True Target', 'Arctic Rift', 'Implosion'],
    initialHack: 'A-Stellar Targetfinder Algorithm',
    advancedHack: 'Short-Circuit Reality',
    greaterHack: 'Supercharge Synapses',
    spellshape: 'Reach Spell',
    firmware: 'Train in martial tech weapons. Their proficiency advances with simple weapons; gain their critical specialization at level 5.',
    overclockBoost: 'Tech weapon Strikes ignore the second range increment penalty and reduce the target AC bonus from cover by 2, or 4 at level 12.',
    overclockPulse: 'Make a weapon Strike with +1 status to hit and a status damage bonus equal to half your level, rounded up.',
    jailbreak: 'At level 3, a damaging Reach Spell adds one weapon damage die to one target.',
    advancedJailbreak: 'At level 8, Reach Spell increases spell range by 60 feet instead of 30.',
  },
  FORTRUN: {
    gear: 'Tech armor',
    spellCache: ['Protection', 'Resist Energy', 'Haste', 'Unfettered Movement', 'Scouting Eye', 'Repulsion',
      'Energy Aegis', 'Gravity Field', 'Foresight'],
    initialHack: 'Force-FieldPGA',
    advancedHack: 'Magnetic Tuning',
    greaterHack: 'Supercharge Armor',
    spellshape: 'Widen Spell',
    firmware: 'Train in medium armor; its proficiency advances whenever light armor proficiency increases.',
    overclockBoost: 'The first time each round a hostile creature damages you, it takes force damage equal to half your level, rounded up.',
    overclockPulse: 'Gain +2 status AC and temporary HP equal to half your level, rounded up, until your next turn.',
    jailbreak: 'At level 3, Widen Spell lets you move up to 5 feet per spell rank before the spell resolves, without triggering reactions.',
    advancedJailbreak: 'At level 8, Widen Spell adds 5 feet to qualifying bursts and short cones or lines, or 10 feet to longer cones or lines.',
  },
  ServoShell: {
    gear: 'Tech minions',
    spellCache: ['Summon Robot', 'Illusory Creature', 'Discharge', 'Speak with Computers', 'Control Machine',
      'Dominate', 'Wall of Steel', 'Phantasmal Fleet', 'Telekinetic Tantrum'],
    initialHack: 'Repair Protocols',
    advancedHack: 'Bonding Charge',
    greaterHack: 'Supercharge Satellite',
    spellshape: 'Signal Relay',
    firmware: 'Gain a personal minibot that can be summoned and repaired while Refocusing; its maximum HP increases by your level. You can transplant features from a purchased minibot.',
    overclockBoost: 'Your overclocked minion gains +1 item bonuses to attack and AC (+2 at level 10, +3 at level 15); after summoning it, those bonuses apply before it acts.',
    overclockPulse: 'Sustain the minion spell or command the minion, and grant it temporary HP equal to half your level, rounded up.',
    jailbreak: 'At level 3, Signal Relay can affect a tech minion within 120 feet without line of effect.',
    advancedJailbreak: 'At level 8, a non-polymorph spell with no harmful effects and a duration of 1 hour or less can affect both you and your minion, with its duration halved.',
  },
  Viper: {
    gear: 'Spell chips and spell gems',
    spellCache: ['Delete', 'Translate', 'Locate', 'Creation', 'Truespeech', 'Truesight', 'Contingency', 'Pinpoint', 'Foresight'],
    initialHack: 'Amplify Vulnerability',
    advancedHack: 'Torrent Spell',
    greaterHack: 'Supercharge Prism',
    spellshape: 'Universal Spell Bus',
    firmware: 'Create temporary spell gems during daily preparations, one for each spell rank you can cast.',
    overclockBoost: 'Use an overclocked spell chip or spell gem as an arcane spell if you could cast a spell of the same or lower rank with your technomancer slots.',
    overclockPulse: 'Use Universal Spell Bus; after casting from the overclocked item, Overclock Gear can follow as a free action.',
    jailbreak: 'At level 3, Universal Spell Bus can be followed by a free Overclock Gear action.',
    advancedJailbreak: 'At level 8, a spell gem used with Universal Spell Bus can be fired as an electromag grenade.',
  },
}

export function versatileTechnomancerLanguageOptions(c: Character) {
  const primary = c.className === 'Technomancer'
    ? c.technomancerProgrammingLanguage
    : c.feats.find(feat => feat.name === 'Technomancer Dedication')?.choice
  return primary ? TECHNOMANCER_PROGRAMMING_LANGUAGES.filter(language => language !== primary) : []
}
