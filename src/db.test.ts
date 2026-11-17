import { describe, expect, it } from 'vitest'
import { importCharacter } from './db'

describe('character import', () => {
  it('rejects files that are not character exports', async () => {
    await expect(importCharacter('{"name":"x"}')).rejects.toThrow('Not a character export')
  })
})
