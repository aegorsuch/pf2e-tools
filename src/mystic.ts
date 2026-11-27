export interface MysticConnection {
  initial: string
  advanced: string
  greater: string
  harmony: string
  perfectHarmony: string
}

export const MYSTIC_CONNECTIONS: Record<string, MysticConnection> = {
  Akashic: { initial: 'Akashic Fount', advanced: 'Akashic Assistant', greater: 'Data Drain',
    harmony: 'When you Transfer Vitality, the target receives a psychic download from the Akashic Record and can immediately attempt to Recall Knowledge as a reaction. This does not trigger any special abilities, reactions, or free actions that trigger when a creature uses Recall Knowledge.',
    perfectHarmony: 'You create an extradimensional memory palace that functions as planar palace. Creating a door to the demiplane takes 1 minute. The memory palace keeps the same layout each time you access it, adjustable during daily preparations. Each phantasmal minion in your memory palace functions as an akashic assistant.' },
  Elemental: { initial: 'Elemental Weapon', advanced: 'Elemental Barrier', greater: 'Elemental Nova',
    harmony: 'When you Transfer Vitality, choose an elemental trait: air, earth, fire, metal, water, or wood. If one or more of your elemental epiphanies are active, you must select the elemental trait you chose as part of casting those spells. Until the end of their next turn, the target\'s next Strike deals damage based on the chosen trait (your choice), rather than its typical damage type: electricity or sonic for air, bludgeoning or piercing for earth, acid or slashing for metal, fire for fire, bludgeoning or cold for water, or piercing or poison for wood.',
    perfectHarmony: 'During your daily preparations, choose an elemental trait. You gain resistance equal to half your level to both damage types associated with the element you selected. If you chose fire, you additionally gain resistance to cold. Whenever you heal a bonded ally with Transfer Vitality, the target gains these resistances until the beginning of your next turn.' },
  Healing: { initial: 'Infusion', advanced: 'Vitality Nova', greater: 'Vital Rebirth',
    harmony: 'When you Transfer Vitality, attempt to counteract one affliction affecting the target, or attempt to counteract one effect of your choice imposing one of the following conditions on the target: blinded, clumsy, dazzled, deafened, enfeebled, sickened.',
    perfectHarmony: 'Add doomed, drained, paralyzed, and stunned to the list of conditions you can counteract with your harmony. In addition, if you did not counteract the effect, but you would have if its counteract rank were 2 lower, instead suppress the effect until the beginning of your next turn. The effect\'s duration does not elapse while it is suppressed.' },
  Rhythm: { initial: 'Anthem', advanced: 'Shuffle Repeat', greater: 'Remix',
    harmony: 'When you Transfer Vitality, you can extend the duration of any active epiphany from the rhythm connection by 1 round.',
    perfectHarmony: 'The first time each round you Transfer Vitality, the target who regained Hit Points can Stride as a free action. This has the traversal trait.' },
  Shadow: { initial: 'Shadow Snap', advanced: 'Cloying Shadows', greater: 'Shadow Prison',
    harmony: 'When you Transfer Vitality, the target\'s shadow darkens and swells, reducing bright light within a 10-foot emanation of the target to dim light. This is a form of magical darkness and can overcome non-magical light sources or attempt to counteract magical light. The target becomes concealed while in this dim light and can use the concealed condition to Hide. This lasts until the end of your next turn.',
    perfectHarmony: 'You gain the Umbral Stride action. When you Transfer Vitality, the target can use this action once before the end of their next turn.' },
}
