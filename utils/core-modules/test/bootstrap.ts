import { coreBootstrap } from '@synthetixio/router/utils/tests';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ethers } from 'ethers'; // This is needed because of types
import {
  AssociatedSystemsModule,
  AssociatedSystemsModuleRouter,
  CoreRouter,
  DecayTokenModule,
  DecayTokenModuleRouter,
  FeatureFlagModule,
  FeatureFlagModuleRouter,
  GenericModule,
  NftModule,
  NftModuleRouter,
  OwnerModule,
  Proxy,
  SampleFeatureFlagModule,
  SampleOwnedModule,
  SampleRouter,
  TokenModule,
  TokenModuleRouter,
  UpgradeModule,
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
  NftModuleRouter2: NftModuleRouter;
  NftModuleRouter3: NftModuleRouter;
  OwnerModule: OwnerModule;
  Proxy: Proxy;
  SampleFeatureFlagModule: SampleFeatureFlagModule;
  SampleOwnedModule: SampleOwnedModule;
  SampleRouter: SampleRouter;
  TokenModule: TokenModule;
  TokenModuleRouter: TokenModuleRouter;
  TokenModuleRouter2: TokenModuleRouter;
  TokenModuleRouter3: TokenModuleRouter;
  UpgradeModule: UpgradeModule;
  DecayTokenModule: DecayTokenModule;
  DecayTokenModuleRouter: DecayTokenModuleRouter;
}

type Implementation =
  | 'CoreRouter'
  | 'AssociatedSystemsModuleRouter'
  | 'TokenModuleRouter'
  | 'TokenModuleRouter2'
  | 'TokenModuleRouter3'
  | 'NftModuleRouter'
  | 'NftModuleRouter2'
  | 'NftModuleRouter3'
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
