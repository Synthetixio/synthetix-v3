/* eslint-disable no-undef */
import { Market, MarketSnapshotByWeek } from '../generated/schema';
import { BigInt } from '@graphprotocol/graph-ts';

// exported for test
export function getISOWeekNumber(timestamp: i64): i64 {
  const dateOfTimeStamp = new Date(<i64>timestamp).toISOString().slice(0, 4);
  // Calculate the timestamp for the first day of the year
  const firstDayDate = Date.parse(dateOfTimeStamp + '-01-01T00:00:00.000Z');

  const firstDayTimestamp = firstDayDate.getTime() as f64;
  // Calculate the day of the week for the first day of the year (0 = Sunday, 6 = Saturday)
  const firstDayOfWeek = firstDayDate.getUTCDay() as f64;

  // Calculate the number of milliseconds in one day
  const oneDay = (1000 * 60 * 60 * 24) as f64;
  // Calculate the number of days between the first day of the year and the date in question
  const msSinceFirstDayOfYear = ((timestamp as f64) - firstDayTimestamp) as f64;
  const days = Math.round(msSinceFirstDayOfYear / oneDay);

  // Calculate the week number (weeks start on Monday)
  return Math.floor((days + firstDayOfWeek) / 7) as i64;
}

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
