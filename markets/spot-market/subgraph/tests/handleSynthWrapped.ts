import { assert, log } from 'matchstick-as';
import { handleSynthWrapped } from '../optimism-mainnet';
import { createSynthWrappedEvent } from './event-factories/createSynthWrappedEvent';

const MOCK_EVENT_TXN = '0xa16081f360e3847006db660bae1c6d1b2e17ec2a';

export default function test(): void {
  assert.entityCount('WrapSynth', 0);

  log.info('Should create a new record for the wrapped synth event', []);
  handleSynthWrapped(createSynthWrappedEvent(69, 100, 1, 2, 3, 4, 420, 10_000, 10, 1));

  const id1 = `${MOCK_EVENT_TXN}/1`;
  assert.entityCount('WrapSynth', 1);
  assert.fieldEquals('WrapSynth', id1, 'id', id1);
  assert.fieldEquals('WrapSynth', id1, 'block', '10');
  assert.fieldEquals('WrapSynth', id1, 'timestamp', '10000');
  assert.fieldEquals('WrapSynth', id1, 'type', 'Wrapped');
  assert.fieldEquals('WrapSynth', id1, 'marketId', '69');
  assert.fieldEquals('WrapSynth', id1, 'amount', '100');
  assert.fieldEquals('WrapSynth', id1, 'collectedFees', '420');
  assert.fieldEquals('WrapSynth', id1, 'wrapperFees', '4');

  log.info('Should create another record for the same event', []);
  handleSynthWrapped(createSynthWrappedEvent(69, 100, 1, 2, 3, 4, 420, 20_000, 20, 2));

  const id2 = `${MOCK_EVENT_TXN}/2`;
  assert.entityCount('WrapSynth', 2);
  assert.fieldEquals('WrapSynth', id2, 'id', id2);
  assert.fieldEquals('WrapSynth', id2, 'block', '20');
  assert.fieldEquals('WrapSynth', id2, 'timestamp', '20000');
  assert.fieldEquals('WrapSynth', id2, 'type', 'Wrapped');
  assert.fieldEquals('WrapSynth', id2, 'marketId', '69');
  assert.fieldEquals('WrapSynth', id2, 'amount', '100');
  assert.fieldEquals('WrapSynth', id2, 'collectedFees', '420');
  assert.fieldEquals('WrapSynth', id2, 'wrapperFees', '4');
}
