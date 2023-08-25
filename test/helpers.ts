import { BigNumber, Contract, ContractReceipt, ContractTransaction, utils } from 'ethers';
import { LogLevel } from '@ethersproject/logger';
import { PerpMarketConfiguration } from './generated/typechain/MarketConfigurationModule';
import type { bootstrap } from './bootstrap';
import { type genTrader, type genOrder, genNumber } from './generators';
import { wei } from '@synthetixio/wei';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { isNil, uniq } from 'lodash';
import assert from 'assert';

// --- Constants --- //

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// --- Mutative helpers --- //

type Bs = ReturnType<typeof bootstrap>;
type GeneratedTrader = ReturnType<typeof genTrader> | Awaited<ReturnType<typeof genTrader>>;
type GeneratedOrder = ReturnType<typeof genOrder> | Awaited<ReturnType<typeof genOrder>>;

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
  { sizeDelta, limitPrice, keeperFeeBufferUsd }: Awaited<ReturnType<typeof genOrder>>
) => {
  const { PerpMarketProxy } = bs.systems();
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
  order: GeneratedOrder
) => {
  const { PerpMarketProxy } = bs.systems();

  await commitOrder(bs, marketId, trader, await order);

  const { settlementTime, publishTime } = await getFastForwardTimestamp(bs, marketId, trader);
  await fastForwardTo(settlementTime, bs.provider());

  const { updateData, updateFee } = await getPythPriceData(bs, marketId, publishTime);
  return PerpMarketProxy.connect(bs.keeper()).settleOrder(trader.accountId, marketId, [updateData], {
    value: updateFee,
  });
};

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

const formatDecodedArgs = (value: any): string => {
  // print nested values as [value1, value2, ...]
  if (Array.isArray(value)) {
    return `[${value.map((v) => formatDecodedArgs(v)).join(', ')}]`;
  }

  // surround string values with quotes
  if (typeof value === 'string') {
    return `"${value}"`;
  }

  return value.toString();
};
export const assertEvents = async (
  tx: ContractTransaction | ContractReceipt,
  expected: (string | RegExp)[],
  contract: Contract
) => {
  const receipt = 'wait' in tx ? await tx.wait() : tx;
  const spaces = ' '.repeat(6); // to align with assert output

  const { logs } = receipt;
  if (logs.length !== expected.length) {
    throw new Error(`Expected ${expected.length} events, got ${logs.length}`);
  }
  let seenEvents: string[] = [];
  const parsedLogs = logs.map((log, i) => {
    try {
      const parsed = contract.interface.parseLog(log);
      const event = `${parsed.name}(${parsed.args ? formatDecodedArgs(parsed.args) : ''})`;
      seenEvents.push(event);
      return event;
    } catch (error) {
      throw new Error(
        `Failed to parse log at index: ${i} \n${spaces}List of parsed events:\n${spaces}${seenEvents.join(
          `\n${spaces}`
        )} \n${spaces}Ethers error: ${(error as any).message}`
      );
    }
  });
  parsedLogs.forEach((event, i) => {
    const expectedAtIndex = expected[i];
    if (typeof expectedAtIndex === 'string' ? event === expectedAtIndex : event.match(expectedAtIndex)) {
      return;
    } else {
      const allEvents = parsedLogs.join(`\n${spaces}`);

      typeof expectedAtIndex === 'string'
        ? assert.strictEqual(
            event,
            expectedAtIndex,
            `Event at index ${i} did not match. \n${spaces}List of parsed events:\n${spaces}${allEvents}`
          )
        : assert.match(event, expectedAtIndex);
    }
  });
};
