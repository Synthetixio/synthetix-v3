/* eslint-disable no-undef */
import { Market, MarketSnapshotByWeek } from './generated/schema';
import { getISOWeekNumber } from './getISOWeekNumber';
import { BigInt } from '@graphprotocol/graph-ts';

export function createMarketSnapshotByWeek(marketWithLatestValues: Market): void {
  const date = new Date(<i64>parseInt(marketWithLatestValues.updated_at.toString()) * 1000);

  const week = getISOWeekNumber(date.getTime());

  const year = date.toISOString().slice(0, 4); // RIP at year 10k
  const marketSnapshotId = marketWithLatestValues.id
    .toString()
    .concat('-week-')
    .concat(year)
    .concat('-')
    .concat(week.toString());

  let marketSnapshotByWeek = MarketSnapshotByWeek.load(marketSnapshotId);

  if (!marketSnapshotByWeek) {
    // If we have two events in the same week update the data fields
    marketSnapshotByWeek = new MarketSnapshotByWeek(marketSnapshotId);
    marketSnapshotByWeek.updates_in_period = new BigInt(0);
    marketSnapshotByWeek.market = marketWithLatestValues.id;
    marketSnapshotByWeek.created_at = marketWithLatestValues.created_at;
    marketSnapshotByWeek.created_at_block = marketWithLatestValues.created_at_block;
  }
  marketSnapshotByWeek.usd_deposited = marketWithLatestValues.usd_deposited;
  marketSnapshotByWeek.usd_withdrawn = marketWithLatestValues.usd_withdrawn;
  marketSnapshotByWeek.net_issuance = marketWithLatestValues.net_issuance;
  marketSnapshotByWeek.reported_debt = marketWithLatestValues.reported_debt;
  marketSnapshotByWeek.updated_at = marketWithLatestValues.updated_at;
  marketSnapshotByWeek.updated_at_block = marketWithLatestValues.updated_at_block;
  marketSnapshotByWeek.updates_in_period = marketSnapshotByWeek.updates_in_period.plus(
    new BigInt(1)
  );

  marketSnapshotByWeek.save();
}
