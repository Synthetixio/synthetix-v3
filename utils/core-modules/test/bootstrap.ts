import { coreBootstrap } from '@synthetixio/hardhat-router/utils/tests';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ethers } from 'ethers';
import {
  AssociatedSystemsModule,
  CoreModule,
  CoreRouter,
  FeatureFlagModule,
  FeatureFlagModuleRouter,
  GenericModule,
  NftModule,
  OwnerModule,
  Proxy__factory,
  SampleFeatureFlagModule,
  SampleModuleA,
  SampleModuleB,
  SampleOwnedModule,
  SampleRouter,
  TokenModule,
  UpgradeModule,
} from '../typechain-types';

interface Contracts {
  AssociatedSystemsModule: AssociatedSystemsModule;
  AssociatedSystemsModuleRouter: AssociatedSystemsModule;
  CoreModule: CoreModule;
  CoreRouter: CoreRouter;
  FeatureFlagModule: FeatureFlagModule;
  FeatureFlagModuleRouter: FeatureFlagModuleRouter;
  GenericModule: GenericModule;
  NftModule: NftModule;
  NftModuleRouter: NftModule;
  OwnerModule: OwnerModule;
  Proxy: CoreModule;
  SampleFeatureFlagModule: SampleFeatureFlagModule;
  SampleModuleA: SampleModuleA;
  SampleModuleB: SampleModuleB;
  SampleOwnedModule: SampleOwnedModule;
  SampleRouter: SampleRouter;
  TokenModule: TokenModule;
  TokenModuleRouter: TokenModule;
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

  /**
   * Override of coreBootstrap().getContract() function to use the current Proxy
   * address by default
   */
  function getContract<T extends keyof Contracts>(contractName: T, address?: string) {
    if (address === undefined && !contractName.endsWith('Proxy')) {
      address = r.getContract('Proxy').address;
    }

    return r.getContract(contractName, address) as Contracts[T];
  }

  async function deployContract<T extends keyof Contracts>(contractName: T, ...args: unknown[]) {
    const factories = await import('../typechain-types');
    const [owner] = r.getSigners();
    const Factory = factories[`${contractName}__factory`];
    const factory = new Factory(owner);
    const Contract = await factory.deploy(...args);
    await Contract.deployed();
    return Contract as Contracts[T];
  }

  /**
   * Deploy a new Proxy contracts using the given implementation
   */
  async function deployProxy<T extends keyof Contracts>(implementation: T) {
    const Implementation = getContract(implementation);
    return await deployContract('Proxy', Implementation.address);
  }

  return {
    ...r,
    getContract,
    deployContract,
    deployProxy,
  };
}
