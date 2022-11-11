//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "../../interfaces/external/IRewardDistributor.sol";
import "../../interfaces/IRewardsManagerModule.sol";

contract CollateralMock is ERC20, IRewardDistributor {
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public {
        _initialize(tokenName, tokenSymbol, tokenDecimals);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function mint(address recipient, uint256 amount) external {
        // IMPORTANT: In production, this function should revert if msg.sender is not the Synthetix CoreProxy address.
        _mint(recipient, amount);
    }

    // permissionless payout for convenience testing
    function payout(
        uint128,
        uint128,
        address,
        address sender,
        uint amount
    ) external returns (bool) {
        _mint(sender, amount);
        return true;
    }

    function distributeRewards(
        address rewardManager,
        uint128 poolId,
        address collateralType,
        uint amount,
        uint start,
        uint duration
    ) public {
        IRewardsManagerModule(rewardManager).distributeRewards(poolId, collateralType, amount, start, duration);
    }
}
