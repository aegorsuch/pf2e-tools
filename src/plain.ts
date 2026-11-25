// Class feature summaries often omit the proficiency sentences, so keep full text without markup.
export const plain = (md: string) => md
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/<[^>]*>/g, ' ')
  .replace(/[*_`]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
