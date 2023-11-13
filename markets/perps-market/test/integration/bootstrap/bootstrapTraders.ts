import { bootstrapStakers } from '@synthetixio/main/test/common';
import { Systems, bn } from './bootstrap';
import { ethers } from 'ethers';

type Data = {
  systems: () => Systems;
  signers: () => ethers.Signer[];
  owner: () => ethers.Signer;
  accountIds: Array<number>;
};
/*
  creates two traders with the specified account ids.
  a potential enhancement is maybe to allow x # of traders but i don't expect more than 2 traders
  needed for testing
*/
export function bootstrapTraders(data: Data) {
  const { systems, signers, accountIds, owner } = data;
  bootstrapStakers(systems, signers, bn(100_000));

  let trader1: ethers.Signer, trader2: ethers.Signer, trader3: ethers.Signer, keeper: ethers.Signer;

  before('provide access to create account', async () => {
    [, , , trader1, trader2, trader3, keeper] = signers();
    await systems()
      .PerpsMarket.connect(owner())
      .addToFeatureFlagAllowlist(
        ethers.utils.formatBytes32String('createAccount'),
        await trader1.getAddress()
      );
    await systems()
      .PerpsMarket.connect(owner())
      .addToFeatureFlagAllowlist(
        ethers.utils.formatBytes32String('createAccount'),
        await trader2.getAddress()
      );
    await systems()
      .PerpsMarket.connect(owner())
      .addToFeatureFlagAllowlist(
        ethers.utils.formatBytes32String('createAccount'),
        await trader3.getAddress()
      );
  });

  before('infinite approve to perps/spot market proxy', async () => {
    [, , , trader1, trader2, trader3] = signers();
    await systems()
      .USD.connect(trader1)
      .approve(systems().PerpsMarket.address, ethers.constants.MaxUint256);
    await systems()
      .USD.connect(trader1)
      .approve(systems().SpotMarket.address, ethers.constants.MaxUint256);
    await systems()
      .USD.connect(trader2)
      .approve(systems().PerpsMarket.address, ethers.constants.MaxUint256);
    await systems()
      .USD.connect(trader2)
      .approve(systems().SpotMarket.address, ethers.constants.MaxUint256);
    await systems()
      .USD.connect(trader3)
      .approve(systems().PerpsMarket.address, ethers.constants.MaxUint256);
    await systems()
      .USD.connect(trader3)
      .approve(systems().SpotMarket.address, ethers.constants.MaxUint256);
  });

  accountIds.forEach((id, idx) => {
    before(`create account ${id}`, async () => {
      await systems()
        .PerpsMarket.connect([trader1, trader2, trader3][idx])
        ['createAccount(uint128)'](id); // eslint-disable-line no-unexpected-multiline
    });
  });

  return {
    trader1: () => trader1,
    trader2: () => trader2,
    trader3: () => trader3,
    keeper: () => keeper,
  };
}
