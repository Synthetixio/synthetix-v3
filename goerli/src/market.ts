import {
  CoreProxy,
  MarketRegistered,
  MarketUsdDeposited,
  MarketUsdWithdrawn,
} from '../generated/CoreProxy/CoreProxy';
import { Market } from '../generated/schema';
import { BigDecimal, log } from '@graphprotocol/graph-ts';
import { createMarketSnapshotByDay } from './marketSnapshotByDay';
import { createMarketSnapshotByWeek } from './marketSnapshotByWeek';

export function handleMarketCreated(event: MarketRegistered): void {
  const newMarket = new Market(event.params.marketId.toString());
  newMarket.address = event.params.market;
  newMarket.created_at = event.block.timestamp;
  newMarket.created_at_block = event.block.number;
  newMarket.updated_at = event.block.timestamp;
  newMarket.updated_at_block = event.block.number;
  newMarket.usd_deposited = BigDecimal.fromString('0');
  newMarket.usd_withdrawn = BigDecimal.fromString('0');
  newMarket.net_issuance = BigDecimal.fromString('0');
  newMarket.reported_debt = BigDecimal.fromString('0');
  newMarket.save();
}

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
  const contract = CoreProxy.bind(event.address);
  const reportedDebt = contract.getMarketReportedDebt(event.params.marketId).toBigDecimal();
  const netIssuance = market.net_issuance.minus(event.params.amount.toBigDecimal());
  market.reported_debt = reportedDebt;
  market.updated_at = event.block.timestamp;
  market.updated_at_block = event.block.number;
  market.net_issuance = netIssuance;
  market.usd_deposited = usdDeposited;
  market.save();

  createMarketSnapshotByDay(market);
  createMarketSnapshotByWeek(market);
}

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
  const contract = CoreProxy.bind(event.address);
  const reportedDebt = contract.getMarketReportedDebt(event.params.marketId).toBigDecimal();
  const netIssuance = market.net_issuance.plus(event.params.amount.toBigDecimal());
  market.reported_debt = reportedDebt;
  market.updated_at = timestamp;
  market.updated_at_block = blockNumber;
  market.net_issuance = netIssuance;
  market.usd_withdrawn = usdWithdrawn;
  market.save();

  createMarketSnapshotByDay(market);
  createMarketSnapshotByWeek(market);
}
