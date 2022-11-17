import hre from 'hardhat';
import { ChainBuilderRuntime, ChainBuilderContext } from '@usecannon/builder/dist/src/types';
import { SUBTASK_GENERATE_ROUTER } from '@synthetixio/hardhat-router/dist/task-names';

/**
 * Generate the Router contract file. It also includes the local CoreModule.
 */
exports.generate = async function generate(
  runtime: ChainBuilderRuntime,
  routerFqName: string,
  CoreModuleJson: string,
  contractsJson: string
) {
  const contracts = [
    JSON.parse(CoreModuleJson),
    ...Object.values(JSON.parse(contractsJson) as ChainBuilderContext['contracts']),
  ].map((c) => ({
    deployedAddress: c.address,
    contractName: c.contractName,
    abi: c.abi,
  }));

  await hre.run(SUBTASK_GENERATE_ROUTER, {
    router: routerFqName,
    contracts,
  });

  // need to re-run compile to ensure artifact is available to cannon
  await hre.run('compile');

  return { contracts: {} };
};
