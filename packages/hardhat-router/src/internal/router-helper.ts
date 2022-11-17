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
