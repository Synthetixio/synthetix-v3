// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {IERC721} from "@synthetixio/core-contracts/contracts/interfaces/IERC721.sol";
import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {ISnapshotRecord} from "@synthetixio/governance/contracts/interfaces/external/ISnapshotRecord.sol";
import {IAccountModule} from "@synthetixio/main/contracts/interfaces/IAccountModule.sol";
import {IVaultModule} from "@synthetixio/main/contracts/interfaces/IVaultModule.sol";

contract SnapshotRewardsDistributor is IRewardDistributor, ISnapshotRecord {
    error DebtShareNotFound();

    address private rewardsManager;
    IERC721 private accountToken;
    uint128 public servicePoolId;
    address public serviceCollateralType;

    struct PeriodBalance {
        uint128 amount;
        uint128 periodId;
        address owner;
    }

    /**
     * Addresses selected by owner which are allowed to call `takeSnapshot`
     * `takeSnapshot` is not public because only a small number of snapshots can be retained for a period of time, and so they
     * must be controlled to prevent censorship
     */
    mapping(address => bool) public authorizedToSnapshot;

    /**
     * Records a user's balance as it changes from period to period.
     * The last item in the array always represents the user's most recent balance
     * The intermediate balance is only recorded if
     * `currentPeriodId` differs (which would happen upon a call to `setCurrentPeriodId`)
     */
    mapping(uint128 => PeriodBalance[]) public balances;

    /**
     * Records totalSupply as it changes from period to period
     * Similar to `balances`, the `totalSupplyOnPeriod` at index `currentPeriodId` matches the current total supply
     * Any other period ID would represent its most recent totalSupply before the period ID changed.
     */
    mapping(uint256 => uint256) public totalSupplyOnPeriod;

    /**
     * Records the latest address to which account it is part of
     */
    mapping(address => PeriodBalance[]) private accountBalances;

    uint128 public currentPeriodId;

    uint256 internal constant MAX_PERIOD_ITERATE = 30;

    constructor(
        address _rewardsManager, // SynthetixCoreProxy
        uint128 _servicePoolId,
        address _serviceCollateralType,
        address snapper
    ) {
        servicePoolId = _servicePoolId;
        serviceCollateralType = _serviceCollateralType;
        rewardsManager = _rewardsManager;
        accountToken = IERC721(IAccountModule(rewardsManager).getAccountTokenAddress());
        authorizedToSnapshot[snapper] = true;
    }

    function onPositionUpdated(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint256 // actorSharesD18
    ) external {
        address sender = ERC2771Context._msgSender();
        if (sender != rewardsManager) {
            revert AccessError.Unauthorized(sender);
        }

        if (poolId != servicePoolId) {
            revert ParameterError.InvalidParameter(
                "poolId",
                "Pool does not match the rewards pool"
            );
        }

        if (collateralType != serviceCollateralType) {
            revert ParameterError.InvalidParameter(
                "collateralType",
                "Collateral does not match the rewards token"
            );
        }

        // get current account information
        uint256 newAmount = IVaultModule(rewardsManager).getPositionCollateral(
            accountId,
            poolId,
            collateralType
        );
        address account = accountToken.ownerOf(accountId);

        // ensure periods for all the values we will be updating are correct
        uint256 idIdx = updatePeriod(balances[accountId]);
        uint256 oldAccountIdx = updatePeriod(accountBalances[balances[accountId][idIdx].owner]);
        uint256 accountIdx = updatePeriod(accountBalances[account]);

        uint256 prevBalance = balances[accountId][accountIdx].amount;

        // subtract balance from previous owner
        accountBalances[balances[accountId][idIdx].owner][oldAccountIdx].amount -= uint128(
            prevBalance
        );

        // add balance to new owner
        accountBalances[account][accountIdx].amount += uint128(newAmount);

        // update account id record
        balances[accountId][idIdx].amount = uint128(newAmount);
        balances[accountId][idIdx].owner = account;

        totalSupplyOnPeriod[currentPeriodId] =
            totalSupplyOnPeriod[currentPeriodId] +
            newAmount -
            prevBalance;
    }

    function updatePeriod(PeriodBalance[] storage bals) internal returns (uint256) {
        uint256 balanceCount = bals.length;
        if (balanceCount == 0 || bals[balanceCount - 1].periodId != currentPeriodId) {
            bals.push(PeriodBalance(0, uint128(currentPeriodId), address(0)));

            if (balanceCount > 0) {
                bals[balanceCount].amount = bals[balanceCount - 1].amount;
                bals[balanceCount].owner = bals[balanceCount - 1].owner;
            }

            balanceCount++;
        }

        return balanceCount - 1;
    }

    function balanceOfOnPeriod(address account, uint256 periodId) public view returns (uint256) {
        uint256 accountPeriodHistoryCount = accountBalances[account].length;

        int256 oldestHistoryIterate = int256(
            MAX_PERIOD_ITERATE < accountPeriodHistoryCount
                ? accountPeriodHistoryCount - MAX_PERIOD_ITERATE
                : 0
        );
        int256 i;
        for (i = int256(accountPeriodHistoryCount) - 1; i >= oldestHistoryIterate; i--) {
            if (accountBalances[account][uint256(i)].periodId <= periodId) {
                return uint256(accountBalances[account][uint256(i)].amount);
            }
        }

        if (i >= 0) {
            revert DebtShareNotFound();
        }

        return 0;
    }

    function balanceOfOnPeriod(uint128 accountId, uint256 periodId) public view returns (uint256) {
        uint256 accountPeriodHistoryCount = balances[accountId].length;

        int256 oldestHistoryIterate = int256(
            MAX_PERIOD_ITERATE < accountPeriodHistoryCount
                ? accountPeriodHistoryCount - MAX_PERIOD_ITERATE
                : 0
        );
        int256 i;
        for (i = int256(accountPeriodHistoryCount) - 1; i >= oldestHistoryIterate; i--) {
            if (balances[accountId][uint256(i)].periodId <= periodId) {
                return uint256(balances[accountId][uint256(i)].amount);
            }
        }

        if (i >= 0) {
            revert DebtShareNotFound();
        }

        return 0;
    }

    function balanceOf(uint128 accountId) external view returns (uint256) {
        return balanceOfOnPeriod(accountId, currentPeriodId);
    }

    function balanceOf(address user) external view returns (uint256) {
        return balanceOfOnPeriod(user, currentPeriodId);
    }

    function totalSupply() external view returns (uint256) {
        return totalSupplyOnPeriod[currentPeriodId];
    }

    function takeSnapshot(uint128 id) external {
        address sender = ERC2771Context._msgSender();
        if (!authorizedToSnapshot[sender]) {
            revert AccessError.Unauthorized(sender);
        }
        if (id <= currentPeriodId) {
            revert ParameterError.InvalidParameter("id", "period id must always increase");
        }
        totalSupplyOnPeriod[id] = totalSupplyOnPeriod[currentPeriodId];
        currentPeriodId = id;
    }

    function payout(
        uint128, // accountId
        uint128, // poolId_
        address, // collateralType_
        address, // payoutTarget_
        uint256 // payoutAmount_
    ) external pure returns (bool) {
        // this is not a rewards distributor that pays out any tokens
        return true;
    }

    function name() public pure override returns (string memory) {
        return "snapshot tracker for governance";
    }

    function token() public pure override returns (address) {}

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IRewardDistributor).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
