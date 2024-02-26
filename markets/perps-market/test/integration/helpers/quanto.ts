import { ethers } from 'ethers';

export const ONE_ETHER = ethers.utils.parseEther('1');

export interface GetQuantoPositionSizeArgs {
  sizeInBaseAsset: ethers.BigNumber;
  quantoAssetPrice: ethers.BigNumber;
}

/**
 * Calculates the size of a quanto position in
 * terms of the quanto asset.
 * Confirmed no precision loss.
 * Unit of the result: ($BASE * $QUANTO) / $sUSD
 */
export const getQuantoPositionSize = ({
  sizeInBaseAsset,
  quantoAssetPrice,
}: GetQuantoPositionSizeArgs): ethers.BigNumber =>
  sizeInBaseAsset.mul(ONE_ETHER).div(quantoAssetPrice);

export interface GetQuantoFillPriceArgs {
  skew: ethers.BigNumber;
  skewScale: ethers.BigNumber;
  size: ethers.BigNumber;
  price: ethers.BigNumber;
}

/**
 * Calculates the fill price of a quanto position
 * taking into account the skew and skewScale.
 * Confirmed no precision loss.
 * Unit of the result: $sUSD
 */
export const getQuantoFillPrice = ({
  skew,
  skewScale,
  size,
  price,
}: GetQuantoFillPriceArgs): ethers.BigNumber => {
  if (skewScale.eq(0)) return price;
  const pdBefore = skew.mul(ONE_ETHER).div(skewScale);
  const newSkew = skew.add(size);
  const pdAfter = newSkew.mul(ONE_ETHER).div(skewScale);
  const priceBefore = price.add(price.mul(pdBefore).div(ONE_ETHER));
  const priceAfter = price.add(price.mul(pdAfter).div(ONE_ETHER));
  return priceBefore.add(priceAfter).div(2);
};

export interface GetQuantoPnlArgs {
  baseAssetStartPrice: ethers.BigNumber;
  baseAssetEndPrice: ethers.BigNumber;
  quantoAssetStartPrice: ethers.BigNumber;
  quantoAssetEndPrice: ethers.BigNumber;
  quantoSizeDelta: ethers.BigNumber;
};

export const ONE_ETHER = ethers.utils.parseEther('1');

/**
 * Calculates the PnL of a quanto position given the start
 * and end prices of the base and quanto asset,
 * and the size of the position in the base asset.
 * Assumes PnL from funding is zero.
 * Confirmed no precision loss.
 * Unit of the result: $sUSD
 */
export const getQuantoPnl = ({
  baseAssetStartPrice,
  baseAssetEndPrice,
  quantoAssetStartPrice,
  quantoAssetEndPrice,
  quantoSizeDelta,
}: GetQuantoPnlArgs): ethers.BigNumber => {
  const baseAssetPriceChange = baseAssetEndPrice.sub(baseAssetStartPrice);
  const quantoMultiplier = quantoAssetEndPrice.mul(ONE_ETHER).div(quantoAssetStartPrice);
  return baseAssetPriceChange.mul(quantoSizeDelta).mul(quantoMultiplier).div(ONE_ETHER.pow(2));
};
