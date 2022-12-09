//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import "synthetix/contracts/interfaces/IAddressResolver.sol";
import "synthetix/contracts/interfaces/ILiquidatorRewards.sol";
import "synthetix/contracts/interfaces/IIssuer.sol";
import "synthetix/contracts/interfaces/ISynthetixDebtShare.sol";

import "./interfaces/ISynthetix.sol";
import "./interfaces/IRewardEscrowV2.sol";
import "./interfaces/IV3CoreProxy.sol";

import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC721.sol";

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";

import "hardhat/console.sol";

contract LegacyMarket is Ownable, IMarket {
    using DecimalMath for uint256;

    uint128 public marketId;
    bool public pauseStablecoinConversion;
    bool public pauseMigration;

    // used by _migrate to temporarily set reportedDebt to another value before
    uint tmpLockedDebt;

    IAddressResolver public v2xResolver;
    IV3CoreProxy public v3System;

    error NothingToMigrate();
    error InsufficientCollateralMigrated(uint amountRequested, uint amountAvailable);
    error Paused();

    event AccountMigrated(address indexed account, uint indexed accountId, uint collateralAmount, uint debtAmount);
    event ConvertedUSD(address indexed account, uint amount);

    constructor(
        address owner,
        IAddressResolver v2xResolverAddress,
        IV3CoreProxy v3SystemAddress
    ) {
        v2xResolver = v2xResolverAddress;
        v3System = v3SystemAddress;

        IERC20(v2xResolverAddress.getAddress("ProxySynthetix")).approve(address(v3SystemAddress), type(uint).max);

        OwnableStorage.load().owner = owner;
    }

    function registerMarket() external onlyOwner returns (uint128 newMarketId) {
        require(marketId == 0, "Market already registered");
        newMarketId = v3System.registerMarket(address(this));
        marketId = newMarketId;
    }

    function reportedDebt(uint128 requestedMarketId) public view returns (uint) {
        if (marketId == requestedMarketId) {
            if (tmpLockedDebt != 0) {
                return tmpLockedDebt;
            }

            IIssuer iss = IIssuer(v2xResolver.getAddress("Issuer"));

            return iss.debtBalanceOf(address(this), "sUSD");
        }

        return 0;
    }

    function name(uint128 marketId) external view returns (string memory) {
        return "Legacy Market";
    }

    function locked(
        uint128 /* requestedMarketId*/
    ) external pure returns (uint) {
        return 0;
    }

    function convertUSD(uint amount) external {
        if (pauseStablecoinConversion) {
            revert Paused();
        }

        if (amount == 0) {
            revert ParameterError.InvalidParameter("amount", "Should be non-zero");
        }

        if (amount > reportedDebt(marketId)) {
            revert InsufficientCollateralMigrated(amount, reportedDebt(marketId));
        }

        IERC20 oldUSD = IERC20(v2xResolver.getAddress("ProxysUSD"));
        ISynthetix oldSynthetix = ISynthetix(v2xResolver.getAddress("Synthetix"));

        oldUSD.transferFrom(msg.sender, address(this), amount);
        oldSynthetix.burnSynths(amount);

        v3System.withdrawMarketUsd(marketId, msg.sender, amount);

        emit ConvertedUSD(msg.sender, amount);
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
        tmpLockedDebt = reportedDebt(marketId);

        ISynthetix oldSynthetix = ISynthetix(v2xResolver.getAddress("ProxySynthetix"));

        // ensure liquidator rewards are collected (have to do it here so escrow is up to date)
        ILiquidatorRewards(v2xResolver.getAddress("LiquidatorRewards")).getReward(staker);

        VestingEntries.VestingEntryWithID[] memory oldEscrows = IRewardEscrowV2(v2xResolver.getAddress("RewardEscrowV2"))
            .getVestingSchedules(staker, 0, 1000);

        // transfer all collateral from the user to our account
        (uint collateralMigrated, uint debtValueMigrated) = _gatherFromV2x(staker);

        v3System.createAccount(accountId);

        v3System.deposit(accountId, address(oldSynthetix), collateralMigrated);

        uint curTime = block.timestamp;
        for (uint i = 0; i < oldEscrows.length; i++) {
            if (oldEscrows[i].endTime > curTime) {
                v3System.createLock(accountId, address(oldSynthetix), oldEscrows[i].escrowAmount, oldEscrows[i].endTime);
            }
        }

        uint128 preferredPoolId = v3System.getPreferredPool();

        v3System.delegateCollateral(accountId, preferredPoolId, address(oldSynthetix), collateralMigrated, DecimalMath.UNIT);

        tmpLockedDebt = 0;

        v3System.associateDebt(marketId, preferredPoolId, address(oldSynthetix), accountId, debtValueMigrated);

        IERC721(v3System.getAccountTokenAddress()).safeTransferFrom(address(this), staker, accountId);

        emit AccountMigrated(staker, accountId, collateralMigrated, debtValueMigrated);
    }

    function _gatherFromV2x(address staker) internal returns (uint totalCollateralAmount, uint totalDebtAmount) {
        ISynthetix oldSynthetix = ISynthetix(v2xResolver.getAddress("ProxySynthetix"));
        ISynthetixDebtShare oldDebtShares = ISynthetixDebtShare(v2xResolver.getAddress("SynthetixDebtShare"));

        uint unlockedSnx = IERC20(address(oldSynthetix)).balanceOf(staker);
        totalCollateralAmount = ISynthetix(v2xResolver.getAddress("Synthetix")).collateral(staker);
        uint debtSharesMigrated = oldDebtShares.balanceOf(staker);

        if (totalCollateralAmount == 0 || debtSharesMigrated == 0) {
            revert NothingToMigrate();
        }

        totalDebtAmount = _calculateDebtValueMigrated(debtSharesMigrated);

        // transfer debt shares first so we can remove SNX from user's account
        oldDebtShares.transferFrom(staker, address(this), debtSharesMigrated);

        IERC20(address(oldSynthetix)).transferFrom(staker, address(this), unlockedSnx);

        // ensure escrow should be revoked
        if (unlockedSnx < totalCollateralAmount) {
            ISynthetix(v2xResolver.getAddress("Synthetix")).revokeAllEscrow(staker);
        }
    }

    function setPauseStablecoinConversion(bool paused) external onlyOwner {
        pauseStablecoinConversion = paused;
    }

    function setPauseMigration(bool paused) external onlyOwner {
        pauseMigration = paused;
    }

    function _calculateDebtValueMigrated(uint debtSharesMigrated) internal view returns (uint) {
        (uint totalSystemDebt, uint totalDebtShares, ) = IIssuer(v2xResolver.getAddress("Issuer")).allNetworksDebtInfo();

        return (debtSharesMigrated * totalSystemDebt) / totalDebtShares;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IMarket).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
