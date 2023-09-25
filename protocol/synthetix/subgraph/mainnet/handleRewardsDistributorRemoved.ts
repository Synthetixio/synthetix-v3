import { RewardsDistributorRemoved } from './generated/CoreProxy/CoreProxy';
import { RewardsDistributor } from './generated/schema';

export function handleRewardsDistributorRemoved(event: RewardsDistributorRemoved): void {
  const distributor = RewardsDistributor.load(event.params.distributor.toHex());

  if (distributor !== null) {
    distributor.updated_at = event.block.timestamp;
    distributor.updated_at_block = event.block.number;
    distributor.isActive = false;
    distributor.save();
  }
}
