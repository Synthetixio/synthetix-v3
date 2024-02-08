import { ethers } from 'ethers';

// useful for preventing rounding errors
export const ONE_ETHER = ethers.utils.parseEther('1');

export type GetQuantoPositionSizeArgs = {
  sizeInBaseAsset: ethers.BigNumber;
  quantoAssetPrice: ethers.BigNumber;
};

// Calculates the size of a quanto position in
// terms of the quanto asset
//
// Unit of the result: ($BASE * $QUANTO) / $sUSD
export const getQuantoPositionSize = ({
  sizeInBaseAsset,
  quantoAssetPrice,
}: GetQuantoPositionSizeArgs): ethers.BigNumber => {
  return sizeInBaseAsset.mul(ONE_ETHER).div(quantoAssetPrice);
};

export type GetQuantoFillPrice = {
  skew: ethers.BigNumber;
  skewScale: ethers.BigNumber;
  size: ethers.BigNumber;
  price: ethers.BigNumber;
};

// Calculates the fill price of a quanto position; the price of the base asset
// at which the position is filled.
//
// Unit of the result: $sUSD
export const getQuantoFillPrice = ({ skew, skewScale, size, price }: GetQuantoFillPrice) => {
  if (skewScale.eq(0)) {
    return price;
  }
  const pdBefore = skew.mul(ONE_ETHER).div(skewScale);
  const pdAfter = skew.add(size).mul(ONE_ETHER).div(skewScale);
  const priceBefore = price.add(price.mul(pdBefore).div(ONE_ETHER));
  const priceAfter = price.add(price.mul(pdAfter).div(ONE_ETHER));
  return priceBefore.add(priceAfter).div(2);
};

export type GetQuantoPnlArgs = {
  baseAssetStartPrice: ethers.BigNumber;
  baseAssetEndPrice: ethers.BigNumber;
  quantoAssetStartPrice: ethers.BigNumber;
  quantoAssetEndPrice: ethers.BigNumber;
  baseAssetSizeDelta: ethers.BigNumber;
};

// Calculates the PnL of a quanto position
// given the start and end prices of the base asset and quanto asset
// and the size of the position in the base asset.
//
// Calculation assumes PnL from funding is zero.
//
// Unit of the result: $sUSD
export const getQuantoPnl = ({
  baseAssetStartPrice,
  baseAssetEndPrice,
  quantoAssetStartPrice,
  quantoAssetEndPrice,
  baseAssetSizeDelta,
}: GetQuantoPnlArgs): ethers.BigNumber => {
  const baseAssetPriceChange = baseAssetEndPrice.sub(baseAssetStartPrice);
  const quantoMultiplier = quantoAssetEndPrice.mul(ONE_ETHER).div(quantoAssetStartPrice);
  return baseAssetPriceChange
    .mul(baseAssetSizeDelta)
    .mul(quantoMultiplier)
    .div(ONE_ETHER)
    .div(ONE_ETHER);
};

export type getQuantoPnlWithSkew = {
  baseAssetStartPrice: ethers.BigNumber;
  baseAssetSizeDelta: ethers.BigNumber;
  startingSkew: ethers.BigNumber;
  skewScale: ethers.BigNumber;
};

export const getQuantoPnlWithSkew = ({
  baseAssetStartPrice,
  baseAssetSizeDelta,
  startingSkew,
  skewScale,
}: getQuantoPnlWithSkew): ethers.BigNumber => {
  const fillPrice = getQuantoFillPrice({
    skew: startingSkew,
    skewScale: skewScale,
    size: baseAssetSizeDelta,
    price: baseAssetStartPrice,
  });

  return baseAssetStartPrice.sub(fillPrice).mul(baseAssetSizeDelta).div(ONE_ETHER);

  // 💡 invariant assertion:
  // iff the quanto asset is static,
  // then PnL should be a function of only the base asset price impact
};
