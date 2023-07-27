import { bootstrap } from './bootstrap';
import { bn, genInt, shuffle } from './generators';

export const depositMargin = async (bs: ReturnType<typeof bootstrap>) => {
  const { systems, traders, markets, collaterals } = bs;

  const { PerpMarketProxy } = systems();

  // Preamble.
  const trader = traders()[0];
  const traderAddress = await trader.signer.getAddress();
  const market = shuffle(markets())[0];
  const marketId = market.marketId();
  const collateral = shuffle(collaterals())[0].contract.connect(trader.signer);

  const amountDelta = bn(genInt(500, 1000));
  await collateral.mint(trader.signer.getAddress(), amountDelta);
  await collateral.approve(PerpMarketProxy.address, amountDelta);

  // Perform the deposit.
  const tx = await PerpMarketProxy.connect(trader.signer).transferTo(
    trader.accountId,
    marketId,
    collateral.address,
    amountDelta
  );
  await tx.wait();

  return { trader, traderAddress, market, marketId, depositAmountDelta: amountDelta, collateral };
};
