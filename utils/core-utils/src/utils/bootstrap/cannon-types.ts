export type Address = `0x${string}`;
export type Hex = `0x${string}`;
export type Hash = `0x${string}`;

export type ContractData = {
  address: Address;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructorArgs?: any[]; // only needed for external verification
  linkedLibraries?: { [sourceName: string]: { [libName: string]: string } }; // only needed for external verification
  // only should be supplied when generated solidity as a single file
  sourceCode?: string;
  deployTxnHash: string;
  contractName: string;
  sourceName: string;
  deployedOn: string;
  highlight?: boolean;
  gasUsed: number;
  gasCost: string;
};

export type ContractMap = {
  [label: string]: ContractData;
};

export interface PreChainBuilderContext {
  chainId: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  package: any;
  timestamp: string;
}

export type OptionTypesTs = string | number | boolean;

export interface ChainBuilderOptions {
  [key: string]: OptionTypesTs;
}

export type EventMap = {
  [name: string]: {
    args: string[];
  }[];
};

export type TransactionMap = {
  [label: string]: {
    hash: Hash;
    events: EventMap;
    deployedOn: string;
    gasUsed: number;
    gasCost: string;
    signer: string;
  };
};

export type ChainArtifacts = Partial<
  Pick<ChainBuilderContext, 'imports' | 'contracts' | 'txns' | 'extras'>
>;

export type BundledOutput = { url: string; tags?: string[]; preset?: string } & ChainArtifacts;

export interface BundledChainBuilderOutputs {
  [module: string]: BundledOutput;
}

export interface ChainBuilderContext extends PreChainBuilderContext {
  settings: ChainBuilderOptions;

  contracts: ContractMap;

  txns: TransactionMap;

  extras: { [label: string]: string };

  imports: BundledChainBuilderOutputs;
}
