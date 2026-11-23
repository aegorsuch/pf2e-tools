export type RunesmithRune = { name: string; level: number; traits: string[]; usage: string; description: string }

export const RUNESMITH_RUNES: RunesmithRune[] = [
 {
  "name": "Atryl, Rune of Fire",
  "level": 1,
  "traits": [
   "Fire",
   "Primal"
  ],
  "usage": "drawn on a creature or object",
  "description": "This rune is often placed on a stone in a hearth, its power ensuring the stone remains warm through the night. The bearer’s fire resistance, if any, is reduced by 5. Its immunities are unaffected.\n\nInvocation\nThe bearer takes 1d8 fire damage with a basic Fortitude save. On a critical failure, it's also dazzled for 1 round.\n\nLevel (+2) The reduction in fire resistance increases by 1, and the damage of the invocation increases by 1d8."
 },
 {
  "name": "Baruiel, Rune of Hold's Bravery",
  "level": 1,
  "traits": [
   "Emotion",
   "Magical",
   "Mental"
  ],
  "usage": "drawn on a willing creature",
  "description": "This scratched rune reminds the bearer to stand strong against fear when near allies. As long as the rune-bearer is within 10 feet of one of its allies, whenever it would reduce its frightened condition by 1, it instead reduces it by 2.\n\nInvocation\nThe essence of the rune is released outward, easing the minds of others. Each ally of the rune-bearer within a 10-foot emanation reduces their frightened condition by 2."
 },
 {
  "name": "Camonica, Rune of Perplexity",
  "level": 1,
  "traits": [
   "Mental",
   "Occult"
  ],
  "usage": "drawn on a creature",
  "description": "This rune of looping swirls is difficult to look straight at and stirs up a psychic cacophony in a foe's mind. The first time each round the rune-bearer takes an action with the concentrate trait, the turmoil increases, dealing it 2 mental damage.\n\nInvocation\nThe cacophony fragments and expands rapidly in a mental explosion, dealing 1d4 mental damage to the rune- bearer with a basic Will save. On a failure, the rune-bearer is stupefied 1  for 1 round (or stupefied 2 on a critical failure).\n\nLevel (+2) The damage from the mental turmoil increases by 1 and the damage of the invocation increases by 1d4."
 },
 {
  "name": "Esvadir, Rune of Whetstones",
  "level": 1,
  "traits": [
   "Magical"
  ],
  "usage": "drawn on a weapon or unarmed attack that deals piercing or slashing damage",
  "description": "This cuspate rune, when placed on a blade, ensures it won't go dull. Strikes with the weapon or unarmed attack deal an extra 2 persistent bleed damage per weapon damage die.\n\nInvocation\nA blast of cutting energy is released outward from the rune, dealing 1d8 slashing damage to a creature adjacent to the rune-bearer, with a basic Reflex save.\n\nLevel (+2) The damage of the invocation increases by 1d8."
 },
 {
  "name": "Holtrik, Rune of Dwarven Ramparts",
  "level": 1,
  "traits": [
   "Magical"
  ],
  "usage": "drawn on a shield",
  "description": "Similarity in the Dwarven words for “wall” and “shield” ensure that this angular rune, once used to shore up tunnels, can apply equally well in the heat of battle. A creature that has the shield raised gains a +1 status bonus to AC.\n\nInvocation\nYou call the shield to its rightful place. You Raise the Shield bearing the rune, as if the rune-bearer had used Raise a Shield, and the shield's status bonus to AC lasts until the beginning of the creature's next turn."
 },
 {
  "name": "Ledria, Rune of Appeal",
  "level": 1,
  "traits": [
   "Occult"
  ],
  "usage": "drawn on a creature",
  "description": "No matter what skin, shell, or scale this rune is drawn on, it shines like gold. The rune-bearer gains a +1 status bonus to Deception, Diplomacy, and Performance checks.\n\nInvocation\nThe rune draws creatures closer to the bearer. Each creature within 30 feet of the rune-bearer can Step closer to the rune-bearer as a free action.\n\nLevel (9th) The bonus increases to +2.\n\nLevel (17th) The bonus increases to +3."
 },
 {
  "name": "Lyskel, Rune of Frost",
  "level": 1,
  "traits": [
   "Cold",
   "Primal"
  ],
  "usage": "drawn on a creature or object",
  "description": "This rune is often placed on chests and boxes to keep their contents from spoiling, even in the hottest of climates. The rune-bearer takes a –5-foot circumstance penalty to its Speeds and becomes so cold that movement becomes dangerous; if the bearer takes a move action, it becomes clumsy 1 until the beginning of its next turn.\n\nInvocation\nThe rune-bearer takes 1d4 cold damage, with a basic Fortitude save. All squares on the ground in the bearer's space and adjacent squares are covered in snow, becoming difficult terrain for 1 round.\n\nLevel (+2) The damage of the invocation increases by 1d4."
 },
 {
  "name": "Marssyl, Rune of Impact",
  "level": 1,
  "traits": [
   "Magical"
  ],
  "usage": "drawn on a weapon or unarmed attack that deals bludgeoning damage",
  "description": "This rune magnifies force many times over as it passes through the rune's concentric rings. The weapon or unarmed attack deals 1 bludgeoning splash damage per weapon damage die. If the rune is on a melee weapon or melee unarmed attack, you and the rune-bearer are immune to this splash damage.\n\nInvocation\nThe rune vibrates as power concentrates within it. The next successful Strike made with the weapon or unarmed attack before the end of its wielder's next turn deals an additional die of damage, and the target must succeed at a Fortitude save against your class DC or be pushed 10 feet away from the attacker (20 feet on a critical failure)."
 },
 {
  "name": "Oljinex, Rune of Cowards' Bane",
  "level": 1,
  "traits": [
   "Arcane"
  ],
  "usage": "drawn on a shield",
  "description": "This rune resembles a broken arrow. The shield bearing the rune gains a +2 status bonus to its Hardness against physical damage from ranged attacks.\n\nInvocation\n(illusion, mental, visual) The rune creates an illusion in the minds of all creatures adjacent to the rune-bearer that lasts for 1 round. The illusion is of a large, impassable wall blocking all paths away from the rune-bearer. Creatures affected by this invocation can't willingly move farther away from the rune-bearer for 1 round or until they disbelieve the illusion, usually by using a Seek action.\n\nLevel (+4) The status bonus to Hardness increases by 1."
 },
 {
  "name": "Pluuna, Rune of Illumination",
  "level": 1,
  "traits": [
   "Light",
   "Magical"
  ],
  "usage": "drawn on a creature or armor",
  "description": "While many runes emit a faint glow, illumination is the focus of this simple rune. The rune sheds bright light in a 20-foot emanation (and dim light to 40 feet). Creatures in the emanation take a –1 item penalty to Stealth checks.\n\nInvocation\nEach creature in the light must succeed at a Fortitude save against your class DC or be dazzled for 1 round. The light fades, but the target still sheds dim light in a 20-foot emanation for 1 round."
 },
 {
  "name": "Ranshu, Rune of Thunder",
  "level": 1,
  "traits": [
   "Electricity",
   "Primal"
  ],
  "usage": "drawn on a creature or object",
  "description": "This vertical rune is often carved on tall towers to draw lightning and shield the buildings below it. If the rune-bearer doesn't take a move action at least once on its turn, a small bolt of static finds it, dealing 3 electricity damage.\n\nInvocation\nThe preliminary streaks of lightning braid together into a powerful bolt. The rune-bearer takes 1d8 electricity damage with a basic Fortitude save.\n\nLevel (+2) The damage from the bolt of static increases by 1, and the damage of the invocation increases by 1d8."
 },
 {
  "name": "Rehgog, Rune of Bestial Might",
  "level": 1,
  "traits": [
   "Morph",
   "Primal"
  ],
  "usage": "drawn on a willing creature",
  "description": "The jagged edges of this rune evoke the claws and talons of mighty beasts. The target's nose becomes an animal-like snout, giving the rune-bearer scent as an imprecise scent with a range of 30 feet.\n\nInvocation\nThe rune-bearer's muscles bulge with the strength of a ferocious beast. The bearer can immediately Step as a free action. The next unarmed Strike the bearer attempts before the start of your next turn deals an additional die of damage."
 },
 {
  "name": "Sertum, Rune of Preparedness",
  "level": 1,
  "traits": [
   "Primal"
  ],
  "usage": "drawn on a creature",
  "description": "The wavy lines of this rune evoke fields of reeds, the branches of trees blowing in the wind, or other natural phenomena. The rune-bearer gains a +1 status bonus to Survival checks and to Lore checks related to a type of terrain or specific natural location you choose as you draw the rune. The rune-bearer can use Survival to roll initiative, and the status bonus applies to this roll.\n\nInvocation\nThe rune reaches out to the surrounding terrain, shifting it to the rune-bearer's advantage. The rune-bearer can Step up to three times as a free action.\n\nLevel (9th) The bonus increases to +2.\n\nLevel (17th) The bonus increases to +3."
 },
 {
  "name": "Thullax, Rune of Corrosion",
  "level": 1,
  "traits": [
   "Acid",
   "Arcane"
  ],
  "usage": "drawn on a creature or object",
  "description": "The swooping lines of this rune seem to melt into each other as if their edges were hazy and indistinct, though the meaning is clear to you. The rune-bearer's resistance to each physical damage type is reduced by 1 (if it has any such resistances). Its immunities are unaffected.\n\nInvocation\nThe bearer takes 1d6 acid damage with a basic Fortitude save; on a critical failure, it takes 1 persistent acid damage.\n\nLevel (+2)  The reduction in physical resistance increases by 1, the damage of the invocation increases by 1d6, and the persistent damage increases by 1."
 },
 {
  "name": "Tilus, Rune of Vocabulary",
  "level": 1,
  "traits": [
   "Arcane",
   "Mental"
  ],
  "usage": "drawn on a creature",
  "description": "Upon close inspection, this rune comprises hundreds of smaller characters of various runic languages. When you etch or trace this rune, choose one language you know. The rune-bearer can speak and understand the chosen language and gains a +1 status bonus to Society checks and to Lore checks related to writing (such as Library Lore and Scribing Lore).\n\nInvocation\nThe rune-bearer's voice rings clear and true, allowing them to automatically succeed at any flat check that could disrupt an auditory action (such as the one imposed by the deafened condition) for 1 round. During this time, the bearer can also speak their true mind even if they are currently confused, controlled, or otherwise unable to speak.\n\nLevel (9th) The bonus increases to +2.\n\nLevel (17th) The bonus increases to +3."
 },
 {
  "name": "Zohk, Rune of Homecoming",
  "level": 1,
  "traits": [
   "Arcane"
  ],
  "usage": "drawn on a creature",
  "description": "This circular mark allows travelers to always find their way home. The rune-bearer gains a +15-foot status bonus to its Speeds, but only when its movement would end closer to you than where the creature started its turn.\n\nInvocation\n(teleportation) You call the rune-bearer to your side. You teleport the target to any unoccupied square adjacent to you. If the bearer is unwilling, it must succeed at a Will save to negate the effect."
 },
 {
  "name": "Av-, Diacritic Rune of Succession",
  "level": 5,
  "traits": [
   "Diacritic",
   "Magical"
  ],
  "usage": "drawn on a rune",
  "description": "This diacritic surrounds the base rune with similar-looking smaller runes to give the impression of distant echoes. When the base rune is invoked, you can Invoke a single Rune on a different rune-bearer within 15 feet of the original rune-bearer as a free action.\n\nYou can have only one copy of av-, diacritic rune of succession applied at a given time, and once you invoke it, you can't etch or trace it again for 10 minutes."
 },
 {
  "name": "En-, Diacritic Rune of Expansion",
  "level": 5,
  "traits": [
   "Diacritic",
   "Magical"
  ],
  "usage": "drawn on a rune that deals damage",
  "description": "This diacritic surrounds a rune with outward-facing arrows to magnify and direct power outward. When the base rune is invoked, the rune-bearer is affected by it as usual, and each other creature in a 15-foot emanation around the rune-bearer also takes the damage and other effects from the base rune (and can attempt a saving throw if possible). An individual creature can be affected by the rune only once, even if the rune could normally affect more creatures than just the rune-bearer."
 },
 {
  "name": "Fob-, Diacritic Rune of Doubling",
  "level": 5,
  "traits": [
   "Diacritic",
   "Magical"
  ],
  "usage": "drawn on a rune that doesn't deal damage",
  "description": "This diacritic consists of pairs of diamonds in opposite positions around the base rune. When the base rune is invoked, the rune-bearer is affected by it as usual, and you can choose to also be affected by the invocation if possible."
 },
 {
  "name": "Kit-, Diacritic Rune of Mercy",
  "level": 5,
  "traits": [
   "Diacritic",
   "Magical"
  ],
  "usage": "drawn on a rune that deals damage and doesn't have the death or void trait",
  "description": "This diacritic frames a rune with soft curves that mitigate its deadlier effects but make them harder to resist. When the base rune is invoked, it has the nonlethal trait, but the rune-bearer takes a –1 status penalty to any saving throw."
 },
 {
  "name": "Per-, Diacritic Rune of Continuum",
  "level": 5,
  "traits": [
   "Diacritic",
   "Magical"
  ],
  "usage": "drawn on a rune",
  "description": "This whirling diacritic recirculates the magic of the base rune onto another creature. After the base rune is invoked, it automatically traces itself on a different target of your choice within 15 feet of the original rune-bearer.\n\nYou can have only one copy of per-, diacritic rune of continuum applied at a given time, and once you invoke it, you can't etch or trace it again for 10 minutes."
 },
 {
  "name": "Sun-, Diacritic Rune of Preservation",
  "level": 5,
  "traits": [
   "Diacritic",
   "Magical"
  ],
  "usage": "drawn on a rune",
  "description": "This spiraling diacritic channels the magic of a rune outwards, then back to the same location, allowing a rune to reconstitute itself. After the base rune is invoked, the base rune automatically traces itself back upon the same target.\n\nYou can have only one copy of sun-, diacritic rune of preservation applied at a given time, and once you invoke it, you can't Etch or Trace the Rune again for 10 minutes."
 },
 {
  "name": "Ti-, Diacritic Rune of Fundaments",
  "level": 5,
  "traits": [
   "Diacritic",
   "Magical"
  ],
  "usage": "drawn on a rune that deals acid, cold, electricity, or fire damage",
  "description": "This wavering diacritic encompasses the base rune to slightly change its meaning. When the base rune is invoked, you can alter the damage its invocation deals, choosing acid, cold, electricity, or fire."
 },
 {
  "name": "Ur-, Diacritic Rune of Intensity",
  "level": 5,
  "traits": [
   "Diacritic",
   "Magical"
  ],
  "usage": "drawn on a rune that deals damage",
  "description": "This diacritic accentuates the base rune with bolder lines to give greater weight to its effects. When the base rune is invoked, its invocation gains a status bonus to damage equal to 2 plus half your level."
 },
 {
  "name": "Astillu, Rune of Submersion",
  "level": 9,
  "traits": [
   "Magical",
   "Water"
  ],
  "usage": "drawn on a creature",
  "description": "Originating from Thalassic script, this wavy rune is popular with iruxi practitioners of rune magic who want to easily traverse their watery environs. The rune-bearer can breathe underwater and gains a swim Speed  equal to its land Speed or 30 feet, whichever is greater. Its melee Strikes don't take the usual circumstance penalty for passing through water.\n\nInvocation\nThe rune's power pushes the bearer forward in a surprising surge of speed. The rune-bearer can Swim up to 60 feet as a free action, and this movement doesn't trigger reactions."
 },
 {
  "name": "Cruonign, Rune of Leeching",
  "level": 9,
  "traits": [
   "Death",
   "Magical",
   "Void",
   "Negative"
  ],
  "usage": "drawn on a slashing or piercing weapon",
  "description": "The jagged shape of this rune resembles a vampire's fangs. Strikes with the rune-bearing weapon deal an additional 3 void damage. Whenever a living creature is damaged by one of these Strikes, the rune-bearer gains temporary Hit Points equal to the void damage the target took (after applying resistances and the like). These temporary Hit Points last 1 round.\n\nInvocation\nThe rune lashes out in a 30-foot cone from the wielder of the weapon, dealing 4d10 void damage to each creature in the area, with a basic Fortitude save. If any creatures take damage, the wielder regains 12 Hit Points.\n\nLevel (+2) The additional void damage increases by 1, the damage of the invocation increases by 1d10, and the healing increases by 3."
 },
 {
  "name": "Feikris, Rune of Gravity",
  "level": 9,
  "traits": [
   "Arcane"
  ],
  "usage": "drawn on a creature wearing armor",
  "description": "The lines of this rune overlap strangely, making it seem larger than it really is. The rune-bearer gains a +2 status bonus to Athletics checks. They can Disarm, Grapple, Reposition, Shove, or Trip creatures up to two sizes larger than themself, or three sizes larger if the rune-bearer is legendary in Athletics.\n\nInvocation\nAll creatures in a 15-foot emanation around the rune-bearer must succeed at a Fortitude save or be pulled 5 feet toward the rune-bearer (or 10 feet on a critical failure).\n\nLevel (17th) The status bonus increases to +3."
 },
 {
  "name": "Germantria, Rune of Partnership",
  "level": 9,
  "traits": [
   "Magical"
  ],
  "usage": "drawn on a creature",
  "description": "When drawn, this knobby rune pulses with your own heartbeat, creating a vital connection between you and the bearer. While you are within 1 mile of the rune-bearer, it takes half damage from all effects that deal Hit Point damage, and you take the remainder of the damage. When you take this damage, you don't apply any resistances, weaknesses, or other abilities you have to that damage; you simply take that amount of damage. If either you or the rune-bearer is reduced to 0 Hit Points, the rune fades without being invoked.\n\nInvocation\n(healing) The connection between you and the rune-bearer is severed in a burst of healing energy. Both you and the rune-bearer regain 20 Hit Points.\n\nLevel (+2) The amount of Hit Points healed by the invocation increases by 5."
 },
 {
  "name": "Ichelsu, Rune of Observation",
  "level": 9,
  "traits": [
   "Occult"
  ],
  "usage": "drawn on a creature",
  "description": "A ring of dotted circles, this rune allows a creature marked with it to see all. The target is affected by see the unseen and gains all-around vision, which prevents it from being flanked.\n\nInvocation\nThe eyes of the rune fly outwards, attaching to all creatures in a 20-foot emanation. A creature with an eye attached to it that would be invisible is concealed instead, and one that would be concealed for any other reason is not concealed. This effect lasts for 2 rounds."
 },
 {
  "name": "Jurroz, Rune of Dragon Fury",
  "level": 9,
  "traits": [
   "Magical"
  ],
  "usage": "drawn onto a creature",
  "description": "This craggy rune channels the fury of dragon kind. Whenever an enemy Strikes or Steals from the rune-bearer, they become off-guard for 1 round. \n\nInvocation\nAs a free action, the rune-bearer can Fly up to 60 feet toward an enemy that has damaged it or stolen from it in the last minute. If it ends this movement adjacent to the enemy, the enemy becomes off-guard until the end of the rune-bearer's next turn. If the rune-bearer doesn't have a fly Speed and ends its movement in the air, it safely floats back to the ground at the end of its next turn."
 },
 {
  "name": "Kojastri, Rune of Insulation",
  "level": 9,
  "traits": [
   "Arcane"
  ],
  "usage": "drawn on armor",
  "description": "This rune insulates from harmful energy of all kinds. The creature wearing the armor gains resistance 4 to your choice of cold, electricity, or fire, and any creature that touches the rune-bearer or damages it with an unarmed attack or non-reach melee weapon takes 2 damage of the chosen type. The rune has the trait of the energy type chosen.\n\nInvocation\nAny creature that has the armor's wearer engulfed, grabbed, restrained, or swallowed whole takes 8d4 damage of the rune's chosen type with a basic Reflex save against your class DC. On a failure, it also releases the armor's wearer.\n\nLevel (+2) The resistance and damage granted by insulation both increase by 1, and the damage dealt by the invocation increases by 2d4."
 },
 {
  "name": "Oraloq, Rune of Inarticulateness",
  "level": 9,
  "traits": [
   "Magical",
   "Mental"
  ],
  "usage": "drawn on a creature",
  "description": "This hard-to-read rune makes language difficult for the unfortunate rune-bearer. When the rune-bearer attempts a skill check or ability with the linguistic trait or attempts to Cast a Spell that doesn't have the subtle trait, they must succeed a DC 5 flat check, or the action is lost.\n\nInvocation\nThe rune-bearer must attempt a Will save as the rune puts a strong mental block on the part of their mind that interprets language. If the rune-bearer fails their save, they take 20 mental damage (or double damage on a critical failure) the first time they use any language, take a linguistic action, or Cast a Spell without the subtle trait. The rune-bearer is aware of this and knows what will trigger the damage. The effect ends once the damage is taken or at the end of the rune-bearer's next turn, whichever comes first.\n\nLevel (+2) The damage of the invocation increases by 5."
 },
 {
  "name": "Piteregrin, Rune of Transposition",
  "level": 9,
  "traits": [
   "Magical"
  ],
  "usage": "drawn onto a creature",
  "description": "The slanted lines and odd curls of this rune give the impression that it is trying to escape. The rune-bearer can use a single action to swap places with any other willing rune-bearer within 15 feet. (The other rune-bearer can be bearing any rune.) Each creature must have room to appear in its new location or the effect is disrupted. This action has the concentrate and teleportation traits.\n\nInvocation\n(teleportation) The rune grows to an enormous size, swallowing up the rune-bearer and each Large or smaller creature adjacent to them, and then immediately spits them back out. Choose a square within a 15-foot emanation from the rune-bearer's original position for each swallowed creature to reappear. A Large creature doesn't necessarily need to reappear completely within the emanation, as long as one of its squares is. An unwilling creature avoids being teleported if it succeeds at a Will save against your class DC."
 },
 {
  "name": "Trolistri, Rune of Forlorn Sorrow",
  "level": 9,
  "traits": [
   "Arcane",
   "Emotion",
   "Mental"
  ],
  "usage": "drawn onto a creature",
  "description": "This rune calls to mind the beauty hidden in sorrow. While this rune is beautiful, sorrow is best admired from a distance, discouraging approach. Enemies within 20 feet of the rune-bearer treat all spaces between them and the rune-bearer as difficult terrain.\n\nInvocation\nSorrow blots out the capacity for any other action. Each enemy in a 15-foot emanation around the rune-bearer must succeed at a Will saving throw or be slowed 1 for 1 round as it spends the first action of its next turn sobbing (slowed 2 on a critical failure). Regardless of the outcome, the creature is then temporarily immune to the invocation of trolistri, rune of forlorn sorrow for 1 hour."
 },
 {
  "name": "Ulgatus, Rune of Restraint",
  "level": 9,
  "traits": [
   "Magical"
  ],
  "usage": "drawn on armor",
  "description": "A faction of the constructed beings called automatons developed this rune to avoid the weaknesses of flesh. When the creature wearing the armor would gain or increase the value of their drained, enfeebled, or sickened condition, the rune attempts to prevent the imposition. The bearer attempts a DC 15 flat check. On a success, it doesn't gain or increase the value of that condition, but the rune goes temporarily dormant for 10 minutes. While dormant, the rune can't protect the bearer from conditions but can be invoked.\n\nInvocation\nThe rune causes the armor to grow around the creature wearing it, fortifying any vulnerable spots. For 1 minute, the wearer gains resistance 10 to critical hits.\n\nLevel (17th) The DC of the flat check decreases to 10 and the resistance to critical hits increases to 20."
 },
 {
  "name": "Yudici, Rune of Remonstrance",
  "level": 9,
  "traits": [
   "Aura",
   "Divine",
   "Magical"
  ],
  "usage": "drawn on a shield",
  "description": "This majestic rune grants the shield's wielder the conviction to aid their allies. While a shield bearing this rune is raised, its bearer emits an aura in a 10-foot emanation that grants their allies a +1 circumstance bonus to AC.\n\nInvocation\nThe shield regains 40 Hit Points, and all of the bearer's allies in a 10-foot emanation gain a +1 status bonus to attack rolls and skill checks for 1 round.\n\nLevel (+3) The Hit Points restored increases by 10."
 },
 {
  "name": "Eck-, Diacritic Rune of Phantasma",
  "level": 13,
  "traits": [
   "Diacritic",
   "Magical"
  ],
  "usage": "drawn on a rune that deals damage",
  "description": "This diacritic frames a base rune with almost invisible lines that turn the rune's effects against the bearer's soul. The damage dealt on the base rune becomes spirit damage, and each of your enemies adjacent to the rune-bearer takes 1d8 persistent spirit damage.\n\nLevel (17th) The persistent spirit damage increases by 1d8."
 },
 {
  "name": "Inth-, Diacritic Rune of Corruption",
  "level": 13,
  "traits": [
   "Diacritic",
   "Divine",
   "Unholy"
  ],
  "usage": "drawn on a rune",
  "description": "This set of angular accents around the base rune channels the essence of fiendish corruption. The base rune gains the unholy trait, as does any damage it deals. If applied to a holy creature, that creature is enfeebled 2 for as long as it bears the rune.\n\nInvocation\n(fire) When the base rune is invoked, it burns away in unholy black fire that lingers on its target. In addition to the base rune's normal effect, the target takes 2d4 persistent fire damage.\n\nLevel (+2) The persistent fire damage increases by 2d4."
 },
 {
  "name": "Nesh-, Diacritic Rune of Contingency",
  "level": 13,
  "traits": [
   "Diacritic",
   "Magical"
  ],
  "usage": "drawn on a rune",
  "description": "The wavy lines of this diacritic seem to stretch the base rune into a wider area. When you draw this rune, choose a trigger that when met will invoke the base rune, using the same restrictions as for the trigger of a Ready action. When the trigger is met, you can Invoke the base Rune as a reaction; you can't invoke any additional runes with that reaction. If you define complicated conditions, as determined by the GM, the trigger might fail.\n\nYou can have only one nesh-, diacritic rune of contingency applied at a given time, and once you invoke it, you can't etch or trace it again for 10 minutes."
 },
 {
  "name": "Sar-, Diacritic Rune of Righteousness",
  "level": 13,
  "traits": [
   "Diacritic",
   "Divine",
   "Holy"
  ],
  "usage": "drawn on a rune",
  "description": "Clean arcs of gold faintly glow on the base rune, evoking celestial order and serenity. The base rune gains the holy trait, as does any damage it deals. If applied to an unholy creature, that creature is enfeebled 2 for as long as it bears the rune.\n\nInvocation\nWhen the base rune is invoked, it shines with holy light that harshly judges the target for any of its sins. In addition to the base rune's normal effect, the target is drained 1."
 },
 {
  "name": "Aiuen, The Elf-Gate Key",
  "level": 17,
  "traits": [
   "Arcane",
   "Teleportation"
  ],
  "usage": "drawn on a creature",
  "description": "This masterful circular rune is a key to the aiudara network of elf gates that stretch across the stars. Once per turn, when the rune-bearer Strides, it can instead teleport a distance equal to its Speed.\n\nInvocation\nYou teleport the rune-bearer to a location adjacent to any of your other runes, as long as it is on the same plane. An unwilling target can be teleported a maximum distance of 60 feet, and it avoids being teleported at all if it succeeds at a Will save against your class DC.\n\nIf you have the ability to cast the sigil cantrip, then you can use aiuen, the elf-gate key's invocation to teleport the rune-bearer to a location adjacent to any of your sigils on the same plane, in addition to any of your runes."
 },
 {
  "name": "Ochygholl, The Poisoned Star",
  "level": 17,
  "traits": [
   "Magical"
  ],
  "usage": "drawn on a creature",
  "description": "This awe-inspiring rune of pointed curves is rumored to have been part of the magic that alghollthus used to call down the meteoroids of the Earthfall cataclysm. The rune-bearer senses a foreboding shadow overhead and that something terrible is about to happen. This dread is contagious. The rune-bearer becomes doomed 1, and its allies that begin their turn adjacent to the rune-bearer also become doomed 1 for 1 round. Each creature doomed this way takes 10 mental damage the first time each round it attempts an attack roll or skill check.\n\nInvocation\n(fire) The rune calls a meteorite down on the rune-bearer, fulfilling its terrible promise. Each creature in a 10-foot burst centered on a corner in the rune-bearer's space takes 3d10 bludgeoning damage with a basic Reflex save. Then, each creature within a 40-foot burst centered on that same corner takes 8d6 fire damage, also with a basic Reflex save. This invocation has the death trait for doomed creatures."
 },
 {
  "name": "Rovan, Seal of the Dead Vault",
  "level": 17,
  "traits": [
   "Divine",
   "Earth"
  ],
  "usage": "drawn on a creature",
  "description": "This mighty, jagged rune is just one of several that keeps the Destroyer sealed in his prison, deep in Golarion's core. The creature takes a –20-foot status penalty to its land Speed and a –40-foot status penalty to all other Speeds as the rune attempts to bind the creature. If a creature's fly Speed is reduced to 0 this way, it can't take the Fly or Arrest a Fall actions.\n\nInvocation\n(incapacitation) The ground in the rune-bearer's space and in a 10-foot emanation becomes difficult terrain permanently, and the rune-bearer must attempt a Fortitude saving throw as the earth around it attempts to surround and imprison it. The rune-bearer is then immune to your rovan, seal of the Dead Vault runes for 24 hours. \n\nCritical Success The bearer is unaffected.\nSuccess The rune-bearer becomes slowed 1 for 1 round.\nFailure The rune-bearer becomes slowed 2 for 1 round.\nCritical Failure The bearer becomes restrained and blinded as it is trapped in a massive, compressed sphere of earth. While restrained, the bearer is also slowed 2. If the bearer is unable to escape the sphere within 3 rounds, it becomes petrified. Over the course of a year, the sphere forms a small hill around it, hiding its buried prisoner. At the top of the hill, a stone with the image of this rune remains. Counteracting the stone frees the prisoner."
 },
 {
  "name": "Xinsala, The Well of Virtues",
  "level": 17,
  "traits": [
   "Magical"
  ],
  "usage": "drawn on an unoccupied square",
  "description": "This complex rune comprises many different ligatures from the ancient Thassilonian runes representing the seven virtues of rule, before they were corrupted by the runelords. When drawn, it creates a well of glowing energy that occupies the square it's drawn on and creates an aura of swirling, virtuous runes in a 30-foot emanation. While in the aura, you or any of your allies gain a +1 status bonus to AC against magic, a +1 status bonus to saving throws against magic, and resistance 10 to damage from magical effects.\n\nInvocation\n(healing, vitality) The well explodes outward with invigorating force. The well heals any number of creatures in its area for a total of 70 Hit Points divided as you choose, and you and each of your allies in the area gain a +20-foot status bonus to your Speeds and are quickened for 1 round. The extra action from quickened can be used only to Stride or Strike."
 }
]
