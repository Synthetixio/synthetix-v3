import { getContractsAsts } from '@synthetixio/core-utils/utils/hardhat/contracts';
import logger from '@synthetixio/core-utils/utils/io/logger';
import { subtask } from 'hardhat/config';
import { ContractValidationError } from '../internal/errors';
import { routerFunctionFilter } from '../internal/router-function-filter';
import { validateInterfaces } from '../internal/validate-interfaces';
import { SUBTASK_VALIDATE_INTERFACES } from '../task-names';

interface Params {
  contracts?: string[];
}

subtask(SUBTASK_VALIDATE_INTERFACES).setAction(async ({ contracts = [] }: Params, hre) => {
  const astNodes = await getContractsAsts(hre, contracts);

  const errorsFound = validateInterfaces(contracts, astNodes, routerFunctionFilter);

  if (errorsFound.length > 0) {
    for (const error of errorsFound) {
      logger.error(error.msg);
      logger.debug(JSON.stringify(error, null, 2));
    }

    throw new ContractValidationError(
      `Missing interfaces for contracts: ${errorsFound.map((err) => err.msg)}`
    );
  }

  logger.checked('Visible functions are defined in interfaces');
});
