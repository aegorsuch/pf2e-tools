import { useState, type ChangeEvent } from 'react'
import { confirmRemoval } from './confirmRemoval'
import { processCharacterPicture } from './characterPictureData'
import type { CharacterPicture } from './types'

export function CharacterPictures({ picture, save }: {
  picture?: CharacterPicture
  save: (picture?: CharacterPicture) => Promise<void>
}) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const addPicture = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    setError('')
    if (!file) return
    setSaving(true)
    try {
      await save(await processCharacterPicture(file))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setSaving(false)
    }
  }

  const removePicture = () => {
    if (!picture) return
    confirmRemoval(`picture "${picture.name}"`, () => {
      setError('')
      void save(undefined)
        .catch(reason => setError(reason instanceof Error ? reason.message : String(reason)))
    })
  }

  return <div className="character-picture-content">
    <label>{picture ? 'Replace picture' : 'Add picture'} <input type="file" aria-label="Character picture"
      accept="image/jpeg,image/png,image/webp" disabled={saving}
      onChange={event => { void addPicture(event) }} /></label>
    {saving && <span role="status">Saving picture...</span>}
    {error && <p role="alert">{error}</p>}
    {picture && <figure className="character-picture-preview">
      <img src={picture.dataUrl} alt={picture.name} loading="lazy" decoding="async" />
      <figcaption className="character-picture-caption">
        <span>{picture.name}</span>
        <button type="button" aria-label={`Remove picture ${picture.name}`}
          onClick={removePicture}>Remove</button>
      </figcaption>
    </figure>}
  </div>
}
