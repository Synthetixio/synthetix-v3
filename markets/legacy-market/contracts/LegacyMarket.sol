//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

//import "@synthetixio/synthetix-main/contracts/interfaces/external/IMarket.sol";

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

contract LegacyMarket is Ownable/* is IMarket*/ {
    using MathUtil for uint256;

    uint128 public marketId;
    bool public pauseStablecoinConversion;
    bool public pauseMigration;

    IAddressResolver public v2xResolver;
    IV3CoreProxy public v3System;

    error NothingToMigrate();
    error InsufficientCollateralMigrated(uint amountRequested, uint amountAvailable);
    error Paused();

    constructor(IAddressResolver v2xResolverAddress, IV3CoreProxy v3SystemAddress) {
        v2xResolver = v2xResolverAddress;
        v3System = v3SystemAddress;

        marketId = v3System.registerMarket(address(this));
    }

    function balance() public view returns (uint) {
        IIssuer iss = IIssuer(v2xResolver.getAddress("Issuer"));

        return iss.debtBalanceOf(address(this), "sUSD");
    }

    function locked() external pure returns (uint) {
        return 0;
    }

    function convertUSD(uint amount) external {
        if (pauseStablecoinConversion) {
            revert Paused();
        }

        if (balance() < amount) {
            revert InsufficientCollateralMigrated(amount, balance());
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

    function migateOnBehalf(address staker, uint128 accountId) external onlyOwner {
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

        oldSynthetix.transferFrom(staker, address(this), collateralMigrated);

        oldDebtShares.transferFrom(staker, address(this), debtSharesMigrated);

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

        v3System.associateDebt(
            accountId,
            preferredPoolId,
            address(oldSynthetix),
            debtValueMigrated
        );

        IERC721(v3System.getAccountTokenAddress()).safeTransferFrom(address(this), staker, accountId);
    }

    function setPauseStablecoinConversion(bool paused) external onlyOwner {
        pauseStablecoinConversion = paused;
    }
    
    function togglePauseMigration(bool paused) external onlyOwner {
        pauseMigration = paused;
    }

    function _calculateDebtValueMigrated(uint debtSharesMigrated) internal view returns (uint) {
        (uint totalSystemDebt, uint totalDebtShares, ) = IIssuer(v2xResolver.getAddress("Issuer"))
            .allNetworksDebtInfo();
        
        return debtSharesMigrated * totalSystemDebt / totalDebtShares;
    }

}
