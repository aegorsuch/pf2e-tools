import { updateSettings, useSettings, type Settings } from './settings'

const RULES: { key: keyof Settings; label: string; description?: string }[] = [
  { key: 'singleAdditionalArms', label: 'Additional Arms: Once' },
  { key: 'singleAugmentedBody', label: 'Augmented Body: Once' },
  { key: 'singleDistantTelepath', label: 'Distant Telepath: Once' },
  { key: 'adoptedDwarfClanDagger', label: 'Adopted Ancestry (Dwarf) Grants Clan Dagger' },
  { key: 'autoClassSkills', label: 'Auto-Advance Class-Specific Skills' },
  { key: 'autoLores', label: 'Auto-Advance Lores' },
  { key: 'avengerEldritchHighestMental', label: 'Avenger Eldritch Trickster Uses Highest Mental Attribute',
    description: 'For an Avenger gaining Eldritch Trickster through Versatile Rogue, the granted multiclass dedication uses the highest mental attribute for its spellcasting attribute and corresponding prerequisite.' },
  { key: 'sf2eDeitySkills', label: 'SF2e Deities Grant Skills',
    description: "Non-Champions and non-Avengers gain training in their deity's divine skill. If already trained, gain another trained skill choice." },
  { key: 'consolidateInnateTraditions', label: 'Consolidate Innate Spell Traditions' },
  { key: 'uniqueInnateSpellChoices', label: 'Avoid Duplicate Innate Spell Choices',
    description: 'Innate spell choices exclude spells already known from another source. Existing choices are preserved.' },
  { key: 'automaticSfWeaponUpgrades', label: 'Automatic Starfinder Weapon Upgrades',
    description: "SLARP gains Smuggler's Grip and Flaming Module; Shuriken Drone gains Retrieval Boosters; Singing Spear gains Retrieval Boosters and Loudener; Shock Pad gains Shock Module; Hardlight Handwraps gain Grappling and Shoving Modules. Upgrades appear at their item levels and improve by character level." },
  { key: 'innateAutoHeighten', label: 'Auto-Heighten Innate and Item Spells',
    description: 'Innate grants heighten to at least half your level (rounded up, maximum rank 10). Also heightens Heroic Presence’s Zealous Conviction and scales innate summons using creature-building benchmarks.' },
  { key: 'barbarianWarJavelinAccess', label: 'Barbarian Access: War Javelin',
    description: 'Barbarians gain Access to the War Javelin. Weapon proficiency is unchanged.' },
  { key: 'barbarianIgnoreAgile', label: 'Barbarians ignore Agile while Raging',
    description: 'Temporarily removes Agile from weapons while a Barbarian is raging. Agile returns when Rage ends.' },
  { key: 'freeHandFinesse', label: 'Free-Hand Weapons Gain Finesse' },
  { key: 'bucklerMeleeFinesse', label: 'Buckler-Attached Melee Weapons Gain Finesse',
    description: 'Melee weapons attached to a buckler gain Finesse, allowing Dexterity instead of Strength for attacks when higher. Does not affect ranged attachments, Shield Bash, or other shields.' },
  { key: 'championFormNoFlight', label: 'Disable fly speed from Animal Feature, Auspice Specialization, Celestial Form, Fiendish Form, Untamed Shift' },
  { key: 'bardAnimalTrainer', label: 'Bard Animal Trainer Dedication' },
  { key: 'bardBeastmaster', label: 'Bard Beastmaster Dedication' },
  { key: 'bardCavalier', label: 'Bard Cavalier Dedication' },
  { key: 'dwarfStalwartDefender', label: 'Dwarf Stalwart Defender Dedication' },
  { key: 'championBeastmaster', label: 'Champion Beastmaster Dedication' },
  { key: 'championCavalier', label: 'Champion Cavalier Dedication' },
  { key: 'exclusiveCyborgHearts', label: 'Cyborg Machine Heart or Mortal Heart Exclusive' },
  { key: 'commanderBeastmaster', label: 'Commander Beastmaster Dedication' },
  { key: 'commanderCaptain', label: 'Commander Captain Dedication' },
  { key: 'commanderCavalier', label: 'Commander Cavalier Dedication' },
  { key: 'cyborgTestSubject', label: 'Cyborg Heritage adds Test-Subject Ysoki Heritage' },
  { key: 'deityLore', label: 'Deity Grants Lore' },
  { key: 'disableAdoptedAncestry', label: 'Disable Adopted Ancestry, Cultural Adaptability, Orc Kinship, Social Chameleon' },
  { key: 'disableAncientElfMultitalented', label: 'Disable Ancient Elf, Multitalented' },
  { key: 'disableBeastmasterWardenSpells', label: 'Disable Warden spells for Beastmaster except for Heal Companion and Magic Hide' },
  { key: 'druidBeastmaster', label: 'Druid Beastmaster Dedication' },
  { key: 'druidCavalier', label: 'Druid Cavalier Dedication' },
  { key: 'fighterPhysicalSkills', label: 'Fighter Grants Acrobatics and Athletics',
    description: 'Fighters are trained in both Acrobatics and Athletics instead of choosing one. Additional skill choices are unchanged. Disabling restores the saved class skill choice.' },
  { key: 'freeArchetype', label: 'Free Archetype' },
  { key: 'generalFeatsOnly', label: 'General Feats Only' },
  { key: 'ignoreArchetypeFeatMinimums', label: 'Ignore Archetype Feat Minimums' },
  { key: 'singleTrainingFeats', label: 'Advanced General Training and General Training: Once Each' },
  { key: 'innateHighestMental', label: 'Innate Spells Use Highest Mental Attribute',
    description: 'Innate spell attacks and DCs use the highest of Intelligence, Wisdom or Charisma. Class and focus spell abilities are unchanged.' },
  { key: 'inventorFirearmAccess', label: 'Inventor Access: Bladed Gauntlet and Firearms' },
  { key: 'inventorArmorGauntlets', label: 'Inventor Armor Innovation Gauntlets',
    description: 'While wearing an Armor Innovation, gain a locked Bladed Gauntlet with automatic weapon fundamentals and a locked Gauntlet Buckler with level-appropriate reinforcing runes. Saved equipment is preserved when disabled.' },
  { key: 'orderExplorerSkills', label: 'Druid Order Explorer Grants Skills' },
  { key: 'planSkillPrerequisites', label: 'Plan Feats Using Final Skill Ranks',
    description: "Feat skill prerequisites use actual skill ranks at your character's selected build level, even for earlier feat slots. Unassigned ranks do not qualify. Other prerequisites are unchanged." },
  { key: 'protectCompanionAll', label: 'Protect Companion Targets All Minions',
    description: 'Protect Companion applies to all your minions and companions instead of one target.' },
  { key: 'rangerBeastmaster', label: 'Ranger Beastmaster Dedication' },
  { key: 'orcTattooedHistorian', label: 'Orc Tattooed Historian Dedication' },
  { key: 'rangerCavalier', label: 'Ranger Cavalier Dedication' },
  { key: 'rangerOpeningStance', label: 'Ranger Opening Stance Feat' },
  { key: 'rangerSnarecrafter', label: 'Ranger Snarecrafter Dedication' },
  { key: 'staffAcrobatSpear', label: 'Spear Acrobat' },
  { key: 'staffAcrobatNoPrerequisites', label: 'Staff Acrobat: No Dedication Prerequisites' },
  { key: 'singleAnimalCompanion', label: 'Disable Multiple Animal Companions',
    description: 'Beastmaster Dedication and Additional Companion do not add more companions. Your single companion gains their advancement, maneuvers and spells instead.' },
  { key: 'skillTokenConversion', label: 'Skill Token Conversion',
    description: 'Choose a skill rank to combine unused choices automatically. Two Trained choices buy Expert, two Expert tokens buy Master, and two Master tokens buy Legendary. Higher tokens can be split into two of the next lower rank, including Trained. From Trained: 2 / 6 / 14 Trained choices total. Expert requires level 3, Master 7, Legendary 15. Existing proficiencies and source restrictions remain. Click a purchased rank again to refund it. Disabling preserves purchases.' },
  { key: 'studentOfApotheosisStrengthWisdom', label: 'Student of Apotheosis: Two Free Boosts',
    description: 'The background grants two free attribute boosts instead of requiring Intelligence or Charisma for one.' },
  { key: 'unarmedCountsAsWeapons', label: 'Unarmed attacks count as weapons',
    description: 'For Twin Parry, a worn free-hand weapon can pair with a separate unarmed attack even while both hands hold another weapon, such as a bow in its shooting grip.' },
  { key: 'warmaskScaling', label: 'Orc Warmask Item Bonus Scaling',
    description: 'Warmask grants a +1 item bonus to its associated skill, increasing to +2 at level 9 and +3 at level 17. Does not change proficiency or stack with other item bonuses.' },
  { key: 'whirlwindStanceNoPrerequisites', label: 'Whirlwind Stance: No Prerequisites' },
  { key: 'warriorLegendClearTheWay', label: 'Warrior of Legend: Clear the Way',
    description: 'Warrior of Legend Dedication satisfies the Mauler Dedication prerequisite for Clear the Way.' },
]
RULES.sort((a, b) => a.label.localeCompare(b.label))

export function matchingHouseRules(search: string) {
  const query = search.trim().toLowerCase()
  return !query || 'rules'.includes(query) ? RULES : RULES.filter(rule =>
    `${rule.label} ${rule.description ?? ''}`.toLowerCase().includes(query))
}

export function HouseRules({ search, open, onToggle }: {
  search: string; open?: boolean; onToggle?: (open: boolean) => void
}) {
  const settings = useSettings()
  const rules = matchingHouseRules(search)
  return <details id="homebrew-rules" className="character-subsection homebrew-group" open={!!search.trim() || open}
    onToggle={event => onToggle?.(event.currentTarget.open)}>
    <summary><h3>Rules ({rules.length})</h3></summary>
    <section className="col settings-panel" aria-label="House rules">
      {rules.map(rule => <label key={rule.key} title={rule.description}>
        <input type="checkbox" checked={settings[rule.key]}
          onChange={event => {
            const enabled = event.target.checked
            if (!enabled && !window.confirm(`Disable rule "${rule.label}"?`)) return
            updateSettings({ [rule.key]: enabled })
          }} />{' '}{rule.label}
      </label>)}
    </section>
  </details>
}
