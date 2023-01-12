import { TASK_STORAGE_VERIFY } from '@synthetixio/hardhat-storage/dist/task-names';
import { ChainBuilderContext, ChainBuilderRuntime } from '@usecannon/builder/dist/src/types';
import hre from 'hardhat';
import {
  SUBTASK_GENERATE_ROUTER,
  SUBTASK_VALIDATE_INTERFACES,
  SUBTASK_VALIDATE_SELECTORS,
} from '../task-names';

type CannonContract = ChainBuilderContext['contracts'][keyof ChainBuilderContext['contracts']];

const DEFAULT_FLAGS = {
  validateInterfaces: true,
};

/**
 * Generate the Router contract file. It also includes the local CoreModule.
 */
exports.generate = async function generate(
  runtime: ChainBuilderRuntime,
  routerFqName: string,
  contractsMapJson: string,
  customFlags?: string
) {
  const flags = {
    ...DEFAULT_FLAGS,
    ...(customFlags ? _parseFlags(customFlags) : {}),
  };

  const contractsValues = Object.values(
    JSON.parse(contractsMapJson) as ChainBuilderContext['contracts']
  );
  const contractFqNames = contractsValues.map((c) => `${c.sourceName}:${c.contractName}`);
  const contracts = Object.values(contractsValues).map(_parseCannonContract);
  console.log('*** contracts::', JSON.stringify(contracts, null, 2));

  await hre.run(SUBTASK_VALIDATE_SELECTORS, { contracts: contractFqNames });

  if (flags.validateInterfaces) {
    await hre.run(SUBTASK_VALIDATE_INTERFACES, { contracts: contractFqNames });
  }

  await hre.run(TASK_STORAGE_VERIFY);

  await hre.run(SUBTASK_GENERATE_ROUTER, {
    router: routerFqName,
    contracts,
  });

  // need to re-run compile to ensure artifact is available to cannon
  await hre.run('compile');

  return { contracts: {} };
};

function _parseCannonContract(c: CannonContract) {
  return {
    deployedAddress: c.address,
    contractName: c.contractName,
    abi: c.abi,
  };
}

function _parseFlags(opts: string) {
  return opts.split(';').reduce((result, opt) => {
    const [key, val] = opt.split('=');
    result[key] = val === 'true';
    return result;
  }, {} as { [key: string]: boolean });
}
