// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import "../interfaces/IRewardsManagerModule.sol";
import "../interfaces/external/IRewardDistributor.sol";

contract RewardDistributorMock is IRewardDistributor {
    address private _rewardManager;
    address private _token;
    string private _name;

    bool public shouldFailPayout;

    function initialize(address rewardManager, address token_, string memory name_) public {
        _rewardManager = rewardManager;
        _token = token_;
        _name = name_;
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    function token() public view override returns (address) {
        return _token;
    }

    function setShouldFailPayout(bool fail) external {
        shouldFailPayout = fail;
    }

    function payout(
        uint128,
        uint128,
        address,
        address sender,
        uint256 amount
    ) external returns (bool) {
        // IMPORTANT: In production, this function should revert if ERC2771Context._msgSender() is not the Synthetix CoreProxy address.
        if (ERC2771Context._msgSender() != _rewardManager) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }
        IERC20(_token).transfer(sender, amount);
        return !shouldFailPayout;
    }

    function distributeRewards(
        uint128 poolId,
        address collateralType,
        uint256 amount,
        uint64 start,
        uint32 duration
    ) public {
        IRewardsManagerModule(_rewardManager).distributeRewards(
            poolId,
            collateralType,
            amount,
            start,
            duration
        );
    }

    function onPositionUpdated(uint128, uint128, address, uint256) external pure {
        return;
    }

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
