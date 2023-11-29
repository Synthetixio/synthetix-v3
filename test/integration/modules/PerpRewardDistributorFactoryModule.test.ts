import { bootstrap } from '../../bootstrap';
import { genBootstrap } from '../../generators';

describe('PerpRewardDistributorFactoryModule', () => {
  const bs = bootstrap(genBootstrap());
  const { traders, owner, markets, collaterals, collateralsWithoutSusd, systems, provider, restore } = bs;

  beforeEach(restore);

  describe('createRewardDistributor', () => {
    it('should be able to create a new reward distributor');

    it('should emit all events in correct order');

    it('should revert whe n market owner is not msg.sender');
  });

  describe('Core.RewardsManagerModule.registerRewardsDistributor', () => {
    it('should be able to register a PerpRewardDistributor');
  });

  describe('Core.RewardsManagerModule.claimReward', () => {
    it('should be able to claim a distributed reward');
  });
});
