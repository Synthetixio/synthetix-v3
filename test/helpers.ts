import { BigNumber, Contract, ContractReceipt, ethers, utils, providers } from 'ethers';
import { LogLevel } from '@ethersproject/logger';
import { PerpMarketConfiguration } from './generated/typechain/MarketConfigurationModule';
import { genNumber, raise } from './generators';
import Wei, { wei } from '@synthetixio/wei';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { isNil, uniq } from 'lodash';
import { Bs, Collateral, CommitableOrder, GeneratedTrader, Trader } from './typed';
import { PerpCollateral } from './bootstrap';
import { parseUnits } from 'ethers/lib/utils';

// --- Constants --- //

export const SECONDS_ONE_HR = 60 * 60;
export const SECONDS_ONE_DAY = SECONDS_ONE_HR * 24;
export const SYNTHETIX_USD_MARKET_ID = BigNumber.from(0);
export const BURN_ADDRESS = '0x0000000000000000000000000000000000000000';

// --- Mutative helpers --- //

/** A generalised mint/approve without accepting a generated trader. */
export const mintAndApprove = async (
  { provider, systems }: Bs,
  collateral: Collateral,
  amount: BigNumber,
  to: ethers.Signer
) => {
  const { PerpMarketProxy, SpotMarket } = systems();

  // NOTE: We `.mint` into the `trader.signer` before approving as only owners can mint.
  const synth = collateral.contract;
  const synthOwnerAddress = await synth.owner();

  await provider().send('hardhat_impersonateAccount', [synthOwnerAddress]);
  const synthOwner = provider().getSigner(synthOwnerAddress);
  await provider().send('hardhat_setBalance', [await synthOwner.getAddress(), `0x${(1e22).toString(16)}`]);

  await synth.connect(synthOwner).mint(to.getAddress(), amount);
  await synth.connect(to).approve(PerpMarketProxy.address, amount);
  await synth.connect(to).approve(SpotMarket.address, amount);

  return synth;
};

/** Provision margin for this trader given the full `gTrader` context. */
export const mintAndApproveWithTrader = async (bs: Bs, gTrader: GeneratedTrader) => {
  const { trader, collateral, collateralDepositAmount } = await gTrader;
  await mintAndApprove(bs, collateral, collateralDepositAmount, trader.signer);
  return gTrader;
};

/** Returns a generated trader with collateral and market details. */
export const depositMargin = async (bs: Bs, gTrader: GeneratedTrader) => {
  const { PerpMarketProxy } = bs.systems();

  // Provision collateral and approve for access.
  const { market, trader, collateral, collateralDepositAmount } = await mintAndApproveWithTrader(bs, gTrader);

  // Perform the deposit.
  await PerpMarketProxy.connect(trader.signer).modifyCollateral(
    trader.accountId,
    market.marketId(),
    collateral.synthMarketId(),
    collateralDepositAmount
  );

  return gTrader;
};

/** Generic update on market specific params. */
export const setMarketConfigurationById = async (
  { systems, owner }: Bs,
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
  { systems, owner }: Bs,
  params: Partial<PerpMarketConfiguration.GlobalDataStruct>
) => {
  const { PerpMarketProxy } = systems();
  const data = await PerpMarketProxy.getMarketConfiguration();
  await PerpMarketProxy.connect(owner()).setMarketConfiguration({ ...data, ...params });
  return PerpMarketProxy.getMarketConfiguration();
};

/** Returns a Pyth updateData blob and the update fee in wei. */
export const getPythPriceData = async (
  { systems }: Bs,
  marketId: BigNumber,
  publishTime?: number,
  price?: number,
  priceExpo = 6,
  priceConfidence = 1
) => {
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
    publishTime ?? Math.floor(Date.now() / 1000),
    0
  );
  const updateFee = await PythMock.getUpdateFee([updateData]);
  return { updateData, updateFee };
};

/** Returns a reasonable timestamp and publishTime to fast forward to for settlements. */
export const getFastForwardTimestamp = async ({ systems, provider }: Bs, marketId: BigNumber, trader: Trader) => {
  const { PerpMarketProxy } = systems();

  const order = await PerpMarketProxy.getOrderDigest(trader.accountId, marketId);
  const commitmentTime = order.commitmentTime.toNumber();
  const config = await PerpMarketProxy.getMarketConfiguration();
  const minOrderAge = config.minOrderAge.toNumber();
  const pythPublishTimeMin = config.pythPublishTimeMin.toNumber();
  const pythPublishTimeMax = config.pythPublishTimeMax.toNumber();

  // PublishTime is allowed to be between settlement - [0, maxAge - minAge]. For example, `[0, 12 - 8] = [0, 4]`.
  const publishTimeDelta = genNumber(0, pythPublishTimeMax - pythPublishTimeMin);

  // Ensure the settlementTime (and hence publishTime) cannot be lte the current block.timestamp.
  const nowTime = (await provider().getBlock('latest')).timestamp;
  const settlementTime = Math.max(commitmentTime + minOrderAge, nowTime + 1);

  const publishTime = settlementTime - publishTimeDelta;
  const expireTime = commitmentTime + config.maxOrderAge.toNumber();
  return { commitmentTime, settlementTime, publishTime, expireTime };
};

