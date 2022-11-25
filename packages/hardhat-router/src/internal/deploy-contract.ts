import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import { ContractFactory } from 'ethers';
import { DeployedContractData } from '../types';
import { timed } from './timed';

interface Params {
  contractFullyQualifiedName: string;
  constructorArgs?: unknown[];
  hre: HardhatRuntimeEnvironment;
}

export async function deployContract({
  contractFullyQualifiedName,
  constructorArgs = [],
  hre,
}: Params) {
  return timed(`deploy ${contractFullyQualifiedName}`, async () => {
    const { contractName, sourceName } = parseFullyQualifiedName(contractFullyQualifiedName);
    const { abi } = await hre.artifacts.readArtifact(contractFullyQualifiedName);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const factory = (await (hre as any).ethers!.getContractFactory(
      contractFullyQualifiedName
    )) as ContractFactory;

    const contract = await factory.deploy(...constructorArgs);

    if (!contract.address) {
      throw new Error(`Error deploying "${contractFullyQualifiedName}"`);
    }

    await contract.deployed();

    return {
      constructorArgs,
      abi,
      deployedAddress: contract.address,
      deployTxnHash: contract.deployTransaction.hash,
      contractName,
      sourceName,
      contractFullyQualifiedName,
    } as DeployedContractData;
  });
}

export async function deployContracts(contracts: string[], hre: HardhatRuntimeEnvironment) {
  return timed(`deploy ${contracts.length} contracts`, () =>
    Promise.all(
      contracts.map((contractFullyQualifiedName) =>
        deployContract({
          contractFullyQualifiedName,
          hre,
        })
      )
    )
  );
}
