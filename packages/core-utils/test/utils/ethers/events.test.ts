/* eslint @typescript-eslint/no-var-requires: 0 */

import assert from 'assert/strict';
import { ethers } from 'ethers';

import { findEvent } from '../../../src/utils/ethers/events';

// TODO
const parsedTxReceipt = require('../../fixtures/parsed-tx-receipt');
const unparsedTxReceipt = require('../../fixtures/unparsed-tx-receipt');
const deploymentTxReceipt = require('../../fixtures/deployment-tx-receipt');
const dummyABI = require('../../fixtures/event-abi');

describe('utils/ethers/events.js', () => {
  it('can retrieve events from a regular transaction receipt', async () => {
    const event = findEvent({
      receipt: parsedTxReceipt,
      eventName: 'ValueSet',
    });

    assert.equal(event.event, 'ValueSet');
    assert.equal(event.args.sender, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    assert.equal(event.args.value, '42');
  });

  it('returns undefined if it cannot find any event', async () => {
    assert.equal(findEvent({ receipt: unparsedTxReceipt, eventName: 'InvalidEvent' }), undefined);
  });

  it('can retrieve events from a deployment transaction receipt if a contract interface is provided', async () => {
    const contract = await new ethers.Contract(
      '0x0000000000000000000000000000000000000001',
      dummyABI
    );

    const event = findEvent({
      receipt: deploymentTxReceipt,
      eventName: 'Test',
      contract,
    });

    assert.equal(event.event, 'Test');
    assert.equal(event.args.sender, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
  });
});
