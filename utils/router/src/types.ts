import { JsonFragment } from '@ethersproject/abi';

export interface DeployedContractData {
  constructorArgs?: unknown[];
  abi: JsonFragment[];
  deployedAddress: string;
  deployTxnHash: string;
  contractName: string;
  sourceName: string;
  contractFullyQualifiedName: string;
}
