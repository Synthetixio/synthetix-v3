import { SynthWrapped } from './generated/SpotMarketProxy/SpotMarketProxy';
import { WrapSynth } from './generated/schema';

export function handleSynthWrapped(event: SynthWrapped): void {
  let id = event.transaction.hash.toHexString() + '/' + event.logIndex.toString();
  let synth = new WrapSynth(id);

  synth.marketId = event.params.synthMarketId;
  synth.amount = event.params.amountWrapped;
  synth.collectedFees = event.params.feesCollected;
  synth.wrapperFees = event.params.fees.wrapperFees;
  synth.type = 'Wrapped';
  synth.block = event.block.number;
  synth.timestamp = event.block.timestamp;

  synth.save();
}
