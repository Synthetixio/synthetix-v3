import { ethers } from 'ethers';

export async function deployedContractHasBytescode(
  contractAddress: string,
  bytecode: string,
  provider: ethers.providers.Provider
) {
  const sourceBytecodeHash = getBytecodeHash(bytecode);
  const remoteBytecodeHash = getBytecodeHash(await getRemoteBytecode(contractAddress, provider));

  return sourceBytecodeHash === remoteBytecodeHash;
}

export function getBytecodeHash(bytecode: string) {
  return ethers.utils.sha256(bytecode);
}

export async function getRemoteBytecode(address: string, provider: ethers.providers.Provider) {
  return await provider.getCode(address);
}

export function getSelectors(
  contractAbi: ethers.ContractInterface,
  functionFilter: (fnName: string) => boolean = () => true
) {
  const contract = new ethers.Contract('0x0000000000000000000000000000000000000001', contractAbi);

  return contract.interface.fragments.reduce((selectors, fragment) => {
    if (fragment.type === 'function' && functionFilter(fragment.name)) {
      selectors.push({
        name: fragment.name,
        selector: contract.interface.getSighash(fragment),
      });
    }

    return selectors;
  }, [] as { name: string; selector: string }[]);
}
