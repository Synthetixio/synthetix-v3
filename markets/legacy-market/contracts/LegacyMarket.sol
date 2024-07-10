//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import "./interfaces/external/ILiquidatorRewards.sol";
import "./interfaces/external/IIssuer.sol";
import "./interfaces/external/ISynthetixDebtShare.sol";

import {UUPSImplementation} from "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";

import "./interfaces/ILegacyMarket.sol";
import "./interfaces/ISNXDistributor.sol";

import "./interfaces/external/ISynthetix.sol";
import "./interfaces/external/IRewardEscrowV2.sol";

import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC721.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC721Receiver.sol";

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";

contract LegacyMarket is ILegacyMarket, Ownable, UUPSImplementation, IMarket, IERC721Receiver {
    using SafeCastU256 for uint256;
    using DecimalMath for uint256;

    uint32 public constant MIN_DELEGATION_TIME = 86400 * 7; // 7 days, matches v2x limit for the longest time

    uint128 public marketId;
    bool public pauseStablecoinConversion;
    bool public pauseMigration;

    // used by _migrate to temporarily set reportedDebt to another value before
    uint128 private tmpLockedDebt;

    bool private migrationInProgress;

    IAddressResolver public v2xResolver;
    IV3CoreProxy public v3System;
    ISNXDistributor public rewardsDistributor;

    error MigrationInProgress();

    // redefine event so it can be catched by ethers
    event MarketRegistered(
        address indexed marketAddress,
        uint128 indexed marketId,
        address indexed sender
    );
    error MarketAlreadyRegistered(uint256 existingMarketId);
    error NothingToMigrate();
    error InsufficientCollateralMigrated(uint256 amountRequested, uint256 amountAvailable);
    error Paused();
    error V2xPaused();

    // solhint-disable-next-line no-empty-blocks
    constructor() Ownable(ERC2771Context._msgSender()) {}

    /**
     * @inheritdoc ILegacyMarket
     */
    function setSystemAddresses(
        IAddressResolver v2xResolverAddress,
        IV3CoreProxy v3SystemAddress,
        ISNXDistributor snxDistributor
    ) external onlyOwner returns (bool didInitialize) {
        v2xResolver = v2xResolverAddress;
        v3System = v3SystemAddress;
        rewardsDistributor = snxDistributor;

        IERC20(v2xResolverAddress.getAddress("ProxySynthetix")).approve(
            address(v3SystemAddress),
            type(uint256).max
        );

        return true;
    }

    /**
     * @inheritdoc ILegacyMarket
     */
    function registerMarket() external onlyOwner returns (uint128 newMarketId) {
        if (marketId != 0) {
            revert MarketAlreadyRegistered(marketId);
        }

        newMarketId = v3System.registerMarket(address(this));
        v3System.setMarketMinDelegateTime(newMarketId, MIN_DELEGATION_TIME);
        marketId = newMarketId;
    }

    /**
     * @inheritdoc IMarket
     */
    function reportedDebt(uint128 requestedMarketId) public view returns (uint256 debt) {
        if (marketId == requestedMarketId) {
            // in cases where we are in the middle of an account migration, we want to prevent the debt from changing, so we "lock" the value to the amount as the call starts
            // so we can detect the increase and associate it properly later.
            if (migrationInProgress) {
                return tmpLockedDebt;
            }

            IIssuer iss = IIssuer(v2xResolver.getAddress("Issuer"));

            // the amount of debt we are backing is whatever v2x reports is the amount of debt for the legacy market
            return iss.debtBalanceOf(address(this), "sUSD");
        }

        return 0;
    }

    /**
     * @inheritdoc IMarket
     */
    function name(uint128) external pure returns (string memory) {
        return "Legacy Market";
    }

    /**
     * @inheritdoc IMarket
     */
    function minimumCredit(
        uint128 /* requestedMarketId*/
    ) external pure returns (uint256 lockedAmount) {
        // legacy market never locks collateral
        return 0;
    }

    /**
     * @inheritdoc ILegacyMarket
     */
    function convertUSD(uint256 amount) external {
        if (pauseStablecoinConversion) {
            revert Paused();
        }

        if (amount == 0) {
            revert ParameterError.InvalidParameter("amount", "Should be non-zero");
        }

        if (amount > reportedDebt(marketId)) {
            revert InsufficientCollateralMigrated(amount, reportedDebt(marketId));
        }

        // get synthetix v2x addresses
        IERC20 oldUSD = IERC20(v2xResolver.getAddress("ProxysUSD"));
        ISynthetix oldSynthetix = ISynthetix(v2xResolver.getAddress("Synthetix"));
        IIssuer iss = IIssuer(v2xResolver.getAddress("Issuer"));

        // retrieve the sUSD from the user so we can burn it
        oldUSD.transferFrom(ERC2771Context._msgSender(), address(this), amount);

        // now burn it
        uint256 beforeDebt = iss.debtBalanceOf(address(this), "sUSD");
        oldSynthetix.burnSynths(amount);
        uint256 afterDebt = iss.debtBalanceOf(address(this), "sUSD");

        // approximately equal check because some rounding error can happen on the v2x side
        if (beforeDebt - afterDebt < amount - 1) {
            revert V2xPaused();
        }

        // now mint same amount of snxUSD (called a "withdraw" in v3 land)
        v3System.withdrawMarketUsd(marketId, ERC2771Context._msgSender(), amount);

        emit ConvertedUSD(ERC2771Context._msgSender(), amount);
    }

    /**
     * @inheritdoc ILegacyMarket
     */
    function migrate(uint128 accountId) external {
        if (pauseMigration) {
            revert Paused();
        }

        _migrate(ERC2771Context._msgSender(), accountId);
    }

    /**
     * @inheritdoc ILegacyMarket
     */
    function migrateOnBehalf(address staker, uint128 accountId) external {
        _migrate(staker, accountId);
    }

    /**
     * @dev Migrates {staker} from V2 to {accountId} in V3.
     */
    function _migrate(address staker, uint128 accountId) internal {
        if (staker == address(this)) {
            revert ParameterError.InvalidParameter("staker", "must not be legacy market");
        }

        // sanity
        if (migrationInProgress) {
            revert MigrationInProgress();
        }

        // find out how much debt is on the v2x system
        tmpLockedDebt = reportedDebt(marketId).to128();
        migrationInProgress = true;

        // get the address of the synthetix v2x proxy contract so we can manipulate the debt
        ISynthetix oldSynthetix = ISynthetix(v2xResolver.getAddress("ProxySynthetix"));

        // ensure liquidator rewards are collected (have to do it here so escrow is up to date)
        ILiquidatorRewards(v2xResolver.getAddress("LiquidatorRewards")).getReward(staker);

        // get all the current vesting schedules (1000 is more entries than any account can possibly have)
        VestingEntries.VestingEntryWithID[] memory oldEscrows = IRewardEscrowV2(
            v2xResolver.getAddress("RewardEscrowV2")
        ).getVestingSchedules(staker, 0, 1000);

        // transfer all collateral from the user to our account
        (uint256 collateralMigrated, uint256 debtValueMigrated) = _gatherFromV2(staker);

        uint256 cratio = (collateralMigrated * v3System.getCollateralPrice(address(oldSynthetix))) /
            debtValueMigrated;

        // if the account needs to be liquidated, liquidate it here by unlocking the debt to all accounts and moving to a
        if (
            cratio < v3System.getCollateralConfiguration(address(oldSynthetix)).liquidationRatioD18
        ) {
            oldSynthetix.transfer(address(rewardsDistributor), collateralMigrated);
            rewardsDistributor.notifyRewardAmount(collateralMigrated);

            tmpLockedDebt = 0;
            migrationInProgress = false;

            emit AccountLiquidatedInMigration(
                staker,
                collateralMigrated,
                debtValueMigrated,
                cratio
            );

            return;
        } else if (
            ERC2771Context._msgSender() != staker &&
            ERC2771Context._msgSender() != OwnableStorage.load().owner
        ) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }

        // start building the staker's v3 account
        v3System.createAccount(accountId);

        // put the collected collateral into their v3 account
        v3System.deposit(accountId, address(oldSynthetix), collateralMigrated);

        // create the most-equivalent mechanism for v3 to match the vesting entries: a "lock"
        uint256 curTime = block.timestamp;
        for (uint256 i = 0; i < oldEscrows.length; i++) {
            if (oldEscrows[i].endTime > curTime && oldEscrows[i].escrowAmount > 0) {
                v3System.createLock(
                    accountId,
                    address(oldSynthetix),
                    oldEscrows[i].escrowAmount,
                    oldEscrows[i].endTime
                );
            }
        }

        // find out which pool is the spartan council pool
        uint128 preferredPoolId = v3System.getPreferredPool();

        // delegate to the resolved spartan council pool
        v3System.delegateCollateral(
            accountId,
            preferredPoolId,
            address(oldSynthetix),
            collateralMigrated,
            DecimalMath.UNIT
        );

        // unlock the debt. now it will suddenly appear in subsequent call for association
        tmpLockedDebt = 0;
        migrationInProgress = false;

        // now we can associate the debt to a single staker
        v3System.associateDebt(
            marketId,
            preferredPoolId,
            address(oldSynthetix),
            accountId,
            debtValueMigrated
        );

        // send the built v3 account to the staker
        IERC721(v3System.getAccountTokenAddress()).safeTransferFrom(
            address(this),
            staker,
            accountId
        );

        emit AccountMigrated(staker, accountId, collateralMigrated, debtValueMigrated);
    }

    /**
     * @dev Moves the collateral and debt associated {staker} in the V2 system to this market.
     */
    function _gatherFromV2(
        address staker
    ) internal returns (uint256 totalCollateralAmount, uint256 totalDebtAmount) {
        // get v2x addresses needed to get all the resources from staker's account
        ISynthetixDebtShare oldDebtShares = ISynthetixDebtShare(
            v2xResolver.getAddress("SynthetixDebtShare")
        );

        // find out how much collateral we will have to migrate when we are done
        totalCollateralAmount = ISynthetix(v2xResolver.getAddress("Synthetix")).collateral(staker);

        // find out how much debt we will have when we are done
        uint256 debtSharesMigrated = oldDebtShares.balanceOf(staker);

        // we cannot create an account if there is no debt shares, or there is no collateral for any debt that exists (shouldn't be able to happen but sanity)
        if (totalCollateralAmount == 0 || debtSharesMigrated == 0) {
            revert NothingToMigrate();
        }

        // debt shares != debt, so we have to do the scaling by the debt ratio oracle value
        totalDebtAmount = _calculateDebtValueMigrated(debtSharesMigrated);

        // transfer debt shares first so we can remove SNX from user's account
        oldDebtShares.transferFrom(staker, address(this), debtSharesMigrated);

        // now get the collateral from the user's account (will also get escrowed SNX)
        ISynthetix(v2xResolver.getAddress("Synthetix")).migrateAccountBalances(staker);
    }

    /**
     * @inheritdoc ILegacyMarket
     */
    function setPauseStablecoinConversion(bool paused) external onlyOwner {
        pauseStablecoinConversion = paused;

        emit PauseStablecoinConversionSet(ERC2771Context._msgSender(), paused);
    }

    /**
     * @inheritdoc ILegacyMarket
     */
    function setPauseMigration(bool paused) external onlyOwner {
        pauseMigration = paused;

        emit PauseMigrationSet(ERC2771Context._msgSender(), paused);
    }

    /**
     * @dev Returns the amount of dollar-denominated debt associated with {debtSharesMigrated} in the V2 system.
     */
    function _calculateDebtValueMigrated(
        uint256 debtSharesMigrated
    ) internal view returns (uint256 portionMigrated) {
        (uint256 totalSystemDebt, uint256 totalDebtShares, bool isStale) = IIssuer(
            v2xResolver.getAddress("Issuer")
        ).allNetworksDebtInfo();

        if (isStale) {
            revert V2xPaused();
        }

        return (debtSharesMigrated * totalSystemDebt) / totalDebtShares;
    }

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IMarket).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }

    function upgradeTo(address to) external onlyOwner {
        _upgradeTo(to);
    }

    function onERC721Received(
        address operator,
        address /*from*/,
        uint256 /*tokenId*/,
        bytes memory /*data*/
    ) external view override returns (bytes4) {
        if (operator != address(v3System)) {
            revert ParameterError.InvalidParameter("operator", "should be account token");
        }

        if (!migrationInProgress) {
            revert ParameterError.InvalidParameter("tokenId", "must be migrating account token");
        }

        return IERC721Receiver.onERC721Received.selector;
    }
}
