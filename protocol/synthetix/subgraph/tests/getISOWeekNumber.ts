import { log, assert } from 'matchstick-as';
import { getISOWeekNumber } from '../mainnet';

export default function test(): void {
  const date = Date.parse('2022-01-01T00:00:00.000Z');

  // @ts-ignore
  const weekNumber = getISOWeekNumber(date.getTime());
  assert.stringEquals(weekNumber.toString(), '0');
  // @ts-ignore
  const weekNumber1 = getISOWeekNumber(Date.parse('2022-01-08T00:00:00.000Z').getTime());
  assert.stringEquals(weekNumber1.toString(), '1');
  // @ts-ignore
  const weekNumber2 = getISOWeekNumber(Date.parse('2022-10-11T12:43:00.000Z').getTime());
  assert.stringEquals(weekNumber2.toString(), '41');
  // @ts-ignore
  const weekNumber3 = getISOWeekNumber(Date.parse('2022-12-12T10:26:04.485Z').getTime());
  assert.stringEquals(weekNumber3.toString(), '50');
}
