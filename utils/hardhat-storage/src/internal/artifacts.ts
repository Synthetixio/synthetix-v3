import fs from 'node:fs/promises';
import path from 'node:path';
import * as parser from '@solidity-parser/parser';
import { ASTNodeTypeString, ContractDefinition } from '@solidity-parser/parser/src/ast-types';
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

export async function findNodeReferenceArtifact<T extends ASTNodeTypeString>(
  getArtifact: GetArtifactFunction,
  nodeTypes: T | T[],
  artifact: StorageArtifact,
  nodeName: string
): Promise<[StorageArtifact, string]> {
  const localNode = findOne(artifact.ast, nodeTypes, (node) => (node as any).name === nodeName);

  if (localNode) return [artifact, nodeName];

  const importDirective = getCanonicalImportedSymbolName(artifact.ast, nodeName);

  // If we have the real name and where it was imported from, look for it there
  if (importDirective) {
    const [importSourceName, canonicalNodeName] = importDirective;
    const importedArtifact = await getArtifact(importSourceName);
    const node = findOne(
      importedArtifact.ast,
      nodeTypes,
      (node) => (node as any).name === canonicalNodeName
    );
    if (node) return [importedArtifact, canonicalNodeName];
  } else {
    // if not, on all the imported files
    const importedSourceNames = findAll(artifact.ast, 'ImportDirective').map((node) => node.path);
    for (const importSourceName of importedSourceNames) {
      const importedArtifact = await getArtifact(importSourceName);
      const node = findOne(
        importedArtifact.ast,
        nodeTypes,
        (node) => (node as any).name === nodeName
      );
      if (node) return [importedArtifact, nodeName];
    }
  }

  throw new Error(`Could not find node with name "${nodeName}" from "${artifact.sourceName}"`);
}

export async function findContractTree(
  getArtifact: GetArtifactFunction,
  artifact: StorageArtifact,
  contractName: string
) {
  const contractNode = findContractStrict(artifact.ast, contractName);

  const contractNodes: ContractDefinition[] = [contractNode];

  for (const baseContract of contractNode.baseContracts) {
    const [inheritedArtifact, inheritedContractName] = await findNodeReferenceArtifact(
      getArtifact,
      'ContractDefinition',
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
