import fs from 'node:fs/promises';
import path from 'node:path';
import stringify from 'json-stringify-pretty-compact';

export async function writeJsonFile(target: string, content: any) {
  const data = typeof content === 'string' ? content : stringify(content);
  await fs.mkdir(path.dirname(target), { recursive: true });
  return fs.writeFile(target, data);
}
