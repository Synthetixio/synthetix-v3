import { RewardsClaimed as RewardsClaimedEvent } from './generated/CoreProxy/CoreProxy';
import { AccountRewardsDistributor, RewardsClaimed, RewardsDistributor } from './generated/schema';

export function handleRewardsClaimed(event: RewardsClaimedEvent): void {
  const accountRewardsDistributor = AccountRewardsDistributor.load(
    event.params.poolId
      .toString()
      .concat('-')
      .concat(event.params.collateralType.toHex())
      .concat('-')
      .concat(event.params.distributor.toHex())
  );
  const rewardsClaimed = new RewardsClaimed(
    event.params.distributor
      .toHex()
      .concat('-')
      .concat(event.block.timestamp.toString())
      .concat('-')
      .concat(event.logIndex.toString())
  );
  let rewardsDistributor = RewardsDistributor.load(event.params.distributor.toHex());
  if (rewardsDistributor !== null) {
    rewardsDistributor.total_claimed = rewardsDistributor.total_claimed.plus(
      event.params.amount.toBigDecimal()
    );
    rewardsDistributor.updated_at = event.block.timestamp;
    rewardsDistributor.updated_at_block = event.block.number;
    rewardsDistributor.save();
  }
  if (accountRewardsDistributor !== null) {
    if (accountRewardsDistributor.total_claimed !== null) {
      accountRewardsDistributor.total_claimed = accountRewardsDistributor.total_claimed!.plus(
        event.params.amount.toBigDecimal()
      );
    } else {
      accountRewardsDistributor.total_claimed = event.params.amount.toBigDecimal();
    }
    accountRewardsDistributor.updated_at = event.block.timestamp;
    accountRewardsDistributor.updated_at_block = event.block.number;
    accountRewardsDistributor.distributor = event.params.distributor.toHex();
    accountRewardsDistributor.save();
  }
  rewardsClaimed.distributor = event.params.distributor.toHex();
  rewardsClaimed.created_at = event.block.timestamp;
  rewardsClaimed.created_at_block = event.block.number;
  rewardsClaimed.account = event.params.accountId.toString();
  rewardsClaimed.pool = event.params.poolId.toString();
  rewardsClaimed.collateral_type = event.params.collateralType;
  rewardsClaimed.amount = event.params.amount.toBigDecimal();
  rewardsClaimed.updated_at = event.block.timestamp;
  rewardsClaimed.updated_at_block = event.block.number;
  rewardsClaimed.save();
}
