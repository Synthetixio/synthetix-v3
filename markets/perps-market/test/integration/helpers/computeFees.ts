import { ethers } from 'ethers';
import { DEFAULT_SETTLEMENT_STRATEGY } from '../bootstrap';
import Wei, { wei } from '@synthetixio/wei';

type OrderFees = {
  makerFee: Wei;
  takerFee: Wei;
};

export type Fees = {
  totalFees: ethers.BigNumber;
  keeperFee: ethers.BigNumber;
  perpsMarketFee: ethers.BigNumber;
};

export const computeFees: (
  sizeBefore: Wei,
  sizeDelta: Wei,
  price: Wei,
  orderFees: OrderFees
) => Fees = (sizeBefore, sizeDelta, price, orderFees) => {
  let makerSize = wei(0),
    takerSize = wei(0);

  if (sizeDelta.eq(0)) {
    // no change in fees
  } else if (sizeBefore.eq(0) || sizeBefore.mul(sizeDelta).gt(0)) {
    // same side. taker
    takerSize = sizeDelta.abs();
  } else {
    makerSize = sizeBefore.abs() > sizeDelta.abs() ? sizeDelta.abs() : sizeBefore.abs();
    takerSize = sizeBefore.abs() < sizeDelta.abs() ? sizeDelta.abs().sub(sizeBefore.abs()) : wei(0);
  }

  const notionalTaker = wei(takerSize).mul(wei(price));
  const notionalMaker = wei(makerSize).mul(price);

  const perpsMarketFee = notionalMaker
    .mul(orderFees.makerFee)
    .add(notionalTaker.mul(orderFees.takerFee));

  const keeperFee = DEFAULT_SETTLEMENT_STRATEGY.settlementReward;

  return {
    totalFees: perpsMarketFee.add(keeperFee).toBN(),
    perpsMarketFee: perpsMarketFee.toBN(),
    keeperFee,
  };
};
