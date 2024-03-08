import { RewardsDistributorRegistered } from './generated/CoreProxy/CoreProxy';
import { RewardsDistributor, Pool } from './generated/schema';
import { BigDecimal } from '@graphprotocol/graph-ts';

export function handleRewardsDistributorRegistered(event: RewardsDistributorRegistered): void {
  const distributor = new RewardsDistributor(event.params.distributor.toHex());
  distributor.created_at = event.block.timestamp;
  distributor.created_at_block = event.block.number;
  distributor.updated_at = event.block.number;
  distributor.updated_at_block = event.block.timestamp;
  distributor.total_claimed = BigDecimal.fromString('0');
  distributor.total_distributed = BigDecimal.fromString('0');
  distributor.isActive = true;

  const pool = Pool.load(event.params.poolId.toString());

  if (pool !== null) {
    distributor.pool = pool.id;
  }

  distributor.save();
}
