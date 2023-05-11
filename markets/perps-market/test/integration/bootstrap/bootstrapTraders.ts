import { bootstrapStakers } from '@synthetixio/main/test/integration';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { bootstrapPerpsMarkets } from './bootstrapPerpsMarkets';
import { ethers } from 'ethers';

export function bootstrapTraders(r: ReturnType<typeof bootstrapPerpsMarkets>) {
  bootstrapStakers(r.systems, r.signers);

  let trader1: ethers.Signer, trader2: ethers.Signer;

  before('provide access to create account', async () => {
    const [owner, , , trader1, trader2] = r.signers();
    await r
      .systems()
      .PerpsMarket.connect(owner)
      .addToFeatureFlagAllowlist(
        ethers.utils.formatBytes32String('createAccount'),
        trader1.getAddress()
      );
    await r
      .systems()
      .PerpsMarket.connect(owner)
      .addToFeatureFlagAllowlist(
        ethers.utils.formatBytes32String('createAccount'),
        trader2.getAddress()
      );
  });

  before('infinite approve to perps market proxy', async () => {
    const [, , , trader1, trader2] = r.signers();
    await r
      .systems()
      .USD.connect(trader1)
      .approve(r.systems().PerpsMarket.address, ethers.constants.MaxUint256);
    await r
      .systems()
      .USD.connect(trader2)
      .approve(r.systems().PerpsMarket.address, ethers.constants.MaxUint256);
  });

  const restore = snapshotCheckpoint(r.provider);

  return {
    ...r,
    trader1: () => trader1,
    trader2: () => trader2,
    restore,
  };
}
