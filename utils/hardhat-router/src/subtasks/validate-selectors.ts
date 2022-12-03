import logger from '@synthetixio/core-utils/utils/io/logger';
import { subtask } from 'hardhat/config';
import { findDuplicateSelectors, getAllSelectors } from '../internal/contract-helper';
import { ContractValidationError } from '../internal/errors';
import { SUBTASK_VALIDATE_SELECTORS } from '../task-names';

interface Params {
  contracts?: string[];
}

subtask(SUBTASK_VALIDATE_SELECTORS).setAction(async ({ contracts = [] }: Params, hre) => {
  const selectors = await getAllSelectors(contracts, hre);
  const duplicates = findDuplicateSelectors(selectors);

  if (duplicates) {
    const details = duplicates.map(
      (d) => `  > ${d.fn} found in contracts ${d.contracts} - ${d.selector}`
    );

    logger.error(`Duplicate selectors found!\n${details.join('\n')}`);

    throw new ContractValidationError('Found duplicate selectors on contracts');
  }
});
