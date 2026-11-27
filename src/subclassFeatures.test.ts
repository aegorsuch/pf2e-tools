import { expect, it } from 'vitest'
import { subclassFeatureRows } from './subclassFeatures'
import type { ContentEntry } from './types'

const entry = (description: string) => ({ description }) as ContentEntry

it('splits level-gated subclass abilities into rows', () => {
  expect(subclassFeatureRows(entry('You have trained. Level 17 Masterful Hunter You can blend your weapon mastery.')))
    .toEqual([{ name: 'Masterful Hunter', level: 17, description: 'You can blend your weapon mastery.', actions: undefined }])
})

it('extracts gunslinger way deeds with their action costs', () => {
  const rows = subclassFeatureRows(entry("You wander. Slinger's Reload Action Reloading Strike Single Action Gunslinger Source Guns & Gears pg. 108 Requirements Hold a gun. Initial Deed Action Into the Fray Free Action Gunslinger Source Guns & Gears pg. 108 Trigger You roll initiative. Level 9 Advanced Deed Action Finish the Job Single Action Gunslinger Source Guns & Gears pg. 108 Requirements You failed."))
  expect(rows.map(row => [row.name, row.level, row.actions])).toEqual([
    ['Reloading Strike', 1, 'Single Action'], ['Into the Fray', 1, 'Free Action'], ['Finish the Job', 9, 'Single Action']])
})
