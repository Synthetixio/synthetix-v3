import { getSelectors } from '@synthetixio/core-utils/utils/ethers/contracts';
import { onlyRepeated } from '@synthetixio/core-utils/utils/misc/array';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { routerFunctionFilter } from './router-function-filter';

export async function getAllSelectors(
  contractFullyQualifiedNames: string[],
  hre: HardhatRuntimeEnvironment
) {
  const allSelectors = [];

  for (const name of contractFullyQualifiedNames) {
    const { contractName, abi } = await hre.artifacts.readArtifact(name);
    const selectors = await getSelectors(abi, routerFunctionFilter);

    allSelectors.push(...selectors.map((s) => ({ ...s, contractName })));
  }

  return allSelectors.sort((a, b) => {
    return Number.parseInt(a.selector, 16) - Number.parseInt(b.selector, 16);
  });
}

interface ContractFunctionSelector {
  name: string;
  selector: string;
  contractName: string;
}

export function findDuplicateSelectors(selectors: ContractFunctionSelector[]) {
  const duplicates = selectors.map((s) => s.selector).filter(onlyRepeated);

  const ocurrences = duplicates.map((duplicate) => {
    const cases = selectors.filter((s) => s.selector === duplicate);
    return {
      fn: cases[0].name,
      selector: duplicate,
      contracts: cases.map((c) => c.contractName),
    };
  });

  return ocurrences.length > 0 ? ocurrences : null;
}
