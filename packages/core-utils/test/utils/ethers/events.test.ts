/* eslint @typescript-eslint/no-var-requires: 0 */

import assert from 'assert/strict';
import { ethers } from 'ethers';

import deploymentTxReceipt from '../../fixtures/deployment-tx-receipt';
import dummyABI from '../../fixtures/event-abi';
import parsedTxReceipt from '../../fixtures/parsed-tx-receipt';
import unparsedTxReceipt from '../../fixtures/unparsed-tx-receipt';
import { findEvent } from '../../../src/utils/ethers/events';

describe('utils/ethers/events.ts', function () {
  it('can retrieve events from a regular transaction receipt', function () {
    const event = findEvent({
      receipt: parsedTxReceipt,
      eventName: 'ValueSet',
    }) as ethers.Event;

    assert.equal(event.event, 'ValueSet');
    assert.equal(event.args!.sender, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    assert.equal(event.args!.value, '42');
  });

  it('returns undefined if it cannot find any event', function () {
    assert.equal(findEvent({ receipt: unparsedTxReceipt, eventName: 'InvalidEvent' }), undefined);
  });

  it('can retrieve events from a deployment transaction receipt if a contract interface is provided', function () {
    const contract = new ethers.Contract('0x0000000000000000000000000000000000000001', dummyABI);

    const event = findEvent({
      receipt: deploymentTxReceipt,
      eventName: 'Test',
      contract,
    }) as ethers.Event;

    assert.equal(event.event, 'Test');
    assert.equal(event.args!.sender, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
  });
});
