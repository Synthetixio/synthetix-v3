import fs from 'node:fs';
import Mustache from 'mustache';

export function renderTemplate(filepath: string, data: { [k: string]: unknown } = {}) {
  const template = fs.readFileSync(filepath).toString();
  return Mustache.render(template, data);
}
