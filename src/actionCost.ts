import type { ContentEntry } from './types'

export function actionOptionLabel(name: string, entry?: ContentEntry) {
  const value = entry?.data.actions
  if (typeof value !== 'string' || !value.trim()) return name
  const symbols = value.replace(/single action|one action/gi, '◆')
    .replace(/two actions/gi, '◆◆')
    .replace(/three actions/gi, '◆◆◆')
    .replace(/free action/gi, '◇')
    .replace(/reaction/gi, '↶')
  return symbols === value ? `${name} (${value})` : `${name} ${symbols} (${value})`
}
