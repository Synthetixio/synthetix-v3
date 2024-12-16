//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";

import {UUPSImplementation} from "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";

import "./interfaces/ITreasuryMarket.sol";

import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC721.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC721Receiver.sol";

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";

/* solhint-disable numcast/safe-cast */

contract TreasuryMarket is ITreasuryMarket, Ownable, UUPSImplementation, IMarket, IERC721Receiver {
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using DecimalMath for uint256;

    uint32 public constant MIN_DELEGATION_TIME = 0;

    address public immutable treasury;
    uint128 public immutable poolId;
    address public immutable collateralToken;
    IV3CoreProxy public immutable v3System;

    uint128 public marketId;

    uint256 public targetCratio;

    mapping(uint128 => uint256) saddledCollateral;
    mapping(uint128 => uint256) loans;

    // solhint-disable-next-line no-empty-blocks
    constructor(
        IV3CoreProxy v3SystemAddress,
        address treasuryAddress,
        uint128 v3PoolId,
        address collateralTokenAddress
    ) Ownable(ERC2771Context._msgSender()) {
        treasury = treasuryAddress;
        v3System = v3SystemAddress;
        poolId = v3PoolId;
        collateralToken = collateralTokenAddress;
    }

    /**
     * @inheritdoc ITreasuryMarket
     */
    function registerMarket() external onlyOwner returns (uint128 newMarketId) {
        if (marketId != 0) {
            revert MarketAlreadyRegistered(marketId);
        }

        newMarketId = v3System.registerMarket(address(this));
        //v3System.setMarketMinDelegateTime(newMarketId, MIN_DELEGATION_TIME);
        marketId = newMarketId;

        // while we are here, also set the approval that we need for the core sysetm to pull USD from us
        IERC20(v3System.getUsdToken()).approve(address(v3System), type(uint256).max);
    }

    /**
     * @inheritdoc IMarket
     */
    function reportedDebt(uint128 /*requestedMarketId*/) public pure returns (uint256 debt) {
        return 0;

        // TODO: I would really like for the pool to display exactly ex. 200% c-ratio by reporting higher debt here,
        // but calling `getVaultDebt` effectively calls this function, which calls `getVaultDebt` again
        // so we would need to reverse engineer this calculation somehow, and that just seems like way too much effort
        // for the needs of this project.
        // report enough debt to make it look like the target c-ratio
        /*(, uint256 collateralValue) = v3System.getVaultCollateral(poolId, collateralToken);
        int256 currentDebt = v3System.getVaultDebt(poolId, collateralToken);

        int256 targetDebt = (collateralValue * targetCratio / 1e18).toInt();
        return currentDebt > targetDebt ? uint256(currentDebt - targetDebt) : 0;*/
    }

    /**
     * @inheritdoc IMarket
     */
    function name(uint128) external pure returns (string memory) {
        return "Treasury Market";
    }

    /**
     * @inheritdoc IMarket
     */
    function minimumCredit(
        uint128 /* requestedMarketId*/
    ) external pure returns (uint256 lockedAmount) {
        // no need to lock collateral because the market locks any users that connect to it immediately
        return 0;
    }

    function setTargetCRatio(uint256 ratio) external onlyOwner {
        targetCratio = ratio;
        emit TargetCRatioSet(ratio);
    }

    function saddle(uint128 accountId) external {
        // get current position information
        (uint256 accountCollateral, uint256 accountCollateralValue, int256 accountDebt, ) = v3System
            .getPosition(accountId, poolId, collateralToken);

        // get the actual collateralization of the pool now
        (, uint256 vaultCollateralValue) = v3System.getVaultCollateral(poolId, collateralToken);
        int256 vaultDebtValue = v3System.getVaultDebt(poolId, collateralToken);

        // we want this newly added user to match the current collateralization status of the pool
        int256 targetDebt = (accountCollateralValue.toInt() * vaultDebtValue) /
            vaultCollateralValue.toInt();

        // cannot saddle account if its c-ratio is too low
        // if an account has added additional collateral and their c-ratio is still too low to saddle, then its not harmful because they
        // will simply have higher c-ratio than the rest of the system in this edge case.
        if (accountDebt > targetDebt) {
            revert InsufficientCRatio(accountId, accountDebt.toUint(), targetDebt.toUint());
        }

        v3System.associateDebt(
            marketId,
            poolId,
            collateralToken,
            accountId,
            uint256(targetDebt - accountDebt)
        );

        // if a user has not been saddled before, any existing account debt becomes a loan on the user
        if (accountDebt > 0 && saddledCollateral[accountId] == 0) {
            loans[accountId] = accountDebt.toUint();
            emit LoanAdjusted(accountId, accountDebt.toUint(), 0);
        }

        saddledCollateral[accountId] = accountCollateral;

        emit AccountSaddled(accountId, accountCollateral, uint256(targetDebt - accountDebt));
    }

    function unsaddle(uint128 accountId) external {
        if (saddledCollateral[accountId] == 0) {
            revert ParameterError.InvalidParameter("accountId", "not saddled");
        }

        address sender = ERC2771Context._msgSender();
        IERC721 accountToken = IERC721(v3System.getAccountTokenAddress());
        if (sender != accountToken.ownerOf(accountId)) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }

        if (loans[accountId] > 0) {
            revert OutstandingLoan(accountId, loans[accountId]);
        }

        // transfer the account token from the user so that we can undelegate them and repay their debt
        accountToken.safeTransferFrom(ERC2771Context._msgSender(), address(this), accountId);

        // get current position information
        (uint256 accountCollateral, , int256 accountDebt, ) = v3System.getPosition(
            accountId,
            poolId,
            collateralToken
        );

        if (accountDebt > 0) {
            (uint256 vaultCollateral, ) = v3System.getVaultCollateral(poolId, collateralToken);

            // geometric series function solution to calculate the total amount of debt required for a repay
            int256 neededToRepay = 1 ether * accountDebt / int256(1 ether - accountCollateral * 1 ether / vaultCollateral) + 1;
            v3System.withdrawMarketUsd(marketId, address(this), uint256(neededToRepay));
            v3System.deposit(accountId, v3System.getUsdToken(), uint256(neededToRepay));
            v3System.burnUsd(accountId, poolId, collateralToken, uint256(neededToRepay));

            saddledCollateral[accountId] = 0;

            emit AccountUnsaddled(accountId, accountCollateral, neededToRepay.toUint());
        }

        // undelegate collateral automatically for the user because they should no longer be part of this pool anyway now that they have been unsaddled
        v3System.delegateCollateral(accountId, poolId, collateralToken, 0, 1 ether);

        // return the account token to the user
        accountToken.safeTransferFrom(address(this), sender, accountId);
    }

    function adjustLoan(uint128 accountId, uint256 amount) external {
        address sender = ERC2771Context._msgSender();
        if (sender != IERC721(v3System.getAccountTokenAddress()).ownerOf(accountId)) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }

        uint256 loanedAmount = loans[accountId];

        if (amount > loans[accountId]) {
            uint256 maxLoan = saddledCollateral[accountId].divDecimal(v3System.getCollateralConfiguration(address(collateralToken)).issuanceRatioD18);
            if (amount > maxLoan) {
                revert InsufficientCRatio(accountId, amount, maxLoan);
            }


            v3System.withdrawMarketUsd(marketId, sender, amount - loanedAmount);
        } else if (amount < loans[accountId]) {
            v3System.depositMarketUsd(marketId, sender, loanedAmount - amount);
        } else {
            revert ParameterError.InvalidParameter("amount", "unchanged");
        }

        loans[accountId] = amount;

        emit LoanAdjusted(accountId, amount, loanedAmount);
    }

    function mintTreasury(uint256 amount) external onlyOwner {
        v3System.withdrawMarketUsd(marketId, treasury, amount);
        emit TreasuryMinted(amount);
    }

    function burnTreasury(uint256 amount) external onlyOwner {
        v3System.depositMarketUsd(marketId, treasury, amount);
        emit TreasuryBurned(amount);
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

    /**
     * @inheritdoc IERC721Receiver
     * @dev This function is required so that self transfer in `unsaddle` works as expected.
     */
    function onERC721Received(
        address,
        /*operator*/ address,
        /*from*/ uint256,
        /*tokenId*/ bytes memory /*data*/
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
