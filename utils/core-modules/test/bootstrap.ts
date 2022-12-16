import { coreBootstrap } from '@synthetixio/hardhat-router/utils/tests';
import { ethers } from 'ethers';
import {
  AssociatedSystemsModule,
  FeatureFlagModule,
  OwnerModule,
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
  SampleFeatureFlagModule: SampleFeatureFlagModule;
  SampleModuleA: SampleModuleA;
  SampleModuleB: SampleModuleB;
  SampleOwnedModule: SampleOwnedModule;
  UpgradeModule: UpgradeModule;
}

const r = coreBootstrap<Contracts>({
  cannonfile: 'test/cannonfile.toml',
});

const restoreSnapshot = r.createSnapshot();

export function bootstrap() {
  before(restoreSnapshot);
  return r;
}
