import fs from 'node:fs/promises';
import path from 'node:path';

export async function readFile(filepath: string) {
  return fs.readFile(filepath, { encoding: 'utf8' }).then((res) => res.toString());
}

export async function readFileSafe(filepath: string) {
  try {
    const result = await readFile(filepath);
    return result;
  } catch (err: unknown) {
    if (_isNodeError(err) && err.code === 'ENOENT') return;
    throw err;
  }
}

function _isNodeError(err: unknown): err is Error & { code?: string } {
  return err instanceof Error && typeof (err as Error & { code?: string }).code === 'string';
}

export async function writeFile(target: string, content: string) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  return fs.writeFile(target, content);
}

export async function readJsonFile<T = unknown>(filepath: string) {
  const content = await readFile(filepath);
  return JSON.parse(content) as T;
}

export async function readJsonFileSafe<T = unknown>(filepath: string) {
  const content = await readFileSafe(filepath);
  return content ? (JSON.parse(content) as T) : undefined;
}

export async function writeJsonFile(target: string, content: unknown) {
  const data = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  return writeFile(target, data);
}
