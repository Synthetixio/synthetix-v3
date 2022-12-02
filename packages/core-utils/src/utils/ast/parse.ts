import { compileSolidity } from '../solidity/compiler';

export async function parseAsts(...args: Parameters<typeof compileSolidity>) {
  const output = await compileSolidity(...args);

  const sourceUnits = Object.values(output.sources).map(({ ast }) => ast);

  return sourceUnits.sort((a, b) =>
    a.absolutePath > b.absolutePath ? 1 : a.absolutePath < b.absolutePath ? -1 : 0
  );
}
