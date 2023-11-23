//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";
import {IRewardsManagerModule} from "@synthetixio/main/contracts/interfaces/IRewardsManagerModule.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {IERC20} from "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IPerpRewardDistributor} from "../../interfaces/IPerpRewardDistributor.sol";

// @see: https://github.com/Synthetixio/rewards-distributors
contract PerpRewardDistributor is Initializable, IPerpRewardDistributor {
    address private _rewardManager;
    address private _perpMarket;
    address private _token;
    string private _name;
    uint128 private _poolId;
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
        _rewardManager = rewardManager;
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
        OwnableStorage.onlyOwner();
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
    function payout(uint128, uint128, address, address sender, uint256 amount) external returns (bool) {
        onlyRewardManager();
        IERC20(_token).transfer(sender, amount);
        return !shouldFailPayout;
    }

    /**
     * @inheritdoc IRewardDistributor
     */
    function onPositionUpdated(uint128, uint128, address, uint256) external pure {}

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(IERC165) returns (bool) {
        return interfaceId == type(IRewardDistributor).interfaceId || interfaceId == this.supportsInterface.selector;
    }
}
