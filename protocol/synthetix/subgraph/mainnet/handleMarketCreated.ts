import { MarketRegistered } from './generated/CoreProxy/CoreProxy';
import { Market } from './generated/schema';
import { BigDecimal } from '@graphprotocol/graph-ts';

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
