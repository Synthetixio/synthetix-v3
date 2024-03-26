//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";
import {IPoolModule} from "@synthetixio/main/contracts/interfaces/IPoolModule.sol";
import {IRewardsManagerModule} from "@synthetixio/main/contracts/interfaces/IRewardsManagerModule.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {ERC20Helper} from "@synthetixio/core-contracts/contracts/token/ERC20Helper.sol";
import {ERC20} from "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IPerpRewardDistributor} from "../../interfaces/IPerpRewardDistributor.sol";

/* solhint-disable meta-transactions/no-msg-sender */

contract PerpRewardDistributor is Initializable, IPerpRewardDistributor {
    using ERC20Helper for address;

    /// @notice Address of the RewardManager (i.e. Synthetix core proxy)
    address private _rewardManager;
    /// @notice Address the BFP market proxy.
    address private _perpMarket;
    /// @notice Address of the reward token to distribute.
    address private _payoutToken;
    /// @notice User defined name of this reward distributor.
    string private _name;
    /// @notice Pool this distributor is registered against.
    uint128 private _poolId;
    /// @notice Delegated pool collateral addresses at the point of distributor init.
    address[] private _poolCollateralTypes;
    /// @notice Internal counter to track distributed/payout reward tokens.
    uint256 private _rewardsAmount;
    /// @notice Flag to enable or disable payouts.
    bool public shouldFailPayout;

    constructor() {
        _disableInitializers();
    }

    /// @inheritdoc IPerpRewardDistributor
    function initialize(
        address rewardManager,
        address perpMarket,
        uint128 poolId_,
        address[] calldata poolCollateralTypes_,
        address payoutToken_,
        string memory name_
    ) external initializer {
        _rewardManager = rewardManager; // CoreProxy
        _perpMarket = perpMarket;
        _poolId = poolId_;
        _poolCollateralTypes = poolCollateralTypes_;
        _payoutToken = payoutToken_;
        _name = name_;

        // Verify the `payoutToken` on init has exactly 18 decimals.
        (bool success, bytes memory data) = payoutToken_.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        if (!success || data.length == 0 || abi.decode(data, (uint8)) != 18) {
            revert ParameterError.InvalidParameter(
                "payoutToken",
                "Token decimals expected to be 18"
            );
        }
    }

    /// @inheritdoc IPerpRewardDistributor
    function distributeRewards(address collateralType, uint256 amount) external {
        onlyPerpMarket();

        uint256 currentRewardsAmount = _rewardsAmount;
        uint256 nextRewardsAmount = currentRewardsAmount + amount;

        // NOTE: Caller must `payoutToken.transfer(address(this), amount)` before calling distributeRewards.
        uint256 balance = ERC20(_payoutToken).balanceOf(address(this));
        if (nextRewardsAmount > balance) {
            revert InsufficientRewardBalance(amount, balance);
        }

        _rewardsAmount = nextRewardsAmount;

        IRewardsManagerModule(_rewardManager).distributeRewards(
            _poolId,
            collateralType,
            amount,
            // solhint-disable-next-line numcast/safe-cast
            uint64(block.timestamp),
            0
        );
    }

    /// @inheritdoc IPerpRewardDistributor
    function getPoolId() external view returns (uint128) {
        return _poolId;
    }

    /// @inheritdoc IPerpRewardDistributor
    function getPoolCollateralTypes() external view returns (address[] memory) {
        return _poolCollateralTypes;
    }

    /// @inheritdoc IPerpRewardDistributor
    function setShouldFailPayout(bool _shouldFailedPayout) external {
        onlyPoolOwner();
        shouldFailPayout = _shouldFailedPayout;
    }

    // --- IRewardDistributor requirements --- //

    /// @inheritdoc IRewardDistributor
    function name() public view override returns (string memory) {
        return _name;
    }

    /// @inheritdoc IRewardDistributor
    function token() public view override returns (address) {
        return _payoutToken;
    }

    /// @inheritdoc IRewardDistributor
    function payout(
        uint128,
        uint128 poolId,
        address,
        address payoutTarget_, // msg.sender that called `claimRewards`
        uint256 payoutAmount_
    ) external returns (bool) {
        if (shouldFailPayout) {
            return false;
        }
        if (poolId != _poolId) {
            revert ParameterError.InvalidParameter("poolId", "Unexpected poolId");
        }

        onlyRewardManager();

        uint256 currentRewardsAmount = _rewardsAmount;
        if (payoutAmount_ > currentRewardsAmount) {
            revert InsufficientRewardBalance(payoutAmount_, currentRewardsAmount);
        }
        _rewardsAmount = currentRewardsAmount - payoutAmount_;
        _payoutToken.safeTransfer(payoutTarget_, payoutAmount_);

        return true;
    }

    /// @inheritdoc IRewardDistributor
    function onPositionUpdated(uint128, uint128, address, uint256) external pure {}

    /// @inheritdoc IERC165
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IRewardDistributor).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }

    // --- Helpers --- //

    /// @dev Throws `Unauthorized` when msg.sender is not the PerpMarketProxy.
    function onlyPerpMarket() private view {
        if (msg.sender != _perpMarket) {
            revert AccessError.Unauthorized(msg.sender);
        }
    }

    /// @dev Throws `Unauthorized` when msg.sender is not the RewardManagerProxy.
    function onlyRewardManager() private view {
        if (msg.sender != _rewardManager) {
            revert AccessError.Unauthorized(msg.sender);
        }
    }

    /// @dev Throws `Unauthorized` when msg.sender is not the `poolId` pool owner.
    function onlyPoolOwner() private view {
        if (msg.sender != IPoolModule(_rewardManager).getPoolOwner(_poolId)) {
            revert AccessError.Unauthorized(msg.sender);
        }
    }
}
