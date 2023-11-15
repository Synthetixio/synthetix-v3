//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";
import {IRewardsManagerModule} from "@synthetixio/main/contracts/interfaces/IRewardsManagerModule.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {IERC20} from "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {IPerpRewardDistributor} from "../../interfaces/IPerpRewardDistributor.sol";

// @see: https://github.com/Synthetixio/rewards-distributors
contract PerpRewardDistributor is IPerpRewardDistributor {
    address private _rewardManager;
    address private _token;
    string private _name;
    bool public shouldFailPayout;

    /**
     * @inheritdoc IPerpRewardDistributor
     */
    function initialize(address rewardManager, address token_, string memory name_) external {
        _rewardManager = rewardManager;
        _token = token_;
        _name = name_;
    }

    function setShouldFailPayout(bool fail) external {
        shouldFailPayout = fail;
    }

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
        // IMPORTANT: In production, this function should revert if msg.sender is not the Synthetix CoreProxy address.
        if (msg.sender != _rewardManager) {
            revert AccessError.Unauthorized(msg.sender);
        }
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

    /**
     * @inheritdoc IPerpRewardDistributor
     */
    function distributeRewards(uint128 poolId, address collateralType, uint256 amount) public {
        IRewardsManagerModule(_rewardManager).distributeRewards(
            poolId,
            collateralType,
            amount,
            uint64(block.timestamp),
            0
        );
    }
}
