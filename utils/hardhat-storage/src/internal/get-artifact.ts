import fs from 'node:fs/promises';
import path from 'node:path';
import * as parser from '@solidity-parser/parser';
import { StorageArtifact } from '../types';

export async function getArtifact(projectRoot: string, sourceName: string, contractName: string) {
  const sourceFullPath = path.resolve(projectRoot, sourceName);
  const source = await fs.readFile(sourceFullPath, { encoding: 'utf8' });
  const sourceUnit = parser.parse(source, { loc: true });

  // Modify all import directives to start from `projectRoot`
  _normalizeImportDirectives(projectRoot, sourceFullPath, sourceUnit);

  return {
    sourceName,
    contractName,
    ast: sourceUnit,
  } satisfies StorageArtifact;
}

function _isExplicitRelativePath(sourceName: string): boolean {
  return sourceName.startsWith('./') || sourceName.startsWith('../');
}

function _normalizeImportDirectives(
  projectRoot: string,
  sourceFullPath: string,
  sourceUnit: StorageArtifact['ast']
) {
  parser.visit(sourceUnit, {
    ImportDirective: async function (node) {
      if (!_isExplicitRelativePath(node.path)) return;
      const target = _removeBasePath(projectRoot, sourceFullPath);
      node.path = target;
      node.pathLiteral.value = target;
      node.pathLiteral.parts = [target];
    },
  });
}

function _removeBasePath(basePath: string, fullPath: string) {
  basePath = path.normalize(basePath);
  fullPath = path.normalize(fullPath);

  if (!basePath.endsWith(path.sep)) basePath += path.sep;

  if (!fullPath.startsWith(basePath)) {
    throw new Error(`The path "${fullPath}" is not inside "${fullPath}"`);
  }

  return fullPath.substring(basePath.length);
}
