import { assert, log } from 'matchstick-as';
import { handleSynthUnWrapped } from '../optimism-mainnet';
import { createSynthUnWrappedEvent } from './event-factories/createSynthUnwrappedEvent';

const MOCK_EVENT_TXN = '0xa16081f360e3847006db660bae1c6d1b2e17ec2a';

export default function test(): void {
  assert.entityCount('WrappSynth', 0);

  log.info('Should create a new record for the wrapped synth event', []);
  handleSynthUnWrapped(createSynthUnWrappedEvent(69, 100, 1, 2, 3, 4, 420, 10_000, 10, 1));

  const id1 = `${MOCK_EVENT_TXN}/1`;
  assert.entityCount('WrappSynth', 1);
  assert.fieldEquals('WrappSynth', id1, 'id', id1);
  assert.fieldEquals('WrappSynth', id1, 'block', '10');
  assert.fieldEquals('WrappSynth', id1, 'timestamp', '10000');
  assert.fieldEquals('WrappSynth', id1, 'type', 'UnWrapped');
  assert.fieldEquals('WrappSynth', id1, 'marketId', '69');
  assert.fieldEquals('WrappSynth', id1, 'amount', '100');
  assert.fieldEquals('WrappSynth', id1, 'collectedFees', '420');
  assert.fieldEquals('WrappSynth', id1, 'wrapperFees', '4');

  log.info('Should create another record for the same event', []);
  handleSynthUnWrapped(createSynthUnWrappedEvent(69, 100, 1, 2, 3, 4, 420, 20_000, 20, 2));

  const id2 = `${MOCK_EVENT_TXN}/2`;
  assert.entityCount('WrappSynth', 2);
  assert.fieldEquals('WrappSynth', id2, 'id', id2);
  assert.fieldEquals('WrappSynth', id2, 'block', '20');
  assert.fieldEquals('WrappSynth', id2, 'timestamp', '20000');
  assert.fieldEquals('WrappSynth', id2, 'type', 'UnWrapped');
  assert.fieldEquals('WrappSynth', id2, 'marketId', '69');
  assert.fieldEquals('WrappSynth', id2, 'amount', '100');
  assert.fieldEquals('WrappSynth', id2, 'collectedFees', '420');
  assert.fieldEquals('WrappSynth', id2, 'wrapperFees', '4');
}
