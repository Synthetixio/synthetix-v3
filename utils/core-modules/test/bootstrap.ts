import { coreBootstrap } from '@synthetixio/hardhat-router/utils/tests';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ethers } from 'ethers';
import {
  AssociatedSystemsModule,
  CoreModule,
  CoreRouter,
  FeatureFlagModule,
  GenericModule,
  OwnerModule,
  SampleFeatureFlagModule,
  SampleModuleA,
  SampleModuleB,
  SampleOwnedModule,
  SampleRouter,
  TokenModule,
  TokenModuleRouter,
  UpgradeModule,
} from '../typechain-types';

interface Contracts {
  AssociatedSystemsModule: AssociatedSystemsModule;
  CoreModule: CoreModule;
  CoreRouter: CoreRouter;
  FeatureFlagModule: FeatureFlagModule;
  GenericModule: GenericModule;
  OwnerModule: OwnerModule;
  Proxy: CoreModule;
  SampleFeatureFlagModule: SampleFeatureFlagModule;
  SampleModuleA: SampleModuleA;
  SampleModuleB: SampleModuleB;
  SampleOwnedModule: SampleOwnedModule;
  SampleRouter: SampleRouter;
  TokenModule: TokenModule;
  TokenModuleRouter: TokenModuleRouter;
  UpgradeModule: UpgradeModule;
}

const r = coreBootstrap<Contracts>({
  cannonfile: 'cannonfile.test.toml',
});

const restoreSnapshot = r.createSnapshot();

export function bootstrap({ implementation }: { implementation: keyof Contracts }) {
  before(restoreSnapshot);

  before('setup implementation', async function () {
    const Proxy = r.getContract('Proxy');
    const Implementation = r.getContract(implementation);
    const currentImplementation = await Proxy.getImplementation();

    if (currentImplementation !== Implementation.address) {
      await Proxy.upgradeTo(Implementation.address);
    }
  });

  return {
    ...r,
    // getContract() override using as the Proxy address by default
    getContract<T extends keyof Contracts>(contractName: T, address?: string) {
      if (address === undefined && !contractName.endsWith('Proxy')) {
        address = r.getContract('Proxy').address;
      }

      return r.getContract(contractName, address) as Contracts[T];
    },
  };
}
