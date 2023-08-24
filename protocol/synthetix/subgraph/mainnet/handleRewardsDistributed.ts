import { RewardsDistributed } from './generated/CoreProxy/CoreProxy';
import {
  AccountRewardsDistributor,
  RewardsDistribution,
  RewardsDistributor,
} from './generated/schema';

export function handleRewardsDistributed(event: RewardsDistributed): void {
  const rewardsDistribution = new RewardsDistribution(
    event.params.distributor
      .toHex()
      .concat('-')
      .concat(event.block.timestamp.toString())
      .concat('-')
      .concat(event.logIndex.toString())
  );
  let accountRewardsDistributor = AccountRewardsDistributor.load(
    event.params.poolId
      .toString()
      .concat('-')
      .concat(event.params.collateralType.toHex())
      .concat('-')
      .concat(event.params.distributor.toHex())
  );
  let rewardsDistributor = RewardsDistributor.load(event.params.distributor.toHex());

  if (rewardsDistributor !== null) {
    rewardsDistributor.total_distributed = rewardsDistributor.total_distributed.plus(
      event.params.amount.toBigDecimal()
    );
    rewardsDistributor.updated_at = event.block.timestamp;
    rewardsDistributor.updated_at_block = event.block.number;

    if (rewardsDistributor.pool === null) {
      rewardsDistributor.pool = event.params.poolId.toString();
    }

    rewardsDistributor.save();
  }

  if (accountRewardsDistributor === null) {
    accountRewardsDistributor = new AccountRewardsDistributor(
      event.params.poolId
        .toString()
        .concat('-')
        .concat(event.params.collateralType.toHex())
        .concat('-')
        .concat(event.params.distributor.toHex())
    );
    accountRewardsDistributor.created_at = event.block.timestamp;
    accountRewardsDistributor.created_at_block = event.block.number;
  }
  accountRewardsDistributor.distributor = event.params.distributor.toHex();
  accountRewardsDistributor.updated_at = event.block.timestamp;
  accountRewardsDistributor.updated_at_block = event.block.number;
  rewardsDistribution.distributor = event.params.distributor.toHex();
  rewardsDistribution.pool = event.params.poolId.toString();
  rewardsDistribution.collateral_type = event.params.collateralType;
  rewardsDistribution.amount = event.params.amount.toBigDecimal();
  rewardsDistribution.start = event.params.start;
  rewardsDistribution.duration = event.params.duration;
  rewardsDistribution.created_at = event.block.timestamp;
  rewardsDistribution.created_at_block = event.block.number;
  rewardsDistribution.updated_at = event.block.timestamp;
  rewardsDistribution.updated_at_block = event.block.number;
  accountRewardsDistributor.save();
  rewardsDistribution.save();
}
