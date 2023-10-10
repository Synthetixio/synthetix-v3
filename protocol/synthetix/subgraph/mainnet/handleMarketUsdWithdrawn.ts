import { MarketUsdWithdrawn } from './generated/CoreProxy/CoreProxy';
import { Market } from './generated/schema';
import { log } from '@graphprotocol/graph-ts';
import { createMarketSnapshotByDay } from './marketSnapshotByDay';
import { createMarketSnapshotByWeek } from './marketSnapshotByWeek';

export function handleMarketUsdWithdrawn(event: MarketUsdWithdrawn): void {
  const marketId = event.params.marketId.toString();

  const market = Market.load(marketId);
  if (market == null) {
    log.error(
      'Something went wrong, got a MarketUsdWithdrawn event for a market that doesnt exists ' +
        event.params.marketId.toString(),
      []
    );
    return;
  }

  const timestamp = event.block.timestamp;
  const blockNumber = event.block.number;
  const usdWithdrawn = market.usd_withdrawn.plus(event.params.amount.toBigDecimal());
  const netIssuance = market.net_issuance.plus(event.params.amount.toBigDecimal());
  market.updated_at = timestamp;
  market.updated_at_block = blockNumber;
  market.net_issuance = netIssuance;
  market.usd_withdrawn = usdWithdrawn;
  market.save();

  createMarketSnapshotByDay(market);
  createMarketSnapshotByWeek(market);
}
