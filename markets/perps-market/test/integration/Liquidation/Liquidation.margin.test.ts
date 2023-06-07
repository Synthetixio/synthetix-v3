// import { ethers } from 'ethers';
// import { bn, bootstrapMarkets } from '../bootstrap';

// describe('Liquidation - margin', async () => {
//   const { synthMarkets, perpsMarkets } = bootstrapMarkets({
//     synthMarkets: [
//       {
//         name: 'Bitcoin',
//         token: 'snxBTC',
//         buyPrice: bn(10_000),
//         sellPrice: bn(10_000),
//       },
//     ],
//     perpsMarkets: [
//       {
//         name: 'Ether',
//         token: 'snxETH',
//         price: bn(1000),
//         fundingParams: { skewScale: bn(100_000), maxFundingVelocity: bn(0) },
//         liquidationParams: {
//           initialMarginFraction: bn(0.02),
//           maintenanceMarginFraction: bn(0.01),
//           maxLiquidationLimitAccumulationMultiplier: bn(1),
//           liquidationRewardRatio: bn(0.05),
//         },
//       },
//     ],
//     traderAccountIds: [2, 3],
//   });

//   let ethMarketId: ethers.BigNumber, btcSynthId: ethers.BigNumber;
//   before('identify actors', async () => {
//     ethMarketId = perpsMarkets()[0].marketId();
//     btcSynthId = synthMarkets()[0].marketId();
//   });

//   // TODO
// });
