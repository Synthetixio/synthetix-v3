import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { formatErrorMessage } from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { BytesLike, ethers } from 'ethers';
import hre from 'hardhat';
import { bn, bootstrapTraders, bootstrapWithSynth } from '../test/bootstrap';
import fetch from 'node-fetch';

const feedId = '0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6';
const feedAddress = '0xff1a0f4744e8582DF1aE09D5611b887B6a12925C';

const pythSettlementStrategy = {
  strategyType: 2,
  settlementDelay: 0,
  settlementWindowDuration: 1200,
  priceVerificationContract: feedAddress,
  feedId,
  url: 'https://xc-testnet.pyth.network/api/get_vaa_ccip?data={data}',
  settlementReward: bn(5),
  disabled: false,
  minimumUsdExchangeAmount: bn(0.000001),
  maxRoundingLoss: bn(0.000001),
};

describe('AsyncOrdersModule.e2e.test', function () {
  const { systems, signers, marketId, provider } = bootstrapTraders(
    bootstrapWithSynth('Synthetic Ether', 'snxETH')
  );

  let marketOwner: ethers.Signer,
    verifier: ethers.Contract,
    trader1: ethers.Signer,
    keeper: ethers.Signer,
    startTime: number,
    strategyId: number;

  before('identify', async () => {
    [, , marketOwner, trader1, , keeper] = signers();
    verifier = await hre.ethers.getContractAt('IPythVerifier', feedAddress);
  });

  before('add settlement strategy', async () => {
    strategyId = (
      await systems()
        .SpotMarket.connect(marketOwner)
        .callStatic.addSettlementStrategy(marketId(), pythSettlementStrategy)
    ).toNumber();
    await systems()
      .SpotMarket.connect(marketOwner)
      .addSettlementStrategy(marketId(), pythSettlementStrategy);
  });

  before('setup fixed fee', async () => {
    await systems().SpotMarket.connect(marketOwner).setAsyncFixedFee(marketId(), bn(0.01));
  });

  describe('commit order', () => {
    let commitTxn: ethers.providers.TransactionResponse;
    before('commit', async () => {
      await systems().USD.connect(trader1).approve(systems().SpotMarket.address, bn(1000));
      commitTxn = await systems()
        .SpotMarket.connect(trader1)
        .commitOrder(marketId(), 2, bn(1000), strategyId, bn(0), ethers.constants.AddressZero);
      startTime = await getTime(provider());
    });

    it('emits event', async () => {
      await assertEvent(
        commitTxn,
        `OrderCommitted(${marketId()}, 2, ${bn(1000)}, 1, "${await trader1.getAddress()}"`,
        systems().SpotMarket
      );
    });
  });

  describe('settle order', () => {
    let url: string, data: string, extraData: string;

    before('fast forward to settlement time', async () => {
      await fastForwardTo(startTime + 1, provider());
    });

    it('settle pyth order', async () => {
      try {
        const tx = await systems().SpotMarket.connect(keeper).settleOrder(marketId(), 1);
        await tx.wait(); // txReceipt.
      } catch (err) {
        const parseString = (str: string) => str.trim().replace('"', '').replace('"', '');
        const parsedError = formatErrorMessage(err)
          .replace('OffchainLookup(', '')
          .replace(')', '')
          .split(',');
        url = parseString(parsedError[1]);
        data = parseString(parsedError[2]);
        extraData = parseString(parsedError[4].split('\n')[0]);

        console.log({
          url,
          data,
          extraData,
        });
      }

      const parsedURL = url.replace('{data}', data);

      //There is a delay on pyth service
      await new Promise((resolve) => setTimeout(resolve, 30000));

      const response = await fetch(parsedURL).then((res) => res.json());
      const fee = await verifier.getUpdateFee([response]);
      await systems()
        .SpotMarket.connect(keeper)
        .settlePythOrder(response.data as BytesLike, extraData, {
          value: fee.toString(),
        });
    });
  });
});
