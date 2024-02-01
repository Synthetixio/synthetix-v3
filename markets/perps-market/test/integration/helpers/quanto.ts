import { ethers } from 'ethers';

export type GetQuantoPnlArgs = {
  baseAssetStartPrice: ethers.BigNumber;
  baseAssetEndPrice: ethers.BigNumber;
  quantoAssetStartPrice: ethers.BigNumber;
  quantoAssetEndPrice: ethers.BigNumber;
  baseAssetSizeDelta: ethers.BigNumber;
};

const ONE_ETHER = ethers.utils.parseEther('1');

export const getQuantoPnl = ({
  baseAssetStartPrice,
  baseAssetEndPrice,
  quantoAssetStartPrice,
  quantoAssetEndPrice,
  baseAssetSizeDelta,
}: GetQuantoPnlArgs): ethers.BigNumber => {
  const baseAssetPriceChange = baseAssetEndPrice.sub(baseAssetStartPrice);
  const quantoMultiplier = quantoAssetEndPrice.div(quantoAssetStartPrice).mul(ONE_ETHER);
  return baseAssetPriceChange
    .mul(baseAssetSizeDelta)
    .mul(quantoMultiplier)
    .div(ONE_ETHER)
    .div(ONE_ETHER);
};

export type GetQuantoPositionSizeArgs = {
  sizeInBaseAsset: number;
  quantoAssetPrice: number;
};

export const getQuantoPositionSize = ({
  sizeInBaseAsset,
  quantoAssetPrice,
}: GetQuantoPositionSizeArgs): number => {
  return sizeInBaseAsset / quantoAssetPrice;
};
