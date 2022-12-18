import { coreBootstrap } from '@synthetixio/hardhat-router/utils/tests';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ethers } from 'ethers';
import {
  AssociatedSystemsModule,
  FeatureFlagModule,
  OwnerModule,
  Proxy,
  SampleFeatureFlagModule,
  SampleModuleA,
  SampleModuleB,
  SampleOwnedModule,
  UpgradeModule,
} from '../typechain-types';

interface Contracts {
  AssociatedSystemsModule: AssociatedSystemsModule;
  FeatureFlagModule: FeatureFlagModule;
  OwnerModule: OwnerModule;
  Proxy: Proxy;
  SampleFeatureFlagModule: SampleFeatureFlagModule;
  SampleModuleA: SampleModuleA;
  SampleModuleB: SampleModuleB;
  SampleOwnedModule: SampleOwnedModule;
  UpgradeModule: UpgradeModule;
}

const r = coreBootstrap<Contracts>({
  cannonfile: 'cannonfile.test.toml',
});

const restoreSnapshot = r.createSnapshot();

export function bootstrap() {
  before(restoreSnapshot);
  return {
    ...r,
    getContract(contractName: keyof Contracts, address?: string) {
      if (!address) address = r.getContract('Proxy').address;
      return r.getContract(contractName, address);
    },
  };
}
