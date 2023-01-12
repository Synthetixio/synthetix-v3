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
  console.log('abi:', JSON.stringify(contractAbi, null, 2));
  const contract = new ethers.Contract('0x0000000000000000000000000000000000000001', contractAbi);

  return contract.interface.fragments.reduce((selectors, fragment) => {
    // console.log(fragment.type);
    if (fragment.type === 'function' || fragment.type === 'receive' && functionFilter(fragment.name)) {
      selectors.push({
        name: fragment.name,
        selector: contract.interface.getSighash(fragment),
      });
    }

    return selectors;
  }, [] as { name: string; selector: string }[]);
}
