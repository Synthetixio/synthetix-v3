import { ethers } from 'ethers';
interface Params {
    cannonfile?: string;
}
declare module 'hardhat/types/config' {
    interface ProjectPathsConfig {
        deployments: string;
    }
}
export declare function coreBootstrap<Contracts>({ cannonfile }?: Params): {
    getContract: (contractName: keyof Contracts) => Contracts[keyof Contracts];
    getSigners: () => ethers.Signer[];
    getProvider: () => ethers.providers.JsonRpcProvider;
    createSnapshot: () => () => Promise<void>;
};
export {};
//# sourceMappingURL=core-bootstrap.d.ts.map