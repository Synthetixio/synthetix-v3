import { BigNumber, Contract, ContractReceipt, ethers, utils } from 'ethers';
import { LogLevel } from '@ethersproject/logger';
import { PerpMarketConfiguration } from './generated/typechain/MarketConfigurationModule';
import type { bootstrap } from './bootstrap';
import { type genTrader, type genOrder, genNumber } from './generators';
import { wei } from '@synthetixio/wei';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { isNil, uniq } from 'lodash';

// --- Constants --- //

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const SECONDS_ONE_HR = 60 * 60;
export const SECONDS_ONE_DAY = SECONDS_ONE_HR * 24;

// --- Mutative helpers --- //

type Bs = ReturnType<typeof bootstrap>;
type GeneratedTrader = ReturnType<typeof genTrader> | Awaited<ReturnType<typeof genTrader>>;
type CommitableOrder = Pick<Awaited<ReturnType<typeof genOrder>>, 'sizeDelta' | 'limitPrice' | 'keeperFeeBufferUsd'>;

/** Provision margin for this trader given the full `gTrader` context. */
export const approveAndMintMargin = async (bs: Bs, gTrader: GeneratedTrader) => {
  const { trader, collateral, collateralDepositAmount } = await gTrader;
  const { PerpMarketProxy } = bs.systems();

  const collateralConnected = collateral.contract.connect(trader.signer);
  await collateralConnected.mint(trader.signer.getAddress(), collateralDepositAmount);
  await collateralConnected.approve(PerpMarketProxy.address, collateralDepositAmount);

  return gTrader;
};

/** Returns a generated trader with collateral and market details. */
export const depositMargin = async (bs: Bs, gTrader: GeneratedTrader) => {
  const { PerpMarketProxy } = bs.systems();

  // Provision collateral and approve for access.
  const { market, trader, collateral, collateralDepositAmount } = await approveAndMintMargin(bs, gTrader);

  // Perform the deposit.
  await PerpMarketProxy.connect(trader.signer).modifyCollateral(
    trader.accountId,
    market.marketId(),
    collateral.contract.address,
    collateralDepositAmount
  );

  return gTrader;
};

/** Generic update on market specific params. */
export const setMarketConfigurationById = async (
  { systems, owner }: ReturnType<typeof bootstrap>,
  marketId: BigNumber,
  params: Partial<PerpMarketConfiguration.DataStruct>
) => {
  const { PerpMarketProxy } = systems();
  const data = await PerpMarketProxy.getMarketConfigurationById(marketId);
  await PerpMarketProxy.connect(owner()).setMarketConfigurationById(marketId, { ...data, ...params });
  return PerpMarketProxy.getMarketConfigurationById(marketId);
};

/** Generic update on global market data (similar to setMarketConfigurationById). */
export const setMarketConfiguration = async (
  { systems, owner }: ReturnType<typeof bootstrap>,
  params: Partial<PerpMarketConfiguration.GlobalDataStruct>
) => {
  const { PerpMarketProxy } = systems();
  const data = await PerpMarketProxy.getMarketConfiguration();
  await PerpMarketProxy.connect(owner()).setMarketConfiguration({ ...data, ...params });
  return PerpMarketProxy.getMarketConfiguration();
};

/** Returns a Pyth updateData blob and the update fee in wei. */
export const getPythPriceData = async (
  bs: ReturnType<typeof bootstrap>,
  marketId: BigNumber,
  publishTime?: number,
  price?: number,
  priceExpo = 6,
  priceConfidence = 1
) => {
  const { systems } = bs;
  const { PythMock, PerpMarketProxy } = systems();

  // Default price to the current market oraclePrice.
  if (isNil(price)) {
    price = wei(await PerpMarketProxy.getOraclePrice(marketId)).toNumber();
  }

  const pythPrice = wei(price, priceExpo).toBN();
  const config = await PerpMarketProxy.getMarketConfigurationById(marketId);
  const updateData = await PythMock.createPriceFeedUpdateData(
    config.pythPriceFeedId,
    pythPrice,
    priceConfidence,
    -priceExpo,
    pythPrice,
    priceConfidence,
    publishTime ?? Math.floor(Date.now() / 1000)
  );
  const updateFee = await PythMock.getUpdateFee([updateData]);
  return { updateData, updateFee };
};

