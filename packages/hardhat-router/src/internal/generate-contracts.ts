import fs from 'node:fs';
import path from 'node:path';
import Mustache from 'mustache';

import type { HardhatConfig } from 'hardhat/types';

export function getGeneratedContractPaths(config: HardhatConfig) {
  return [path.join(config.paths.sources, 'Router.sol')];
}

export function renderTemplate(filepath: string, data: { [k: string]: unknown } = {}) {
  const template = fs.readFileSync(filepath).toString();
  return Mustache.render(template, data);
}
