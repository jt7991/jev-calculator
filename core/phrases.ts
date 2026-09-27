// All contiguous word sections. Jev chooses their meaning.
export function wordSections(text: string): Record<string, null> {
  const words = text.trim().split(/\s+/);
  if (!text.trim()) throw new Error('Enter a calculation.');
  if (words.length > 22) throw new Error('Use at most 22 words for now.');
  const sections: Record<string, null> = {};
  for (let start = 0; start < words.length; start++) {
    for (let end = start + 1; end <= words.length; end++) {
      sections[words.slice(start, end).join(' ')] = null;
    }
  }
  return sections;
}
