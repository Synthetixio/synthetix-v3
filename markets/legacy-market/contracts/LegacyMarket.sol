//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";

import "synthetix/contracts/interfaces/IAddressResolver.sol";
import "synthetix/contracts/interfaces/ILiquidatorRewards.sol";
import "synthetix/contracts/interfaces/IIssuer.sol";
import "synthetix/contracts/interfaces/ISynthetixDebtShare.sol";
import "synthetix/contracts/interfaces/ISynthetix.sol";

import "./interfaces/IV3CoreProxy.sol";

import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC721.sol";

import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "hardhat/console.sol";

contract LegacyMarket is Ownable, IMarket {
    using MathUtil for uint256;

    uint128 public marketId;
    bool public pauseStablecoinConversion;
    bool public pauseMigration;

    IAddressResolver public v2xResolver;
    IV3CoreProxy public v3System;

    error NothingToMigrate();
    error InsufficientCollateralMigrated(uint amountRequested, uint amountAvailable);
    error Paused();

    event AccountMigrated(address indexed account, uint indexed accountId, uint collateralAmount, uint debtAmount);

    constructor(IAddressResolver v2xResolverAddress, IV3CoreProxy v3SystemAddress) {
        v2xResolver = v2xResolverAddress;
        v3System = v3SystemAddress;

        marketId = v3System.registerMarket(address(this));
        IERC20(v2xResolverAddress.getAddress("ProxySynthetix")).approve(address(v3SystemAddress), type(uint).max);
    }

    function reportedDebt(uint requestedMarketId) public view returns (uint) {
        if (marketId == requestedMarketId) {


            IIssuer iss = IIssuer(v2xResolver.getAddress("Issuer"));

            return iss.debtBalanceOf(address(this), "sUSD");
        }

        return 0;
    }

    function locked(uint/* requestedMarketId*/) external pure returns (uint) {
        return 0;
    }

    function convertUSD(uint amount) external {
        if (pauseStablecoinConversion) {
            revert Paused();
        }

        if (reportedDebt(marketId) < amount) {
            revert InsufficientCollateralMigrated(amount, reportedDebt(marketId));
        }

        IERC20 oldUSD = IERC20(v2xResolver.getAddress("ProxysUSD"));
        ISynthetix oldSynthetix = ISynthetix(v2xResolver.getAddress("ProxySynthetix"));

        oldUSD.transferFrom(msg.sender, address(this), amount);
        oldSynthetix.burnSynths(amount);

        v3System.withdrawUSD(marketId, msg.sender, amount);
    }

    function migrate(uint128 accountId) external {
        if (pauseMigration) {
            revert Paused();
        }

        _migrate(msg.sender, accountId);
    }

    function migrateOnBehalf(address staker, uint128 accountId) external onlyOwner {
        _migrate(staker, accountId);
    }

    function _migrate(address staker, uint128 accountId) internal {

        ILiquidatorRewards(v2xResolver.getAddress("LiquidatorRewards")).getReward(staker);

        IERC20 oldSynthetix = IERC20(v2xResolver.getAddress("ProxySynthetix"));

        ISynthetixDebtShare oldDebtShares = ISynthetixDebtShare(v2xResolver.getAddress("SynthetixDebtShare"));

        uint collateralMigrated = oldSynthetix.balanceOf(staker);
        uint debtSharesMigrated = oldDebtShares.balanceOf(staker);

        if (collateralMigrated == 0 || debtSharesMigrated == 0) {
            revert NothingToMigrate();
        }

        uint debtValueMigrated = _calculateDebtValueMigrated(debtSharesMigrated);

        // transfer debt shares first so we can remove SNX from user's account
        oldDebtShares.transferFrom(staker, address(this), debtSharesMigrated);

        oldSynthetix.transferFrom(staker, address(this), collateralMigrated);

        v3System.createAccount(accountId);

        v3System.depositCollateral(accountId, address(oldSynthetix), collateralMigrated);


        uint128 preferredPoolId = v3System.getPreferredPool();

        v3System.delegateCollateral(
            accountId,
            preferredPoolId,
            address(oldSynthetix),
            collateralMigrated,
            MathUtil.UNIT
        );

        console.log("associated");

        v3System.associateDebt(
            marketId,
            preferredPoolId,
            address(oldSynthetix),
            accountId,
            debtValueMigrated
        );

        IERC721(v3System.getAccountTokenAddress()).safeTransferFrom(address(this), staker, accountId);

        emit AccountMigrated(staker, accountId, collateralMigrated, debtValueMigrated);
    }

    function setPauseStablecoinConversion(bool paused) external onlyOwner {
        pauseStablecoinConversion = paused;
    }
    
    function setPauseMigration(bool paused) external onlyOwner {
        pauseMigration = paused;
    }

    function _calculateDebtValueMigrated(uint debtSharesMigrated) internal view returns (uint) {
        (uint totalSystemDebt, uint totalDebtShares, ) = IIssuer(v2xResolver.getAddress("Issuer"))
            .allNetworksDebtInfo();
        
        return debtSharesMigrated * totalSystemDebt / totalDebtShares;
    }

}