/** Returns a reasonable timestamp and publishTime to fast forward to for settlements. */
export const getFastForwardTimestamp = async (
  bs: ReturnType<typeof bootstrap>,
  marketId: BigNumber,
  trader: ReturnType<Bs['traders']>[number]
) => {
  const { PerpMarketProxy } = bs.systems();

  const order = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
  const commitmentTime = order.commitmentTime.toNumber();
  const config = await PerpMarketProxy.getMarketConfiguration();
  const minOrderAge = config.minOrderAge.toNumber();
  const pythPublishTimeMin = config.pythPublishTimeMin.toNumber();
  const pythPublishTimeMax = config.pythPublishTimeMax.toNumber();

  // PublishTime is allowed to be between settlement - [0, maxAge - minAge]. For example, `[0, 12 - 8] = [0, 4]`.
  const publishTimeDelta = genNumber(0, pythPublishTimeMax - pythPublishTimeMin);
  const settlementTime = commitmentTime + minOrderAge;
  const publishTime = settlementTime - publishTimeDelta;

  return { commitmentTime, settlementTime, publishTime };
};

/** Commits a generated `order` for `trader` on `marketId` */
export const commitOrder = async (
  bs: ReturnType<typeof bootstrap>,
  marketId: BigNumber,
  trader: ReturnType<Bs['traders']>[number],
  order: CommitableOrder | Promise<CommitableOrder>,
  blockBaseFeePerGas?: number
) => {
  const { PerpMarketProxy } = bs.systems();

  if (blockBaseFeePerGas) {
    await bs.provider().send('hardhat_setNextBlockBaseFeePerGas', [blockBaseFeePerGas]);
  }

  const { sizeDelta, limitPrice, keeperFeeBufferUsd } = await order;
  await PerpMarketProxy.connect(trader.signer).commitOrder(
    trader.accountId,
    marketId,
    sizeDelta,
    limitPrice,
    keeperFeeBufferUsd
  );
};

/** Commits a generated `order` for `trader` on `marketId` and settles successfully. */
export const commitAndSettle = async (
  bs: ReturnType<typeof bootstrap>,
  marketId: BigNumber,
  trader: ReturnType<Bs['traders']>[number],
  order: CommitableOrder | Promise<CommitableOrder>,
  blockBaseFeePerGas?: number
) => {
  const { systems, provider, keeper } = bs;
  const { PerpMarketProxy } = systems();

  await commitOrder(bs, marketId, trader, order, blockBaseFeePerGas);

  const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
  await fastForwardTo(settlementTime, provider());

  const { updateData, updateFee } = await getPythPriceData(bs, marketId, publishTime);

  if (blockBaseFeePerGas) {
    await bs.provider().send('hardhat_setNextBlockBaseFeePerGas', [blockBaseFeePerGas]);
  }

  const tx = await PerpMarketProxy.connect(keeper()).settleOrder(trader.accountId, marketId, [updateData], {
    value: updateFee,
  });

  return { tx, settlementTime, publishTime };
};

/** Updates the provided `contract` with more ABI details. */
export const extendContractAbi = (contract: Contract, abi: string[]) => {
  utils.Logger.setLogLevel(LogLevel.OFF); // Silence ethers duplicated event warnings
  const contractAbi = contract.interface.format(utils.FormatTypes.full) as string[];
  const newContract = new Contract(
    contract.address,
    uniq(contractAbi.concat(abi)),
    contract.provider || contract.signer
  );
  utils.Logger.setLogLevel(LogLevel.WARNING); // enable default logging again
  return newContract;
};

/** Returns the latest block's timestamp. */
export const getBlockTimestamp = async (provider: ReturnType<Bs['provider']>) =>
  (await provider.getBlock('latest')).timestamp;

/** Fastforward block.timestamp by `seconds` (Replacement for `evm_increaseTime`, using `evm_setNextBlockTimestamp` instead). */
export const fastForwardBySec = async (provider: ReturnType<Bs['provider']>, seconds: number) =>
  await fastForwardTo((await getBlockTimestamp(provider)) + seconds, provider);

/** Search for events in `receipt.logs` in a non-throw (safe) way. */
export const findEventSafe = ({
  receipt,
  eventName,
  contract,
}: {
  receipt: ContractReceipt;
  eventName: string;
  contract: Contract;
}) => {
  return receipt.logs
    .map((log) => {
      try {
        return contract.interface.parseLog(log);
      } catch (err) {
        return undefined;
      }
    })
    .find((parsedEvent) => parsedEvent?.name === eventName);
};

/** Performs a tx.wait() against the supplied `tx` with an evm_mine called without an `await. */
export const txWait = async (tx: ethers.ContractTransaction, provider: ethers.providers.JsonRpcProvider) => {
  // By calling evm_mine without an `await` before tx.wait(), we think we might result in fixing scenarios
  // where tx.wait() hangs. We think it hangs due to blocks not being created (as by defaul blocks are created)
  // for every transaction. There _may_ be a timing issue where a tx.wait() occurs _before_ the tx is accepted.
  provider.send('evm_mine', []);
  return await tx.wait();
};
