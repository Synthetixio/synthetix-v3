import { bootstrapStakers } from '@synthetixio/main/test/integration';
import { Systems } from './bootstrap';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { ethers } from 'ethers';

type Data = {
  systems: () => Systems;
  signers: () => ethers.Signer[];
  provider: () => ethers.providers.JsonRpcProvider;
  accountIds: Array<number>;
};
/*
  creates two traders with the specified account ids.
  a potential enhancement is maybe to allow x # of traders but i don't expect more than 2 traders
  needed for testing
*/
export function bootstrapTraders(data: Data) {
  const { systems, signers, provider, accountIds } = data;
  bootstrapStakers(systems, signers);

  let trader1: ethers.Signer, trader2: ethers.Signer;

  before('provide access to create account', async () => {
    const [owner, , , trader1, trader2] = signers();
    await systems()
      .PerpsMarket.connect(owner)
      .addToFeatureFlagAllowlist(
        ethers.utils.formatBytes32String('createAccount'),
        trader1.getAddress()
      );
    await systems()
      .PerpsMarket.connect(owner)
      .addToFeatureFlagAllowlist(
        ethers.utils.formatBytes32String('createAccount'),
        trader2.getAddress()
      );
  });

  before('infinite approve to perps market proxy', async () => {
    const [, , , trader1, trader2] = signers();
    await systems()
      .USD.connect(trader1)
      .approve(systems().PerpsMarket.address, ethers.constants.MaxUint256);
    await systems()
      .USD.connect(trader2)
      .approve(systems().PerpsMarket.address, ethers.constants.MaxUint256);
  });

  accountIds.forEach((id, idx) => {
    before(`create account ${id}`, async () => {
      await systems().PerpsMarket.connect([trader1, trader2][idx])['createAccount(uint128)'](id);
    });
  });

  const restore = snapshotCheckpoint(provider);

  return {
    trader1: () => trader1,
    trader2: () => trader2,
    restore,
  };
}
