import { ethers } from 'ethers';
import hre from 'hardhat';
import { LegacyMarket__factory } from '../../typechain-types';
import { LegacyMarket } from '../../typechain-types/contracts/LegacyMarket';
import { wei } from '@synthetixio/wei';
import { snapshotCheckpoint } from '../utils';
import { fastForward } from '@synthetixio/core-utils/utils/hardhat/rpc';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

async function getImpersonatedSigner(
  provider: ethers.providers.JsonRpcProvider,
  addr: string
): Promise<ethers.Signer> {
  await provider.send('hardhat_impersonateAccount', [addr]);

  return provider.getSigner(addr);
}

async function doForkDeploy() {
  return await hre.run('cannon:deploy', {
    dryRun: true,
    impersonate: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    fundSigners: true,
  });
}

describe('LegacyMarket (iosiro)', function () {
  this.timeout(360000);
  let owner: ethers.Signer;
  let setupAccount: ethers.Signer;
  let attacker: ethers.Signer;
  let whaleAccount: ethers.Signer;

  let market: LegacyMarket;

  let addressResolver: ethers.Contract;
  let snxV2: ethers.Contract;
  let susdToken: ethers.Contract;

  let v3System: ethers.Contract;
  let v3Usd: ethers.Contract;

  let cannonProvider: ethers.providers.JsonRpcProvider;

  //
  // v2 deploy script: https://github.com/Synthetixio/synthetix/blob/develop/cannonfile.toml
  //

  before('deploy', async () => {
    const { provider, signers, outputs } =
      hre.network.name === 'cannon' ? await hre.run('cannon:build') : await doForkDeploy();

    [owner] = signers as ethers.Signer[];

    setupAccount = await getImpersonatedSigner(
      provider,
      '0x48914229deDd5A9922f44441ffCCfC2Cb7856Ee9'
    );
    attacker = signers[1];
    whaleAccount = signers[2];

    market = LegacyMarket__factory.connect(outputs.contracts.Proxy.address, setupAccount);

    addressResolver = new ethers.Contract(
      outputs.imports.v2x.contracts.AddressResolver.address,
      outputs.imports.v2x.contracts.AddressResolver.abi,
      provider
    );
    snxV2 = new ethers.Contract(
      outputs.imports.v2x.contracts.ProxySynthetix.address,
      outputs.imports.v2x.contracts.Synthetix.abi,
      provider
    );
    susdToken = new ethers.Contract(
      outputs.imports.v2x.contracts.ProxysUSD.address,
      outputs.imports.v2x.contracts.ProxysUSD.abi,
      provider
    );

    v3System = new ethers.Contract(
      outputs.imports.v3.contracts.CoreProxy.address,
      outputs.imports.v3.contracts.CoreProxy.abi,
      provider
    );
    v3Account = new ethers.Contract(
      outputs.imports.v3.contracts.AccountProxy.address,
      outputs.imports.v3.contracts.AccountProxy.abi,
      provider
    );

    v3Usd = new ethers.Contract(
      outputs.imports.v3.contracts.USDProxy.address,
      outputs.imports.v3.contracts.USDProxy.abi,
      provider
    );

    cannonProvider = provider;

    // set v2 oracle snx price
    const newRate = 2000000; // snx = $2 (6 decimals)
    await setSNXPrice(newRate, provider);

    const oracleRate = '2';
    const nodeID = '0x6cb1042857d7329f5ee7ae88c96fd693a39b006b6a8884139c99802c856ca588';

    const mockOracleABI: string[] = [
      'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAd, uint256 updatedAt, uint80 answeredInRound)',
      'function updateAnswer(int256 _answer) external',
      'function description() external view returns (string memory)',
    ];

    // loading oracle manager
    const omAddress = await v3System.getOracleManager();
    const omABI = [
      'function getNode(bytes32 nodeId) external view returns (tuple(uint8, bytes, bytes32[]) node)',
      'function process(bytes32 nodeId) external view returns (tuple(int256, uint256, uint256, uint256))',
    ];

    const om = new ethers.Contract(omAddress, omABI, provider);

    const returnData = await om.getNode(nodeID);
    const decodedValue = ethers.utils.defaultAbiCoder.decode(
      ['address', 'uint256', 'uint8'],
      returnData[1]
    );
    const mockOracleAddress = decodedValue[0];

    const mockOracle = new ethers.Contract(mockOracleAddress, mockOracleABI, provider);

    // set v3 oracle equal to the v2 oracle
    await mockOracle.connect(owner).updateAnswer(wei(oracleRate).toBN());

    // send ETH to  whale account
    await owner.sendTransaction({ to: await whaleAccount.getAddress(), value: wei(1).toBN() });

    // send ETH to attacker account
    await owner.sendTransaction({ to: await attacker.getAddress(), value: wei(1).toBN() });
  });

  async function printV2State() {
    let cratio = await snxV2.collateralisationRatio(market.address);
    console.log(
      `v3 LM     | ${fromBN(
        await snxV2.debtBalanceOf(market.address, ethers.utils.formatBytes32String('sUSD'))
      ).padEnd(20, ' ')} debtShares | ${fromBN(await snxV2.balanceOf(market.address)).padEnd(
        10,
        ' '
      )} SNX | ${fromBN(await susdToken.balanceOf(market.address)).padEnd(20, ' ')} sUSD | ${
        cratio == 0 ? 0 : wei(100).div(cratio)
      }% c-ratio`
    );

    const setupAccountAddress = await setupAccount.getAddress();
    cratio = await snxV2.collateralisationRatio(setupAccountAddress);
    console.log(
      `setup acc | ${fromBN(
        await snxV2.debtBalanceOf(setupAccountAddress, ethers.utils.formatBytes32String('sUSD'))
      ).padEnd(20, ' ')} debtShares | ${fromBN(await snxV2.balanceOf(setupAccountAddress)).padEnd(
        10,
        ' '
      )} SNX | ${fromBN(await susdToken.balanceOf(setupAccountAddress)).padEnd(20, ' ')} sUSD | ${
        cratio == 0 ? 0 : wei(100).div(cratio)
      }% c-ratio`
    );

    const whaleAddress = await whaleAccount.getAddress();
    cratio = await snxV2.collateralisationRatio(whaleAddress);
    console.log(
      `whale     | ${fromBN(
        await snxV2.debtBalanceOf(whaleAddress, ethers.utils.formatBytes32String('sUSD'))
      ).padEnd(20, ' ')} debtShares | ${fromBN(await snxV2.balanceOf(whaleAddress)).padEnd(
        10,
        ' '
      )} SNX | ${fromBN(await susdToken.balanceOf(whaleAddress)).padEnd(20, ' ')} sUSD | ${
        cratio == 0 ? 0 : wei(100).div(cratio)
      }% c-ratio`
    );

    const attackerAddress = await attacker.getAddress();
    cratio = await snxV2.collateralisationRatio(attackerAddress);
    console.log(
      `attacker  | ${fromBN(
        await snxV2.debtBalanceOf(attackerAddress, ethers.utils.formatBytes32String('sUSD'))
      ).padEnd(20, ' ')} debtShares | ${fromBN(await snxV2.balanceOf(attackerAddress)).padEnd(
        10,
        ' '
      )} SNX | ${fromBN(await susdToken.balanceOf(attackerAddress)).padEnd(20, ' ')} sUSD | ${
        cratio == 0 ? 0 : wei(100).div(cratio)
      }% c-ratio`
    );
  }

  async function setSNXPrice(
    newRate: ethers.BigNumberish,
    provider: ethers.providers.JsonRpcProvider
  ) {
    // call with 6 decimal value
    const exchangerABI = [
      'function rateAndInvalid(bytes32) external view returns (uint256,bool)',
      'function aggregators(bytes32) external view returns (address)',
      'function rateIsFlagged(bytes32) external view returns (bool)',
    ];

    const circuitBreakerABI = [
      'function resetLastValue(address[] calldata oracleAddresses, uint[] calldata values) external',
      'function circuitBroken(address) external view returns(bool)',
      'function isInvalid(address,uint256) external view returns (bool)',
    ];

    const mockAggregatorABI = [
      'function decimals() external view returns (uint8)',
      'function latestRoundData() external view returns (uint80,int256,uint256,uint256,uint80)',
      'function setLatestAnswer(int256, uint256) external',
      'function setLatestAnswerWithRound(int256,uint256,uint80)',
    ];

    const exchangeAddress = await addressResolver.getAddress(
      ethers.utils.formatBytes32String('ExchangeRates')
    );

    const exchanger = new ethers.Contract(exchangeAddress, exchangerABI, provider);
    const snxAggregatorAddress = await exchanger.aggregators(
      ethers.utils.formatBytes32String('SNX')
    );

    const cxAddress = await addressResolver.getAddress(
      ethers.utils.formatBytes32String('CircuitBreaker')
    );

    const circuitBreaker = new ethers.Contract(cxAddress, circuitBreakerABI, provider);
    const snxAggregator = new ethers.Contract(snxAggregatorAddress, mockAggregatorABI, provider);

    await circuitBreaker.connect(owner).resetLastValue([snxAggregatorAddress], [wei(1).toBN()]);
    await snxAggregator.connect(owner).setLatestAnswerWithRound(newRate, 10000000000000, 1);
  }

  function fromBN(value: ethers.BigNumberish) {
    return ethers.utils.formatEther(value);
  }

  const restore = snapshotCheckpoint(() => cannonProvider);

  describe('iosiro tests', async () => {
    before(restore);

    it('pop preferred pool from LM and print money', async () => {
      const poolId = await v3System.getPreferredPool();
      const collateralType = snxV2.address;
      const marketId = await market.marketId();
      const attackerAddress = await attacker.getAddress();

      // transfer initial SNX to whale account and attacker
      await snxV2
        .connect(setupAccount)
        .transfer(await whaleAccount.getAddress(), wei(10000).toBN());
      await snxV2.connect(setupAccount).transfer(attackerAddress, wei(1000).toBN());

      // create another approved pool to mint snxUSD against to simulate getting it in the open market
      const otherPoolId = 222;
      await v3System.connect(owner).createPool(otherPoolId, await owner.getAddress());
      await v3System.connect(owner).addApprovedPool(otherPoolId);

      // create whale account that delegates to the other pool and mints snxUSD
      const whaleAccountId = 1111;
      const whaleDelegationAmount = wei(10000).toBN();
      const createAccountABI = ['function createAccount(uint128) external returns (uint128)'];
      const createAccountSystem = new ethers.Contract(
        v3System.address,
        createAccountABI,
        cannonProvider
      );
      await createAccountSystem.connect(whaleAccount).createAccount(whaleAccountId);
      await snxV2.connect(whaleAccount).approve(v3System.address, whaleDelegationAmount);
      await v3System
        .connect(whaleAccount)
        .deposit(whaleAccountId, collateralType, whaleDelegationAmount);
      await v3System
        .connect(whaleAccount)
        .delegateCollateral(
          whaleAccountId,
          otherPoolId,
          collateralType,
          whaleDelegationAmount,
          wei(1).toBN()
        );
      await v3System
        .connect(whaleAccount)
        .mintUsd(whaleAccountId, otherPoolId, collateralType, wei(3333).toBN());

      // attacker does approvals to LM for migration, convertUSD and snxUSD burn
      await snxV2.connect(attacker).approve(market.address, ethers.constants.MaxUint256);
      await susdToken.connect(attacker).approve(market.address, ethers.constants.MaxUint256);
      await v3Usd.connect(attacker).approve(v3System.address, ethers.constants.MaxUint256);

      // issue attacker v2 synths and print attacker initial balances:
      await snxV2.connect(attacker).issueMaxSynths();
      console.log('-------------------- v2 initial state --------------------');
      await printV2State();

      console.log(
        `\nLegacy market DPS before attack: ${fromBN(
          await v3System.callStatic.getMarketDebtPerShare(marketId)
        )}`
      );
      // attacker migrates v2, converts, burns, undelegates, restakes in v2 until PP is popped from LM
      let accountID = 10001;
      const numRepeatitions = 4;
      for (let attackCounter = 1; attackCounter < numRepeatitions; attackCounter++) {
        // attacker repeatedly migrates account from v2
        await market.connect(attacker).migrate(accountID);
        // attacker converts sUSD to snxUSD
        await market.connect(attacker).convertUSD(await susdToken.balanceOf(attackerAddress));
        // attacker burns snxUSD to pay off debt
        const amountToBurn = await v3System.callStatic.getPositionDebt(
          accountID,
          poolId,
          collateralType
        );
        await v3System.connect(attacker).burnUsd(accountID, poolId, collateralType, amountToBurn);
        // attacker undelegates and withdraws SNX
        const accountCollateralDetails = await v3System.callStatic.getAccountCollateral(
          accountID,
          collateralType
        );
        const amountToWithdraw = accountCollateralDetails.totalDeposited;

        await fastForward(605000, cannonProvider);
        await v3System
          .connect(attacker)
          .delegateCollateral(accountID, poolId, collateralType, 0, wei(1).toBN());
        await v3System.connect(attacker).withdraw(accountID, collateralType, amountToWithdraw);
        // attacker restakes in v2
        await snxV2.connect(attacker).issueMaxSynths();
        accountID++;
      }

      console.log(
        `\nLegacy market DPS after attack: ${fromBN(
          await v3System.callStatic.getMarketDebtPerShare(marketId)
        )}`
      );

      // attacker migrates from v2 again for profit
      // this should fail beacuse the market is going above its max debt per share, so the pool disconnects
      await assertRevert(
        market.connect(attacker).migrate(accountID),
        'NotFundedByPool("1", "1")',
        v3System
      );
    });
  });
});
