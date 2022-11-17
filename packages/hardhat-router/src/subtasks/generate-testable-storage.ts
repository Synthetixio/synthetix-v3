import fs from 'node:fs/promises';
import { dirname } from 'node:path';
import { subtask } from 'hardhat/config';
import logger from '@synthetixio/core-utils/utils/io/logger';
import { SUBTASK_GENERATE_TESTABLE_STORAGE } from '../task-names';
import { getContractAst } from '../internal/contract-helper';
import { renderTestableStorage } from '../internal/render-testable-storage';

subtask(
  SUBTASK_GENERATE_TESTABLE_STORAGE,
  'Reads deployed modules from the deployment data file and generates the source for a new router contract.'
)
  .addParam('artifact', 'The artifact to generate a testable version of')
  .addParam('output', 'Where to put the generated code')
  .setAction(async ({ output, artifact }: { output: string; artifact: string }, hre) => {
    const sourceAstNode = await getContractAst(artifact, hre);

    logger.subtitle(`Generating testable storage for ${artifact}`);

    await fs.mkdir(dirname(output), { recursive: true });
    const sourceCode = renderTestableStorage({ artifact, sourceAstNode });
    await fs.writeFile(output, sourceCode);

    logger.success(`Generated and written to ${output}`);

    return output;
  });
