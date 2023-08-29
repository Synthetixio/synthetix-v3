import { assert } from 'matchstick-as';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { handleCollateralModified } from '../optimism-goerli';
import { createCollateralModifiedEvent } from './event-factories/createCollateralModifiedEvent';

export default function test(): void {
  handleCollateralModified(
    createCollateralModifiedEvent(
      1,
      69,
      100,
      '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
      10_000,
      10,
      1
    )
  );

  assert.fieldEquals('CollateralModified', '1-10-1', 'accountId', '1');
  assert.fieldEquals('CollateralModified', '1-10-1', 'timestamp', '10000');
  assert.fieldEquals('CollateralModified', '1-10-1', 'amount', '100');
  assert.fieldEquals(
    'CollateralModified',
    '1-10-1',
    'sender',
    '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
  );
  assert.fieldEquals('CollateralModified', '1-10-1', 'synthMarketId', '69');

  handleCollateralModified(
    createCollateralModifiedEvent(
      1,
      69,
      -200,
      '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
      10_000,
      11,
      2
    )
  );

  assert.fieldEquals('CollateralModified', '1-11-2', 'accountId', '1');
  assert.fieldEquals('CollateralModified', '1-11-2', 'timestamp', '10000');
  assert.fieldEquals('CollateralModified', '1-11-2', 'amount', '-200');
  assert.fieldEquals(
    'CollateralModified',
    '1-11-2',
    'sender',
    '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
  );
  assert.fieldEquals('CollateralModified', '1-11-2', 'synthMarketId', '69');
}
