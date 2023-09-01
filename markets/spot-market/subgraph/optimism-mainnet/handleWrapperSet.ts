import { WrapperSet } from './generated/SpotMarketProxy/SpotMarketProxy';
import { Wrapper } from './generated/schema';

export function handleWrapperSet(event: WrapperSet): void {
  let id = event.params.synthMarketId.toString();
  let wrapperConfig = Wrapper.load(id);

  if (!wrapperConfig) {
    wrapperConfig = new Wrapper(id);
  }

  wrapperConfig.wrapCollateralType = event.params.wrapCollateralType.toHexString();
  wrapperConfig.maxWrappableAmount = event.params.maxWrappableAmount;
  wrapperConfig.marketId = event.params.synthMarketId;
  wrapperConfig.save();
}
