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
  const quantoMultiplier = quantoAssetEndPrice.mul(ONE_ETHER).div(quantoAssetStartPrice);
  return baseAssetPriceChange
    .mul(baseAssetSizeDelta)
    .mul(quantoMultiplier)
    .div(ONE_ETHER)
    .div(ONE_ETHER);
};

export type GetQuantoPositionSizeArgs = {
  sizeInBaseAsset: ethers.BigNumber;
  quantoAssetPrice: ethers.BigNumber;
};

export const getQuantoPositionSize = ({
  sizeInBaseAsset,
  quantoAssetPrice,
}: GetQuantoPositionSizeArgs): ethers.BigNumber => {
  return sizeInBaseAsset.mul(ONE_ETHER).div(quantoAssetPrice);
};
