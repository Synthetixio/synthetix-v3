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

/**
 * @notice A Synthetix V3 market to allocate delegated collateral towards a treasury. The treasury can then freely allocate and spend the USD tokens
 * mintable via the market.
 * The market effectively takes control of ownership of the debt of the pool, and becomes responsible for ensuring its success.
 * A loan mechanism is included which allows for existing users to migrate onto this pool without having to repay their debt.
 * This debt can be decayed over time via polynomial function.
 */
contract TreasuryMarket is ITreasuryMarket, Ownable, UUPSImplementation, IMarket, IERC721Receiver {
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using DecimalMath for uint256;

    uint32 public constant MIN_DELEGATION_TIME = 0;

    address public immutable treasury;
    uint128 public immutable poolId;
    address public immutable collateralToken;
    IV3CoreProxy public immutable v3System;

    int256 public artificialDebt;

    uint128 public marketId;

    uint256 public targetCratio;

    uint32 public debtDecayPower;
    uint32 public debtDecayTime;

    uint128 public debtDecayPenaltyStart;
    uint128 public debtDecayPenaltyEnd;

    uint256 lockedCollateral;

    uint256 public totalSaddledCollateral;

    mapping(uint128 => uint256) public saddledCollateral;
    mapping(uint128 => LoanInfo) public loans;

    struct LoanInfo {
        uint64 startTime;
        uint32 power;
        uint32 duration;
        uint128 loanAmount;
    }

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

        // by default we set target c-ratio to 200%
        targetCratio = 2 ether;

        lockedCollateral = uint256(type(int256).max);
    }

    /**
     * @inheritdoc IMarket
     */
    function reportedDebt(uint128 /*requestedMarketId*/) public view returns (uint256 debt) {
        if (artificialDebt < 0) {
            // from a logic perspective, this branch should not be possible. But we dont want a revert if somehow this was negative.
            return 0;
        }

        return uint256(artificialDebt);

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
    ) external view returns (uint256 lockedAmount) {
        // we lock collateral here because
        return lockedCollateral;
    }

    function setTargetCRatio(uint256 ratio) external onlyOwner {
        targetCratio = ratio;
        emit TargetCRatioSet(ratio);

        _rebalance();
    }

    function saddle(uint128 accountId) external {
        // get current position information
        (uint256 accountCollateral, uint256 accountCollateralValue, int256 accountDebt, ) = v3System
            .getPosition(accountId, poolId, collateralToken);

        // get the actual collateralization of the pool now
        (, uint256 vaultCollateralValue) = v3System.getVaultCollateral(poolId, collateralToken);
        int256 vaultDebtValue = v3System.getVaultDebt(poolId, collateralToken);

        //
        uint256 newlySaddledValue = accountCollateralValue -
            (saddledCollateral[accountId] * accountCollateralValue) /
            accountCollateral;

        // debt can only be added once an account joins the pool for the first time
        int256 newlySaddledDebt = saddledCollateral[accountId] > 0 ? int256(0) : accountDebt;

        // we want this newly added user to match the current collateralization status of the pool
        int256 targetDebt = vaultDebtValue;
        if (totalSaddledCollateral == 0) {
            // if there is no artificial debt, it means that this is the first user and we should create a bunch
            // to bring to low cratio
            targetDebt = vaultCollateralValue.divDecimal(targetCratio).toInt();
        } else if (vaultCollateralValue > accountCollateralValue) {
            // we calculate what the c-ratio of the pool should have been prior to when the account added onto the pool
            // this will allow for the correct debt to be set on this account to "equalize" with the other accounts
            targetDebt =
                (accountCollateralValue.toInt() * (vaultDebtValue - newlySaddledDebt)) /
                (vaultCollateralValue - newlySaddledValue).toInt();
        }

        // cannot saddle account if its c-ratio is too low
        // if an account has added additional collateral and their c-ratio is still too low to saddle, then its not harmful because they
        // will simply have higher c-ratio than the rest of the system in this edge case.
        if (accountDebt > targetDebt) {
            revert InsufficientCRatio(accountId, accountDebt.toUint(), targetDebt.toUint());
        }

        artificialDebt += targetDebt - accountDebt;
        v3System.associateDebt(
            marketId,
            poolId,
            collateralToken,
            accountId,
            uint256(targetDebt - accountDebt)
        );

        // if a user has not been saddled before, any existing account debt becomes a loan on the user
        if (accountDebt > 0 && saddledCollateral[accountId] == 0) {
            loans[accountId] = LoanInfo(
                uint64(block.timestamp),
                debtDecayPower,
                debtDecayTime,
                accountDebt.toUint().to128()
            );
            emit LoanAdjusted(accountId, accountDebt.toUint(), 0);
        }

        saddledCollateral[accountId] = accountCollateral;
        totalSaddledCollateral += accountCollateral;

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

        uint256 currentLoan = _loanedAmount(accountId, block.timestamp);
        if (currentLoan > 0) {
            revert OutstandingLoan(accountId, _loanedAmount(accountId, block.timestamp));
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

            if (accountCollateral == vaultCollateral) {
                revert ParameterError.InvalidParameter(
                    "accountCollateral",
                    "no surplus collateral to fund exit"
                );
            }

            uint256 neededToRepay = uint256(accountDebt);
            artificialDebt -= int256(neededToRepay);
            v3System.withdrawMarketUsd(marketId, address(this), neededToRepay);
            v3System.deposit(accountId, v3System.getUsdToken(), neededToRepay);
            v3System.burnUsd(accountId, poolId, collateralToken, neededToRepay);

            emit AccountUnsaddled(accountId, accountCollateral, neededToRepay);
        }

        totalSaddledCollateral -= saddledCollateral[accountId];
        saddledCollateral[accountId] = 0;

        // undelegate collateral automatically for the user because they should no longer be part of this pool anyway now that they have been unsaddled
        // before undelegating the collateral we have to unlock the minimumCredit because this is the only time undelegation should be possible.
        lockedCollateral = 0;
        v3System.delegateCollateral(accountId, poolId, collateralToken, 0, 1 ether);
        lockedCollateral = uint256(type(int256).max);

        // return the account token to the user
        accountToken.safeTransferFrom(address(this), sender, accountId);

        _rebalance();
    }

    function repaymentPenalty(
        uint128 accountId,
        uint256 targetDebt
    ) external view returns (uint256) {
        uint256 currentLoan = _loanedAmount(accountId, block.timestamp);
        if (targetDebt > currentLoan || debtDecayPenaltyStart == 0) {
            return 0;
        }

        uint256 loanCompletionPercentage = loans[accountId].duration > 0
            ? (block.timestamp - loans[accountId].startTime).divDecimal(loans[accountId].duration)
            : 0;

        if (loanCompletionPercentage < 1 ether) {
            uint256 currentPenalty = uint256(debtDecayPenaltyStart).mulDecimal(
                1 ether - loanCompletionPercentage
            ) + uint256(debtDecayPenaltyEnd).mulDecimal(loanCompletionPercentage);
            return
                (loans[accountId].loanAmount - currentLoan).mulDecimal(currentPenalty).mulDecimal(
                    1 ether - targetDebt.divDecimal(currentLoan)
                );
        }

        return 0;
    }

    function adjustLoan(uint128 accountId, uint256 amount) external {
        address sender = ERC2771Context._msgSender();
        if (sender != IERC721(v3System.getAccountTokenAddress()).ownerOf(accountId)) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }

        uint256 currentLoan = _loanedAmount(accountId, block.timestamp);

        if (amount > currentLoan) {
            revert ParameterError.InvalidParameter("amount", "must be less than current loan");
        } else if (amount < currentLoan) {
            // apply a penalty on whatever is repaid
            // the penalty subtracts a certain percentage from what is . for example:
            uint256 repaidBeforePenalty = currentLoan - amount;

            uint256 loanCompletionPercentage = loans[accountId].duration > 0
                ? (block.timestamp - loans[accountId].startTime).divDecimal(
                    loans[accountId].duration
                )
                : 0;
            if (loanCompletionPercentage < 1 ether && debtDecayPenaltyStart > 0) {
                uint256 currentPenalty = uint256(debtDecayPenaltyStart).mulDecimal(
                    1 ether - loanCompletionPercentage
                ) + uint256(debtDecayPenaltyEnd).mulDecimal(loanCompletionPercentage);
                uint256 repaidAmount = (loans[accountId].loanAmount - currentLoan)
                    .mulDecimal(currentPenalty)
                    .mulDecimal(1 ether - amount.divDecimal(currentLoan)) + repaidBeforePenalty;

                v3System.depositMarketUsd(marketId, sender, repaidAmount);
            } else {
                v3System.depositMarketUsd(marketId, sender, repaidBeforePenalty);
            }
            _rebalance();
        } else {
            return; // nothing to do
        }

        // fractionally modify the original loan amount--this will continue the repayment schedule where the user left off without resetting it
        loans[accountId].loanAmount = ((loans[accountId].loanAmount * amount) / currentLoan)
            .to128();

        emit LoanAdjusted(accountId, amount, currentLoan);
    }

    function loanedAmount(uint128 accountId) external view returns (uint256) {
        return _loanedAmount(accountId, block.timestamp);
    }

    function setDebtDecayFunction(
        uint32 power,
        uint32 time,
        uint128 startPenalty,
        uint128 endPenalty
    ) external onlyOwner {
        if (power > 100) {
            revert ParameterError.InvalidParameter("power", "too high");
        }
        if (startPenalty > 1 ether) {
            revert ParameterError.InvalidParameter("startPenalty", "must be less than 1 ether");
        }
        if (endPenalty > startPenalty) {
            revert ParameterError.InvalidParameter("endPenalty", "must be lte startPenalty");
        }
        debtDecayPower = power;
        debtDecayTime = time;
        debtDecayPenaltyStart = startPenalty;
        debtDecayPenaltyEnd = endPenalty;
    }

    function rebalance() external {
        _rebalance();
    }

    function mintTreasury(uint256 amount) external onlyOwner {
        v3System.withdrawMarketUsd(marketId, treasury, amount);
        emit TreasuryMinted(amount);
        _rebalance();
    }

    function burnTreasury(uint256 amount) external onlyOwner {
        v3System.depositMarketUsd(marketId, treasury, amount);
        emit TreasuryBurned(amount);
        _rebalance();
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
        /*operator*/
        address,
        /*from*/
        uint256,
        /*tokenId*/
        bytes memory /*data*/
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function _rebalance() internal {
        if (artificialDebt == 0) {
            return;
        }

        (, uint256 vaultCollateralValue) = v3System.getVaultCollateral(poolId, collateralToken);
        int256 vaultDebtValue = v3System.getVaultDebt(poolId, collateralToken);

        int256 targetDebt = vaultCollateralValue.divDecimal(targetCratio).toInt();

        if (artificialDebt > vaultDebtValue - targetDebt) {
            artificialDebt += targetDebt - vaultDebtValue;
        } else {
            // set the artificial debt to the lowest valid value
            targetDebt = vaultDebtValue - artificialDebt;
            artificialDebt = 0;
        }

        emit Rebalanced(vaultDebtValue, targetDebt);
    }

    function _decimalPow(uint256 base, uint256 exp) internal pure returns (uint256) {
        uint256 cur = 1e18;
        for (uint256 i = 0; i < exp; i++) {
            cur = cur.mulDecimal(base);
        }

        return cur;
    }

    function _loanedAmount(uint128 accountId, uint256 timestamp) internal view returns (uint256) {
        if (loans[accountId].power == 0 || timestamp <= loans[accountId].startTime) {
            return loans[accountId].loanAmount;
        } else if (timestamp >= loans[accountId].startTime + loans[accountId].duration) {
            return 0;
        }

        // this function is a polynomial decay
        // model if `power` is 2 and `duration` is 365 https://www.wolframalpha.com/input?i=graph+1-%28x%2F365%29%5E2+from+0+to+365
        return
            loans[accountId].loanAmount -
            uint256(loans[accountId].loanAmount).mulDecimal(
                _decimalPow(
                    (timestamp - loans[accountId].startTime).divDecimal(loans[accountId].duration),
                    loans[accountId].power
                )
            );
    }
}
