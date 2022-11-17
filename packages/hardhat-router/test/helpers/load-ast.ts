import path from 'node:path';
import jp from 'jsonpath';
import { SourceUnit } from 'solidity-ast';
import { compileSol } from 'solc-typed-ast';

/**
 * Get the AST nodes from the given contract, and replace the full path with
 * the local path to be compatible with Hardhat's fullyQualifiedNames
 */
export async function loadAst(
  contractSource: string,
  rootPath = path.resolve(__dirname, '..', 'fixtures')
) {
  const sourcePath = path.resolve(rootPath, contractSource);
  const result = await compileSol(sourcePath, 'auto');
  const sources = result.data.sources as { [contractSource: string]: { ast: SourceUnit } };
  const astNodes = Object.values(sources).map(({ ast }) => ast);

  // Make all the contract paths relative to the rootPath
  jp.apply(astNodes, '$..absolutePath', (val: unknown) =>
    typeof val === 'string' && val.startsWith(rootPath) ? val.substring(rootPath.length + 1) : val
  );

  return astNodes;
}