/** Commits a generated `order` for `trader` on `marketId` */
export const commitOrder = async (
  { systems }: Bs,
  marketId: BigNumber,
  trader: Trader,
  order: CommitableOrder | Promise<CommitableOrder>
) => {
  const { PerpMarketProxy } = systems();

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
  bs: Bs,
  marketId: BigNumber,
  trader: Trader,
  order: CommitableOrder | Promise<CommitableOrder>,
  options?: { desiredKeeper?: ethers.Signer }
) => {
  const { systems, provider, keeper } = bs;
  const { PerpMarketProxy } = systems();

  await commitOrder(bs, marketId, trader, order);

  const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
  await fastForwardTo(settlementTime, provider());

  const { updateData, updateFee } = await getPythPriceData(bs, marketId, publishTime);
  const settlementKeeper = options?.desiredKeeper ?? keeper();

  const { tx, receipt } = await withExplicitEvmMine(
    () =>
      PerpMarketProxy.connect(settlementKeeper).settleOrder(trader.accountId, marketId, updateData, {
        value: updateFee,
      }),
    provider()
  );
  const lastBaseFeePerGas = (await provider().getFeeData()).lastBaseFeePerGas as BigNumber;

  return { tx, receipt, settlementTime, publishTime, lastBaseFeePerGas };
};

// This is still quite buggy in anvil so use with care...
export const setBaseFeePerGas = async (amountInGwei: number, provider: providers.JsonRpcProvider) => {
  await provider.send('hardhat_setNextBlockBaseFeePerGas', [(amountInGwei * 1e9).toString(16)]);
  return parseUnits(`${amountInGwei}`, 'gwei');
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
export const getBlockTimestamp = async (provider: ethers.providers.JsonRpcProvider) =>
  (await provider.getBlock('latest')).timestamp;

/** Fastforward block.timestamp by `seconds` (Replacement for `evm_increaseTime`, using `evm_setNextBlockTimestamp` instead). */
export const fastForwardBySec = async (provider: ethers.providers.JsonRpcProvider, seconds: number) =>
  await fastForwardTo((await getBlockTimestamp(provider)) + seconds, provider);

/** Search for events in `receipt.logs` in a non-throw (safe) way. */
export const findEventSafe = (receipt: ContractReceipt, eventName: string, contract: Contract) => {
  const logDescription = receipt.logs
    .map((log) => {
      try {
        return contract.interface.parseLog(log);
      } catch (err) {
        return undefined;
      }
    })
    .find((parsedEvent) => parsedEvent?.name === eventName);

  return logDescription ? logDescription : raise(`Cannot find '${eventName}' in logs`);
};

/**
 * Disables autoMine, perform tx, explict mine, wait, enable autoMine, return.
 *
 * Why?
 *
 * `tx.wait()` can occasionally cause tests to hang. We believe this is due to async issues with autoMine. By
 * default anvil auto mines a block on every transaction. However, depending on the sun/moon and frequently of
 * a butterfly's flapping wing, it can result in the .wait() to hang because the block is produced before the
 * wait recognising the block (?).
 *
 * This completely avoids that by disabling the autoMine and performing an explicit mine then reenabling after.
 */
export const withExplicitEvmMine = async (
  f: () => Promise<ethers.ContractTransaction>,
  provider: ethers.providers.JsonRpcProvider
) => {
  await provider.send('evm_setAutomine', [false]);

  const tx = await f();
  await provider.send('evm_mine', []);

  const receipt = await tx.wait();
  await provider.send('evm_setAutomine', [true]);

  return { tx, receipt };
};

export const getSusdCollateral = (collaterals: PerpCollateral[]) => {
  const sUsdCollateral = collaterals.filter((c) => c.synthMarketId() === SYNTHETIX_USD_MARKET_ID)[0];
  return !sUsdCollateral
    ? raise('sUSD collateral not found. Did you mistakenly use collatealsWithoutSusd()?')
    : sUsdCollateral;
};

export const isSusdCollateral = (collateral: PerpCollateral) => collateral.synthMarketId() === SYNTHETIX_USD_MARKET_ID;

export const findOrThrow = <A>(l: A[], p: (a: A) => boolean) => {
  const found = l.find(p);
  return found ? found : raise('Cannot find in l');
};

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(() => resolve(), ms));

export const logNumber = (label = '', x: BigNumber | Wei) => {
  console.log(label, `: ${wei(x).toNumber()}`);
};
