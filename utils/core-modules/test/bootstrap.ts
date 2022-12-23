import { coreBootstrap } from '@synthetixio/hardhat-router/utils/tests';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ethers } from 'ethers'; // This is needed because of types
import {
  AssociatedSystemsModule,
  AssociatedSystemsModuleRouter,
  CoreRouter,
  FeatureFlagModule,
  FeatureFlagModuleRouter,
  GenericModule,
  NftModule,
  NftModuleRouter,
  OwnerModule,
  Proxy,
  SampleFeatureFlagModule,
  SampleModuleA,
  SampleModuleB,
  SampleOwnedModule,
  SampleRouter,
  TokenModule,
  TokenModuleRouter,
  UpgradeModule,
  DecayTokenModule,
  DecayTokenModuleRouter,
} from '../typechain-types';

interface Contracts {
  AssociatedSystemsModule: AssociatedSystemsModule;
  AssociatedSystemsModuleRouter: AssociatedSystemsModuleRouter;
  CoreRouter: CoreRouter;
  FeatureFlagModule: FeatureFlagModule;
  FeatureFlagModuleRouter: FeatureFlagModuleRouter;
  GenericModule: GenericModule;
  NftModule: NftModule;
  NftModuleRouter: NftModuleRouter;
  OwnerModule: OwnerModule;
  Proxy: Proxy;
  SampleFeatureFlagModule: SampleFeatureFlagModule;
  SampleModuleA: SampleModuleA;
  SampleModuleB: SampleModuleB;
  SampleOwnedModule: SampleOwnedModule;
  SampleRouter: SampleRouter;
  TokenModule: TokenModule;
  TokenModuleRouter: TokenModuleRouter;
  UpgradeModule: UpgradeModule;
  DecayTokenModule: DecayTokenModule;
  DecayTokenModuleRouter: DecayTokenModuleRouter;
}

type Implementation =
  | 'CoreRouter'
  | 'AssociatedSystemsModuleRouter'
  | 'TokenModuleRouter'
  | 'NftModuleRouter'
  | 'SampleRouter'
  | 'FeatureFlagModuleRouter'
  | 'DecayTokenModuleRouter';

const r = coreBootstrap<Contracts>({
  cannonfile: 'cannonfile.test.toml',
});

const restoreSnapshot = r.createSnapshot();

export function bootstrap({ implementation }: { implementation: Implementation }) {
  before(restoreSnapshot);

  before('setup implementation', async function () {
    const Implementation = r.getContract(implementation);

    const UpgradeModule = getContractBehindProxy('UpgradeModule');
    const currentImplementation = await UpgradeModule.getImplementation();

    // Upgrade the Proxy to the desired implemenatation
    if (currentImplementation !== Implementation.address) {
      await UpgradeModule.upgradeTo(Implementation.address);
    }
  });

  /**
   * Get the given contract using the current Proxy address
   */
  function getContractBehindProxy<T extends keyof Contracts>(contractName: T) {
    const proxyAddress = r.getContract('Proxy').address;
    return r.getContract(contractName, proxyAddress) as Contracts[T];
  }

  return {
    ...r,
    getContractBehindProxy,
  };
}
