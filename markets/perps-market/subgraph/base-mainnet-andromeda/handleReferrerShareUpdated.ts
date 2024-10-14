import { ReferrerShareUpdated } from './generated/PerpsMarketProxy/PerpsMarketProxy';
import { ReferrerShare } from './generated/schema';

export function handleReferrerShareUpdated(event: ReferrerShareUpdated): void {
  const id = event.params.referrer.toHexString();

  let referrerShare = ReferrerShare.load(id);

  if (!referrerShare) {
    referrerShare = new ReferrerShare(id);
  }

  referrerShare.referrer = event.params.referrer.toHexString();
  referrerShare.shareRatioD18 = event.params.shareRatioD18;
  referrerShare.save();
}
