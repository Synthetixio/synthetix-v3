import fs from 'node:fs/promises';
import path from 'node:path';
import * as parser from '@solidity-parser/parser';
import { SourceUnit } from '@solidity-parser/parser/dist/src/ast-types';
import { subtask } from 'hardhat/config';
import { parseStorageDump } from '../internal/dump';
import { SUBTASK_STORAGE_LOAD_DUMP } from '../task-names';

interface Params {
  filepath: string;
}

subtask(SUBTASK_STORAGE_LOAD_DUMP).setAction(async ({ filepath }: Params, hre) => {
  const sourcepath = path.resolve(hre.config.paths.root, filepath);
  const source = await fs.readFile(sourcepath, { encoding: 'utf8' });

  const contents = parseStorageDump(source);

  const sourceUnits: SourceUnit[] = [];
  for (const content of Object.values(contents)) {
    sourceUnits.push(parser.parse(content));
  }

  return sourceUnits;
});
