import { subtask } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import { default as logger } from '@synthetixio/core-utils/utils/io/logger';
import { SourceUnit } from 'solidity-ast';
import { ContractValidationError } from '../internal/errors';
import { routerFunctionFilter } from '../internal/router-function-filter';
import { validateInterfaces } from '../internal/validate-interfaces';
import { SUBTASK_VALIDATE_INTERFACES } from '../task-names';

interface Params {
  contracts?: string[];
}

subtask(SUBTASK_VALIDATE_INTERFACES).setAction(async ({ contracts = [] }: Params, hre) => {
  const contractFullyQualifiedNames = await hre.artifacts.getAllFullyQualifiedNames();
  const astNodes = await Promise.all(
    contractFullyQualifiedNames.map((fqName) => _getContractAst(fqName, hre))
  );

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

async function _getContractAst(contractFullyQualifiedName: string, hre: HardhatRuntimeEnvironment) {
  const { sourceName } = parseFullyQualifiedName(contractFullyQualifiedName);
  const buildInfo = await hre.artifacts.getBuildInfo(contractFullyQualifiedName);

  if (!buildInfo) {
    throw new Error(`Build info for "${contractFullyQualifiedName}" not found`);
  }

  return buildInfo.output.sources[sourceName].ast as SourceUnit;
}
