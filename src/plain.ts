// Class feature summaries often omit the proficiency sentences, so keep full text without markup.
export const plain = (md: string) => {
  if (md.includes('[')) md = md.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  if (md.includes('<')) md = md.replace(/<[^>]*>/g, ' ')
  if (/[*_`]/.test(md)) md = md.replace(/[*_`]/g, '')
  return md.replace(/\s+/g, ' ').trim()
}
