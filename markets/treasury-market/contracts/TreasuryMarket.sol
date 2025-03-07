//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";

import {UUPSImplementation} from "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";

import "./interfaces/ITreasuryMarket.sol";

import "./interfaces/external/IOracleManagerProxy.sol";

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

    address public immutable treasury;
    uint128 public immutable poolId;
    address public immutable collateralToken;
    IV3CoreProxy public immutable v3System;
    IOracleManagerProxy public immutable oracleManager;

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

    mapping(address => uint256) public availableDepositRewards;

    DepositRewardConfiguration[] public depositRewardConfigurations;

    mapping(uint128 => mapping(address => LoanInfo)) public depositRewards;

    // solhint-disable-next-line no-empty-blocks
    constructor(
        IV3CoreProxy v3SystemAddress,
        IOracleManagerProxy oracleManagerAddress,
        address treasuryAddress,
        uint128 v3PoolId,
        address collateralTokenAddress
    ) Ownable(ERC2771Context._msgSender()) {
        treasury = treasuryAddress;
        v3System = v3SystemAddress;
        oracleManager = oracleManagerAddress;
        poolId = v3PoolId;

        collateralToken = collateralTokenAddress;
    }

    /**
     * @inheritdoc ITreasuryMarket
     */
    function registerMarket() external override onlyOwner returns (uint128 newMarketId) {
        if (marketId != 0) {
            revert MarketAlreadyRegistered(marketId);
        }

        newMarketId = v3System.registerMarket(address(this));
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
    function reportedDebt(uint128 requestedMarketId) external view override returns (uint256 debt) {
        if (requestedMarketId != marketId) {
            return 0;
        }

        uint256 depositedDebt = v3System.getMarketCollateralValue(marketId);
        int256 totalDebt = artificialDebt + int256(depositedDebt);

        if (totalDebt < 0) {
            // from a logic perspective, this branch should not be possible. But we dont want a revert if somehow this was negative.
            return 0;
        }

        return uint256(totalDebt);
    }

    /**
     * @inheritdoc IMarket
     */
    function name(uint128) external pure override returns (string memory) {
        return "Treasury Market";
    }

    /**
     * @inheritdoc IMarket
     */
    function minimumCredit(
        uint128 /* requestedMarketId*/
    ) external view override returns (uint256 lockedAmount) {
        // we lock collateral here because it prevents any withdrawal of delegated collateral from the pool other than through `unsaddle`.
        return lockedCollateral;
    }

    function setTargetCRatio(uint256 ratio) external override onlyOwner {
        if (ratio <= v3System.getCollateralConfiguration(collateralToken).liquidationRatioD18) {
            revert ParameterError.InvalidParameter("ratio", "would cause liquidation");
        }

        targetCratio = ratio;
        emit TargetCRatioSet(ratio);

        _rebalance();
    }

    function saddle(uint128 accountId) external override {
        // get current position information
        (uint256 accountCollateral, uint256 accountCollateralValue, int256 accountDebt, ) = v3System
            .getPosition(accountId, poolId, collateralToken);

        if (accountCollateral == 0) {
            revert ParameterError.InvalidParameter("accountId", "not delegated to pool");
        }

        // get the actual collateralization of the pool now
        (, uint256 vaultCollateralValue) = v3System.getVaultCollateral(poolId, collateralToken);
        int256 vaultDebtValue = v3System.getVaultDebt(poolId, collateralToken);

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

        uint256 debtIncrease = uint256(targetDebt - accountDebt);

        artificialDebt += int256(debtIncrease);
        v3System.associateDebt(marketId, poolId, collateralToken, accountId, debtIncrease);

        // if a user has not been saddled before, any existing account debt becomes a loan on the user
        if (saddledCollateral[accountId] == 0) {
            if (accountDebt > 0) {
                loans[accountId] = LoanInfo(
                    uint64(block.timestamp),
                    debtDecayPower,
                    debtDecayTime,
                    accountDebt.toUint().to128()
                );
                emit LoanAdjusted(accountId, accountDebt.toUint(), 0);
            } else {
                // this depositor is eligible for possible rewards
                //DepositRewardConfiguration[] memory drc = depositRewardConfigurations;
                for (uint256 i = 0; i < depositRewardConfigurations.length; i++) {
                    DepositRewardConfiguration memory config = depositRewardConfigurations[i];
                    uint256 rewardAmount = accountCollateral
                        .mulDecimal(oracleManager.process(config.valueRatioOracle).price.toUint())
                        .mulDecimal(config.percent);
                    if (rewardAmount > availableDepositRewards[config.token]) {
                        revert InsufficientAvailableReward(
                            config.token,
                            rewardAmount,
                            availableDepositRewards[config.token]
                        );
                    }

                    // stack was too deep to set this as a local variable. annoying.
                    depositRewards[accountId][config.token] = LoanInfo(
                        uint64(block.timestamp),
                        config.power,
                        config.duration,
                        uint128(rewardAmount)
                    );

                    availableDepositRewards[config.token] -= rewardAmount;

                    emit DepositRewardIssued(
                        accountId,
                        config.token,
                        LoanInfo(
                            uint64(block.timestamp),
                            config.power,
                            config.duration,
                            rewardAmount.to128()
                        )
                    );
                }
            }
        }

        totalSaddledCollateral += accountCollateral - saddledCollateral[accountId];
        saddledCollateral[accountId] = accountCollateral;

        emit AccountSaddled(accountId, accountCollateral, debtIncrease);
    }

    function unsaddle(uint128 accountId) external override {
        if (saddledCollateral[accountId] == 0) {
            revert ParameterError.InvalidParameter("accountId", "not saddled");
        }

        address sender = ERC2771Context._msgSender();
        IERC721 accountToken = IERC721(v3System.getAccountTokenAddress());
        if (sender != accountToken.ownerOf(accountId)) {
            revert AccessError.Unauthorized(sender);
        }

        uint256 currentLoan = _loanedAmount(loans[accountId], block.timestamp);
        if (currentLoan > 0) {
            revert OutstandingLoan(accountId, currentLoan);
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

            if (int256(neededToRepay) > artificialDebt) {
                revert InsufficientExcessDebt(int256(neededToRepay), artificialDebt);
            }

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

        _rebalance();

        // distribute any deposit rewards to the user's account
        uint256 timestamp = block.timestamp;
        for (uint256 i = 0; i < depositRewardConfigurations.length; i++) {
            DepositRewardConfiguration memory config = depositRewardConfigurations[i];
            LoanInfo memory userDepositReward = depositRewards[accountId][config.token];
            if (userDepositReward.loanAmount > 0) {
                uint256 penaltyPaid = _repaymentPenalty(
                    userDepositReward,
                    0,
                    _currentPenaltyRate(
                        userDepositReward,
                        config.penaltyStart,
                        config.penaltyEnd,
                        timestamp
                    ),
                    timestamp
                );

                uint256 receivedAmount = userDepositReward.loanAmount -
                    _loanedAmount(userDepositReward, timestamp) -
                    penaltyPaid;

                if (receivedAmount > 0) {
                    v3System.withdrawMarketCollateral(marketId, config.token, receivedAmount);
                    v3System.deposit(accountId, config.token, receivedAmount);

                    emit DepositRewardRedeemed(
                        accountId,
                        config.token,
                        receivedAmount,
                        penaltyPaid
                    );
                }

                // return any rewards not received to the available deposit rewards
                availableDepositRewards[config.token] +=
                    userDepositReward.loanAmount -
                    receivedAmount;
            }
        }

        // return the account token to the user. we use the "unsafe" call here because the account is being returned to the same address
        // it came from, so its probably ok and the account will be able to handle receipt of the NFT.
        accountToken.transferFrom(address(this), sender, accountId);
    }

    function repaymentPenalty(
        uint128 accountId,
        uint256 targetLoan
    ) external view override returns (uint256) {
        LoanInfo memory loan = loans[accountId];
        uint256 timestamp = block.timestamp;
        return
            _repaymentPenalty(
                loan,
                targetLoan,
                _currentPenaltyRate(loan, debtDecayPenaltyStart, debtDecayPenaltyEnd, timestamp),
                timestamp
            );
    }

    function adjustLoan(uint128 accountId, uint256 amount) external override {
        address sender = ERC2771Context._msgSender();
        if (sender != IERC721(v3System.getAccountTokenAddress()).ownerOf(accountId)) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }

        LoanInfo memory loan = loans[accountId];
        uint256 timestamp = block.timestamp;
        uint256 currentLoan = _loanedAmount(loan, timestamp);

        if (amount > currentLoan) {
            revert ParameterError.InvalidParameter("amount", "must be less than current loan");
        } else if (amount < currentLoan) {
            uint256 penaltyAmount = _repaymentPenalty(
                loan,
                amount,
                _currentPenaltyRate(loan, debtDecayPenaltyStart, debtDecayPenaltyEnd, timestamp),
                timestamp
            );
            // apply a penalty on whatever is repaid

            v3System.depositMarketUsd(marketId, sender, currentLoan - amount + penaltyAmount);
            _rebalance();
        } else {
            return; // nothing to do
        }

        // fractionally modify the original loan amount--this will continue the repayment schedule where the user left off without resetting it
        loans[accountId].loanAmount = ((loans[accountId].loanAmount * amount) / currentLoan)
            .to128();

        emit LoanAdjusted(accountId, amount, currentLoan);
    }

    function loanedAmount(uint128 accountId) external view override returns (uint256) {
        return _loanedAmount(loans[accountId], block.timestamp);
    }

    function depositRewardAvailable(
        uint128 accountId,
        address rewardTokenAddress
    ) external view override returns (uint256) {
        return
            depositRewards[accountId][rewardTokenAddress].loanAmount -
            _loanedAmount(depositRewards[accountId][rewardTokenAddress], block.timestamp);
    }

    function setDebtDecayFunction(
        uint32 power,
        uint32 time,
        uint128 startPenalty,
        uint128 endPenalty
    ) external override onlyOwner {
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

        emit DebtDecayUpdated(power, time, startPenalty, endPenalty);
    }

    function setDepositRewardConfigurations(
        DepositRewardConfiguration[] memory newDrcs
    ) external override onlyOwner {
        address previousDrc = address(0);

        DepositRewardConfiguration[] memory oldDrcs = depositRewardConfigurations;

        uint256 j;
        for (uint256 i = 0; i < newDrcs.length; i++) {
            if (newDrcs[i].token <= previousDrc) {
                revert ParameterError.InvalidParameter("newDrcs", "token address must increase");
            }
            previousDrc = newDrcs[i].token;

            // detect tokens that are being removed
            while (j < oldDrcs.length && newDrcs[i].token > oldDrcs[j].token) {
                // removing a reward token from the market
                // verify that this token is not having any available rewards
                if (availableDepositRewards[oldDrcs[j].token] > 0) {
                    revert ParameterError.InvalidParameter(
                        "newDrcs",
                        "removes existing reward token"
                    );
                }

                j++;
            }

            if (
                j < depositRewardConfigurations.length &&
                newDrcs[i].token == depositRewardConfigurations[j].token
            ) {
                j++;
            }

            if (depositRewardConfigurations.length <= i) {
                depositRewardConfigurations.push();
            }
            depositRewardConfigurations[i] = newDrcs[i];

            // ensure that the v3 core system can pull funds from us
            IERC20(newDrcs[i].token).approve(address(v3System), type(uint256).max);
        }

        for (; j < oldDrcs.length; j++) {
            // removing a reward token from the market
            // verify that this token is not having any available rewards
            if (availableDepositRewards[oldDrcs[j].token] > 0) {
                revert ParameterError.InvalidParameter("newDrcs", "removes existing reward token");
            }
        }

        uint256 popped = depositRewardConfigurations.length - newDrcs.length;
        for (uint256 i = 0; i < popped; i++) {
            depositRewardConfigurations.pop();
        }
    }

    function rebalance() external override {
        _rebalance();
    }

    function fundForDepositReward(
        address token,
        uint256 amount
    ) external override returns (uint256) {
        IERC20(token).transferFrom(ERC2771Context._msgSender(), address(this), amount);
        v3System.depositMarketCollateral(marketId, token, amount);
        availableDepositRewards[token] += amount;

        return availableDepositRewards[token];
    }

    function removeFromDepositReward(
        address token,
        uint256 amount
    ) external override onlyTreasury returns (uint256) {
        if (availableDepositRewards[token] < amount) {
            revert ParameterError.InvalidParameter("amount", "greater than available rewards");
        }
        v3System.withdrawMarketCollateral(marketId, token, amount);
        IERC20(token).transfer(ERC2771Context._msgSender(), amount);

        availableDepositRewards[token] -= amount;

        return availableDepositRewards[token];
    }

    function mintTreasury(uint256 amount) external override onlyTreasury {
        if (amount > uint256(artificialDebt)) {
            revert InsufficientExcessDebt(int256(amount), artificialDebt);
        }

        v3System.withdrawMarketUsd(marketId, treasury, amount);
        emit TreasuryMinted(amount);
        _rebalance();
    }

    function burnTreasury(uint256 amount) external override onlyTreasury {
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
            interfaceId == type(IERC721Receiver).interfaceId ||
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
        if (totalSaddledCollateral == 0) {
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

    function _loanedAmount(
        LoanInfo memory loan,
        uint256 timestamp
    ) internal pure returns (uint256) {
        if (loan.power == 0 || timestamp <= loan.startTime) {
            return loan.loanAmount;
        } else if (timestamp >= loan.startTime + loan.duration) {
            return 0;
        }

        // this function is a polynomial decay
        // model if `power` is 2 and `duration` is 365 https://www.wolframalpha.com/input?i=graph+1-%28x%2F365%29%5E2+from+0+to+365
        return
            loan.loanAmount -
            uint256(loan.loanAmount).mulDecimal(
                _decimalPow((timestamp - loan.startTime).divDecimal(loan.duration), loan.power)
            );
    }

    function _repaymentPenalty(
        LoanInfo memory loan,
        uint256 targetLoan,
        uint256 currentPenalty,
        uint256 timestamp
    ) internal pure returns (uint256) {
        uint256 currentLoan = _loanedAmount(loan, timestamp);
        if (targetLoan >= currentLoan || currentPenalty == 0) {
            return 0;
        }

        uint256 loanCompletionPercentage = loan.duration > 0
            ? (timestamp - loan.startTime).divDecimal(loan.duration)
            : 1 ether;

        // the penalty subtracts a certain percentage from what has been decayed. for example, assuming 25% penalty:
        // 1. starting with a $1000 loan over 40 days
        // 2. 16 days in, it decays to a $600 loan
        // 3. At 16 days in, user chooses to repay half. so $300 of the loan should remain
        // 4. The penalty is 25% at time of repayment, so 25% $400 is $100, so this plus the amount of the principal
        // to repay ($300) for a total of $400 is paid in total to repay $300
        if (loanCompletionPercentage < 1 ether) {
            return
                (loan.loanAmount - currentLoan).mulDecimal(currentPenalty).mulDecimal(
                    1 ether - targetLoan.divDecimal(currentLoan)
                );
        }

        return 0;
    }

    function _currentPenaltyRate(
        LoanInfo memory loan,
        uint256 penaltyStart,
        uint256 penaltyEnd,
        uint256 timestamp
    ) internal pure returns (uint256) {
        uint256 loanCompletionPercentage = loan.duration > 0
            ? (timestamp - loan.startTime).divDecimal(loan.duration)
            : 0;

        if (loanCompletionPercentage >= 1 ether) {
            return penaltyEnd;
        }

        return
            uint256(penaltyStart).mulDecimal(1 ether - loanCompletionPercentage) +
            uint256(penaltyEnd).mulDecimal(loanCompletionPercentage);
    }

    modifier onlyTreasury() {
        // solhint-disable-next-line meta-transactions/no-msg-sender
        if (msg.sender != treasury) {
            // solhint-disable-next-line meta-transactions/no-msg-sender
            revert AccessError.Unauthorized(msg.sender);
        }

        _;
    }
}
