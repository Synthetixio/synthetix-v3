import { SynthUnwrapped } from './generated/SpotMarketProxy/SpotMarketProxy';
import { WrappSynth } from './generated/schema';

export function handleSynthUnwrapped(event: SynthUnwrapped): void {
  let id = event.transaction.hash.toHexString() + '/' + event.logIndex.toString();
  let synth = new WrappSynth(id);

  synth.marketId = event.params.synthMarketId;
  synth.amount = event.params.amountUnwrapped;
  synth.collectedFees = event.params.feesCollected;
  synth.wrapperFees = event.params.fees.wrapperFees;
  synth.type = 'UnWrapped';
  synth.block = event.block.number;
  synth.timestamp = event.block.timestamp;

  synth.save();
}
