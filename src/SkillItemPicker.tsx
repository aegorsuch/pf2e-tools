import { useRef, useState } from 'react'
import type { SectionProps } from './builder'
import { EquipmentSearch } from './EquipmentSearch'

export function SkillItemPicker({ c, entries, save, skill, value }: SectionProps & { skill: string; value: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const close = () => dialog.current?.close()
  return <span className="skill-part">
    <button type="button" className="skill-item-trigger" aria-label={`${skill} item bonus equipment`}
      onClick={() => { setOpen(true); dialog.current?.showModal() }}><small>Item</small>{value}</button>
    <dialog ref={dialog} className="skill-item-dialog" aria-label={`${skill} item bonus equipment`}
      onClose={event => { if (event.target === event.currentTarget) setOpen(false) }}>
      <h3>{skill} item bonus equipment</h3>
      {open && <EquipmentSearch c={c} entries={entries} save={save} fixedSkill={/ lore$/i.test(skill) ? 'Lore' : skill} onClose={close} />}
    </dialog>
  </span>
}
