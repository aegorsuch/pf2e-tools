import { updateSettings, useSettings, type Settings } from './settings'

const RULES: { key: keyof Settings; label: string; description?: string }[] = [
  { key: 'singleAdditionalArms', label: 'Additional Arms: Once' },
  { key: 'adoptedDwarfClanDagger', label: 'Adopted Ancestry (Dwarf) Grants Clan Dagger' },
  { key: 'autoClassSkills', label: 'Auto-Advance Class-Specific Skills' },
  { key: 'autoLores', label: 'Auto-Advance Lores' },
  { key: 'barbarianWarJavelinAccess', label: 'Barbarian Access: War Javelin',
    description: 'Barbarians gain Access to the War Javelin. Weapon proficiency is unchanged.' },
  { key: 'barbarianIgnoreAgile', label: 'Barbarians ignore Agile while Raging',
    description: 'Temporarily removes Agile from weapons while a Barbarian is raging. Agile returns when Rage ends.' },
  { key: 'championFormNoFlight', label: 'Celestial and Fiendish Form: No Flight' },
  { key: 'championCavalier', label: 'Champion Cavalier Dedication' },
  { key: 'exclusiveCyborgHearts', label: 'Cyborg Hearts: Machine Heart or Mortal Heart' },
  { key: 'cyborgTestSubject', label: 'Cyborg Heritage adds Test-Subject Ysoki Heritage' },
  { key: 'druidCavalier', label: 'Druid Cavalier Dedication' },
  { key: 'fighterPhysicalSkills', label: 'Fighter Grants Acrobatics and Athletics',
    description: 'Fighters are trained in both Acrobatics and Athletics instead of choosing one. Additional skill choices are unchanged. Disabling restores the saved class skill choice.' },
  { key: 'freeArchetype', label: 'Free Archetype' },
  { key: 'gauntletFinesse', label: 'Gauntlet and Spiked Gauntlet Gain Finesse' },
  { key: 'generalFeatsOnly', label: 'General Feats Only' },
  { key: 'singleTrainingFeats', label: 'General Training and Advanced General Training: Once Each' },
  { key: 'innateHighestMental', label: 'Innate Spells Use Highest Mental Attribute',
    description: 'Innate spell attacks and DCs use the highest of Intelligence, Wisdom or Charisma. Class and focus spell abilities are unchanged.' },
  { key: 'inventorFirearmAccess', label: 'Inventor Access: Bladed Gauntlet, Firearm Ammunition, and Firearms' },
  { key: 'inventorArmorGauntlets', label: 'Inventor Armor Innovation Gauntlets',
    description: 'While wearing an Armor Innovation, gain a locked Bladed Gauntlet with automatic weapon fundamentals and a locked Gauntlet Buckler with level-appropriate reinforcing runes. Saved equipment is preserved when disabled.' },
  { key: 'orderExplorerSkills', label: 'Order Explorer Grants Skills' },
  { key: 'planSkillPrerequisites', label: 'Plan Feats Using Final Skill Ranks',
    description: "Feat skill prerequisites use actual skill ranks at your character's selected build level, even for earlier feat slots. Unassigned ranks do not qualify. Other prerequisites are unchanged." },
  { key: 'rangerSnarecrafter', label: 'Ranger Snarecrafter Dedication' },
  { key: 'skillTokenConversion', label: 'Skill Token Conversion',
    description: 'Choose a higher skill rank to combine unused choices automatically. Two Trained choices buy Expert, two Expert tokens buy Master, and two Master tokens buy Legendary. From Trained: 2 / 6 / 14 Trained choices total. Expert requires level 3, Master 7, Legendary 15. Existing proficiencies and source restrictions remain. Click a purchased rank again to refund it. Disabling preserves purchases.' },
  { key: 'unarmedCountsAsWeapons', label: 'Unarmed attacks count as weapons' },
  { key: 'warmaskScaling', label: 'Warmask Skill Bonus Scales',
    description: 'Warmask grants a +1 item bonus to its associated skill, increasing to +2 at level 9 and +3 at level 17. Does not change proficiency or stack with other item bonuses.' },
]

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
          onChange={event => updateSettings({ [rule.key]: event.target.checked })} />{' '}{rule.label}
      </label>)}
    </section>
  </details>
}
