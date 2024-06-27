import path from 'node:path';
import * as parser from '@solidity-parser/parser';
import { ASTNodeTypeString, ContractDefinition } from '@solidity-parser/parser/src/ast-types';
import { GetArtifactFunction, StorageArtifact } from '../types';
import { safeReadFile } from './file-helpers';
import {
  ASTTypeMap,
  findAll,
  findContractStrict,
  findOne,
  getCanonicalImportedSymbolName,
} from './finders';
import { ensureTrailingSlash, isExplicitRelativePath, removeBasePath } from './path-helpers';

export async function readArtifact(projectRoot: string, sourceName: string, sourcePrefix = '') {
  if (sourcePrefix && !sourceName.startsWith(ensureTrailingSlash(sourcePrefix))) {
    throw new Error(`Invalid sourcePrefix "${sourcePrefix}" for "${sourceName}"`);
  }

  const sourcePath = sourcePrefix
    ? sourceName.slice(ensureTrailingSlash(sourcePrefix).length)
    : sourceName;

  const sourceFullPath = path.resolve(projectRoot, sourcePath);
  const sourceCode = await safeReadFile(sourceFullPath);

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

export async function findNodeReferenceWithArtifact<T extends ASTNodeTypeString>(
  getArtifact: GetArtifactFunction,
  nodeTypes: T | T[],
  artifact: StorageArtifact,
  nodePath: string
): Promise<[StorageArtifact, ASTTypeMap[T]]> {
  // Handle children nodes, e.g.: ContractName.StrcutName
  if (nodePath.includes('.')) {
    const names = nodePath.split('.');

    if (names.length > 2) {
      throw new Error(
        `Cannot handle node references with more than 1 parent in "${nodePath}" from "${artifact.sourceName}"`
      );
    }

    const [parentNodeName, childNodeName] = names;

    const [parentArtifact, parentNode] = await findNodeReferenceWithArtifact(
      getArtifact,
      nodeTypes,
      artifact,
      parentNodeName
    );

    const childNode = findOne(
      parentNode,
      nodeTypes,
      (node) => (node as { name: string }).name === childNodeName
    );

    if (!childNode) {
      throw new Error(`Could not find node with name "${nodePath}" from "${artifact.sourceName}"`);
    }

    return [parentArtifact, childNode];
  }

  // Check if it's defined on the same file
  const localNode = findOne(
    artifact.ast,
    nodeTypes,
    (node) => (node as { name: string }).name === nodePath
  );

  if (localNode) return [artifact, localNode];

  const importDirective = getCanonicalImportedSymbolName(artifact.ast, nodePath);

  // If we have the real name and where it was imported from, look for it there
  if (importDirective) {
    const [importSourceName, canonicalNodeName] = importDirective;
    const importedArtifact = await getArtifact(importSourceName);
    const foundNode = findOne(
      importedArtifact.ast,
      nodeTypes,
      (node) => (node as { name: string }).name === canonicalNodeName
    );
    if (foundNode) return [importedArtifact, foundNode];
  } else {
    // if not, on all the imported files
    const importedSourceNames = findAll(artifact.ast, 'ImportDirective').map((node) => node.path);
    for (const importSourceName of importedSourceNames) {
      const importedArtifact = await getArtifact(importSourceName);
      const foundNode = findOne(
        importedArtifact.ast,
        nodeTypes,
        (node) => (node as { name: string }).name === nodePath
      );
      if (foundNode) return [importedArtifact, foundNode];
    }
  }

  throw new Error(`Could not find node with name "${nodePath}" from "${artifact.sourceName}"`);
}

export async function findContractTree(
  getArtifact: GetArtifactFunction,
  artifact: StorageArtifact,
  contractName: string
) {
  const contractNode = findContractStrict(artifact.ast, contractName);

  const contractNodes: ContractDefinition[] = [contractNode];

  for (const baseContract of contractNode.baseContracts) {
    const [inheritedArtifact, inheritedContract] = await findNodeReferenceWithArtifact(
      getArtifact,
      'ContractDefinition',
      artifact,
      baseContract.baseName.namePath
    );

    const importedContractTree = await findContractTree(
      getArtifact,
      inheritedArtifact,
      inheritedContract.name
    );

    contractNodes.push(...importedContractTree);
  }

  return contractNodes;
}
