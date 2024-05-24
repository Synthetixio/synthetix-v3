import fs from 'node:fs/promises';
import path from 'node:path';
import * as parser from '@solidity-parser/parser';
import { ContractDefinition } from '@solidity-parser/parser/src/ast-types';
import { GetArtifactFunction, StorageArtifact } from '../types';
import {
  findAll,
  findContract,
  findContractStrict,
  findOne,
  getCanonicalImportedSymbolName,
} from './finders';
import { ensureTrailingSlash, isExplicitRelativePath, removeBasePath } from './path-helpers';

async function _safeReadFile(filepath: string) {
  try {
    return await fs.readFile(filepath, { encoding: 'utf8' });
  } catch (err: any) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
}

export async function readArtifact(projectRoot: string, sourceName: string, sourcePrefix = '') {
  if (sourcePrefix && !sourceName.startsWith(ensureTrailingSlash(sourcePrefix))) {
    throw new Error(`Invalid sourcePrefix "${sourcePrefix}" for "${sourceName}"`);
  }

  const sourcePath = sourcePrefix
    ? sourceName.slice(ensureTrailingSlash(sourcePrefix).length)
    : sourceName;

  const sourceFullPath = path.resolve(projectRoot, sourcePath);
  const sourceCode = await _safeReadFile(sourceFullPath);

  if (sourceCode === undefined) {
    throw new Error(`Could not find "${sourceName}" at "${sourceFullPath}"`);
  }

  const sourceUnit = parser.parse(sourceCode, { loc: true });

  // Modify all import directives to start from `projectRoot`
  _normalizeImportDirectives(projectRoot, sourceFullPath, sourceUnit, sourcePrefix);

  return {
    sourceName,
    ast: sourceUnit,
  } satisfies StorageArtifact;
}

function _normalizeImportDirectives(
  projectRoot: string,
  sourceFullPath: string,
  sourceUnit: StorageArtifact['ast'],
  sourcePrefix: string
) {
  for (const node of findAll(sourceUnit, 'ImportDirective')) {
    if (!isExplicitRelativePath(node.path)) continue;
    const sourceName = removeBasePath(
      projectRoot,
      path.resolve(path.dirname(sourceFullPath), node.path)
    );
    const target = sourcePrefix ? path.join(sourcePrefix, sourceName) : sourceName;
    node.path = target;
    node.pathLiteral.value = target;
    node.pathLiteral.parts = [target];
  }
}

export async function findContractReferenceArtifact(
  getArtifact: GetArtifactFunction,
  artifact: StorageArtifact,
  contractName: string
): Promise<[StorageArtifact, string]> {
  const localContract = findContract(artifact.ast, contractName);

  if (localContract) return [artifact, contractName];

  const importDirective = getCanonicalImportedSymbolName(artifact.ast, contractName);

  // If we have the real name and where it was imported from, look for it there
  if (importDirective) {
    const [importSourceName, canonicalContractName] = importDirective;
    const importedArtifact = await getArtifact(importSourceName);
    const contractNode = findContract(importedArtifact.ast, canonicalContractName);
    if (contractNode) return [importedArtifact, canonicalContractName];
  } else {
    // if not, on all the imported files
    const importedSourceNames = findAll(artifact.ast, 'ImportDirective').map((node) => node.path);
    for (const importSourceName of importedSourceNames) {
      const importedArtifact = await getArtifact(importSourceName);
      const contractNode = findContract(importedArtifact.ast, contractName);
      if (contractNode) return [importedArtifact, contractName];
    }
  }

  throw new Error(
    `Could not find contract with name "${contractName}" from "${artifact.sourceName}"`
  );
}

export async function findContractTree(
  getArtifact: GetArtifactFunction,
  artifact: StorageArtifact,
  contractName: string
) {
  const contractNode = findContractStrict(artifact.ast, contractName);

  const contractNodes: ContractDefinition[] = [contractNode];

  for (const baseContract of contractNode.baseContracts) {
    const [inheritedArtifact, inheritedContractName] = await findContractReferenceArtifact(
      getArtifact,
      artifact,
      baseContract.baseName.namePath
    );

    const importedContractTree = await findContractTree(
      getArtifact,
      inheritedArtifact,
      inheritedContractName
    );

    contractNodes.push(...importedContractTree);
  }

  return contractNodes;
}
