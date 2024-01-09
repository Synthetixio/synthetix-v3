import { MarketUsdDeposited } from './generated/CoreProxy/CoreProxy';
import { Market } from './generated/schema';
import { log } from '@graphprotocol/graph-ts';
import { createMarketSnapshotByDay } from './marketSnapshotByDay';
import { createMarketSnapshotByWeek } from './marketSnapshotByWeek';

export function handleMarketUsdDeposited(event: MarketUsdDeposited): void {
  const marketId = event.params.marketId.toString();
  const market = Market.load(marketId);
  if (market == null) {
    log.error(
      'Something went wrong, got a MarketUsdDeposited event for a market that doesnt exists ' +
        event.params.marketId.toString(),
      []
    );
    return;
  }

  const usdDeposited = market.usd_deposited.plus(event.params.amount.toBigDecimal());
  const netIssuance = market.net_issuance.minus(event.params.amount.toBigDecimal());
  market.updated_at = event.block.timestamp;
  market.updated_at_block = event.block.number;
  market.net_issuance = netIssuance;
  market.usd_deposited = usdDeposited;
  market.save();

  createMarketSnapshotByDay(market);
  createMarketSnapshotByWeek(market);
}
