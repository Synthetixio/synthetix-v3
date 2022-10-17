//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "../../interfaces/external/IRewardDistributor.sol";

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
        _mint(recipient, amount);
    }

    // permissionless payout for convenience testing
    function payout(
        uint128,
        address,
        address to,
        uint amount
    ) external returns (bool) {
        _mint(to, amount);
        return true;
    }
}
