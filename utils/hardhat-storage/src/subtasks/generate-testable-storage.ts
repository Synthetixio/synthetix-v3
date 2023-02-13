import fs from 'node:fs/promises';
import path from 'node:path';
import { getContractAst } from '@synthetixio/core-utils/utils/hardhat/contracts';
import logger from '@synthetixio/core-utils/utils/io/logger';
import { subtask } from 'hardhat/config';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import { renderTestableStorage } from '../internal/render-testable-storage';
import { SUBTASK_GENERATE_TESTABLE_STORAGE } from '../task-names';

subtask(
  SUBTASK_GENERATE_TESTABLE_STORAGE,
  'Reads deployed modules from the deployment data file and generates the source for a new router contract.'
)
  .addParam('artifact', 'The artifact to generate a testable version of')
  .addParam('output', 'Where to put the generated code')
  .setAction(async ({ output, artifact }: { output: string; artifact: string }, hre) => {
    const sourceAstNode = await getContractAst(artifact, hre);

    logger.subtitle(`Generating testable storage for ${artifact}`);

    const { sourceName } = parseFullyQualifiedName(artifact);
    const relativeSourceName = path.join(
      path.relative(path.dirname(output), path.dirname(sourceName)),
      path.basename(sourceName)
    );

    const sourceCode = renderTestableStorage({
      relativeSourceName,
      artifact,
      sourceAstNode,
    });

    await fs.writeFile(output, sourceCode);

    logger.success(`Generated and written to ${output}`);

    return output;
  });
