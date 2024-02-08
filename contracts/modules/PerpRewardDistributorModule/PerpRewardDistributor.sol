//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";
import {IPoolModule} from "@synthetixio/main/contracts/interfaces/IPoolModule.sol";
import {IRewardsManagerModule} from "@synthetixio/main/contracts/interfaces/IRewardsManagerModule.sol";
import {IERC20} from "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {ERC20Helper} from "@synthetixio/core-contracts/contracts/token/ERC20Helper.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IPerpRewardDistributor} from "../../interfaces/IPerpRewardDistributor.sol";

// @see: https://github.com/Synthetixio/rewards-distributors
contract PerpRewardDistributor is Initializable, IPerpRewardDistributor {
    using ERC20Helper for address;

    address private _rewardManager;
    address private _perpMarket;
    address private _token;
    string private _name;
    uint128 private _poolId;
    // TODO: Rename to delegatedCollateralTypes.
    address[] private _collateralTypes;
    bool public shouldFailPayout;

    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Throws `Unauthorized` when msg.sender is not the PerpMarketProxy.
     */
    function onlyPerpMarket() private view {
        if (msg.sender != _perpMarket) {
            revert AccessError.Unauthorized(msg.sender);
        }
    }

    /**
     * @dev Throws `Unauthorized` when msg.sender is not the RewardManagerProxy.
     */
    function onlyRewardManager() private view {
        if (msg.sender != _rewardManager) {
            revert AccessError.Unauthorized(msg.sender);
        }
    }

    /**
     * @dev Throwns `Unauthorized` when msg.sender is not the `poolId` pool owner.
     */
    function onlyPoolOwner() private view {
        if (msg.sender != IPoolModule(_rewardManager).getPoolOwner(_poolId)) {
            revert AccessError.Unauthorized(msg.sender);
        }
    }

    /**
     * @inheritdoc IPerpRewardDistributor
     */
    function initialize(
        address rewardManager,
        address perpMarket,
        uint128 poolId_,
        address[] calldata collateralTypes_,
        address token_,
        string memory name_
    ) external initializer {
        _rewardManager = rewardManager; // CoreProxy
        _perpMarket = perpMarket;
        _poolId = poolId_;
        _collateralTypes = collateralTypes_;
        _token = token_;
        _name = name_;
    }

    /**
     * @inheritdoc IPerpRewardDistributor
     */
    function distributeRewards(address collateralType, uint256 amount) external {
        onlyPerpMarket();
        IRewardsManagerModule(_rewardManager).distributeRewards(
            _poolId,
            collateralType,
            amount,
            uint64(block.timestamp),
            0
        );
    }

    /**
     * @inheritdoc IPerpRewardDistributor
     */
    function getPoolId() external view returns (uint128) {
        return _poolId;
    }

    /**
     * @inheritdoc IPerpRewardDistributor
     */
    function getCollateralTypes() external view returns (address[] memory) {
        return _collateralTypes;
    }

    /**
     * @inheritdoc IPerpRewardDistributor
     */
    function setShouldFailPayout(bool _shouldFailedPayout) external {
        onlyPoolOwner();
        shouldFailPayout = _shouldFailedPayout;
    }

    // --- IRewardDistributor Requirements --- //

    /**
     * @inheritdoc IRewardDistributor
     */
    function name() public view override returns (string memory) {
        return _name;
    }

    /**
     * @inheritdoc IRewardDistributor
     */
    function token() public view override returns (address) {
        return _token;
    }

    /**
     * @inheritdoc IRewardDistributor
     */
    function payout(
        uint128,
        uint128 poolId,
        address token_,
        address sender, // claimRewards
        uint256 amount
    ) external returns (bool) {
        if (shouldFailPayout) {
            return false;
        }
        if (poolId != _poolId) {
            revert ParameterError.InvalidParameter("poolId", "Unexpected poolId");
        }
        if (token_ != _token) {
            revert ParameterError.InvalidParameter("token", "Unexpected token");
        }

        onlyRewardManager();

        _token.safeTransfer(sender, amount);

        return true;
    }

    /**
     * @inheritdoc IRewardDistributor
     */
    function onPositionUpdated(uint128, uint128, address, uint256) external pure {}

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(IERC165) returns (bool) {
        return interfaceId == type(IRewardDistributor).interfaceId || interfaceId == this.supportsInterface.selector;
    }
}
