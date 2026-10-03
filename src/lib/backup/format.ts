/**
 * Backup record format (SPEC §3.11): Markdown files where every record is a YAML front-matter
 * block (machine-readable, complete) followed by a human-readable body.
 *
 *   ---
 *   type: post
 *   id: 9f…
 *   author: me
 *   timestamp: 2026-10-03T10:12:00.000Z
 *   image: images/5c….webp
 *   data: { …the full record… }
 *   ---
 *   The post text, for people to read.
 */
import { parse, stringify } from 'yaml';

export const BACKUP_VERSION = 1;

export interface BackupRecord {
  type: string;
  id: string;
  author?: string;
  timestamp?: string;
  image?: string;
  data: Record<string, unknown>;
}

const FENCE = '---';

/** Serialises records; a body line that is exactly "---" is softened so parsing stays reliable. */
export function toMarkdown(
  title: string,
  records: { record: BackupRecord; body?: string }[],
): string {
  const parts = [`# ${title}\n\nFaceMango backup · format ${BACKUP_VERSION}\n`];
  for (const { record, body } of records) {
    const yaml = stringify(record, { lineWidth: 0 }).trimEnd();
    const safeBody = (body ?? '').replace(/^---$/gm, '- - -').trim();
    parts.push(`${FENCE}\n${yaml}\n${FENCE}\n${safeBody}\n`);
  }
  return parts.join('\n');
}

/** Parses every front-matter block back into records (bodies are ignored; data is canonical). */
export function fromMarkdown(markdown: string): BackupRecord[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: BackupRecord[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== FENCE) continue;
    const end = lines.indexOf(FENCE, i + 1);
    if (end < 0) break;
    const parsed = parse(lines.slice(i + 1, end).join('\n')) as BackupRecord | null;
    if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string' && parsed.data)
      out.push(parsed);
    // Skip the body: it runs until the next fence.
    let next = end + 1;
    while (next < lines.length && lines[next] !== FENCE) next++;
    i = next - 1;
  }
  return out;
}
