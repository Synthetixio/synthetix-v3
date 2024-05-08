import fs from 'node:fs/promises';
import path from 'node:path';
import * as parser from '@solidity-parser/parser';
import { subtask } from 'hardhat/config';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import { localPathToSourceName, localSourceNameToPath } from 'hardhat/utils/source-names';
import { SUBTASK_STORAGE_GET_SOURCE_UNITS } from '../task-names';

import type { SourceUnit } from '@solidity-parser/parser/src/ast-types';

interface Params {
  artifacts: string[];
}

subtask(SUBTASK_STORAGE_GET_SOURCE_UNITS).setAction(async ({ artifacts }: Params, hre) => {
  const sourceUnits = await Promise.all(
    artifacts.map(async (fqName) => {
      const { sourceName } = parseFullyQualifiedName(fqName);
      const sourcePath = localSourceNameToPath(
        hre.config.paths.root,
        await localPathToSourceName(hre.config.paths.root, sourceName)
      );
      const source = await fs.readFile(sourcePath, { encoding: 'utf8' });
      const sourceUnit = parser.parse(source);
      await _transformImportDirectives(hre.config.paths.root, sourcePath, sourceUnit);
      return sourceUnit;
    })
  );

  return sourceUnits;
});

function _isExplicitRelativePath(sourceName: string): boolean {
  const [base] = sourceName.split('/', 1);
  return base === '.' || base === '..';
}

async function _transformImportDirectives(
  projectRoot: string,
  sourcePath: string,
  sourceUnit: SourceUnit
) {
  parser.visit(sourceUnit, {
    ImportDirective: async function (node) {
      if (!_isExplicitRelativePath(node.path)) return;
      const target = await localPathToSourceName(
        projectRoot,
        path.resolve(path.dirname(sourcePath), node.path)
      );
      node.path = target;
      node.pathLiteral.value = target;
      node.pathLiteral.parts = [target];
    },
  });
}
