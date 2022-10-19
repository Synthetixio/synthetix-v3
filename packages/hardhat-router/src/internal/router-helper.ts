import fs from 'node:fs';
import path from 'node:path';

import type { HardhatConfig } from 'hardhat/types';

/**
 * Converts the contracts name to private _CONSTANT_CASE format.
 * E.g.:
 *   'BearableModule' => '_BEARABLE_MODULE'
 *   'Proxy' => '_PROXY'
 *   'ERC20Token' => '_ERC20_TOKEN'
 */
export function toPrivateConstantCase(name: string) {
  return name.replace(/(?<![A-Z])[A-Z]/g, '_$&').toUpperCase();
}

export function getRouterSource(config: HardhatConfig) {
  const routerPath = path.join(config.paths.sources, 'Router.sol');
  const source = fs.readFileSync(routerPath).toString();
  return source;
}
