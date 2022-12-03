import hre from 'hardhat';
import { ChainBuilderRuntime, ChainBuilderContext } from '@usecannon/builder/dist/src/types';
import { SUBTASK_GENERATE_ROUTER } from '@synthetixio/hardhat-router/dist/task-names';

type CannonContract = ChainBuilderContext['contracts'][keyof ChainBuilderContext['contracts']];

/**
 * Generate the Router contract file. It also includes the local CoreModule.
 */
exports.generate = async function generate(
  runtime: ChainBuilderRuntime,
  routerFqName: string,
  contractsMapJson: string,
  ...extraContractsJson: string[]
) {
  const contracts = Object.values(
    JSON.parse(contractsMapJson) as ChainBuilderContext['contracts']
  ).map(_parseCannonContract);

  if (extraContractsJson) {
    contracts.push(
      ...extraContractsJson.map((c) => JSON.parse(c) as CannonContract).map(_parseCannonContract)
    );
  }

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
