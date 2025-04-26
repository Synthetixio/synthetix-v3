//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./interfaces/ITreasuryStakingRewards.sol";
import "./interfaces/ITreasuryMarket.sol";

import {UUPSImplementation} from "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";

/**
 * @notice Reports when money has been deposited to the treasury
 */
contract TreasuryStakingRewards is ITreasuryStakingRewards, UUPSImplementation, Ownable {
    address public immutable stakingToken;
    address public immutable recipient;
    ITreasuryMarket public immutable treasuryMarket;

    mapping(uint128 => uint256) public balanceOf;
    uint256 public totalDeposited;

    constructor(
        address _stakingToken,
        address _treasuryMarket,
        address _recipient
    ) Ownable(msg.sender) {
        stakingToken = _stakingToken;
        treasuryMarket = ITreasuryMarket(_treasuryMarket);
        recipient = _recipient;
    }

    function deposit(uint128 accountId, uint256 amount) external {
        IERC20(stakingToken).transferFrom(ERC2771Context._msgSender(), recipient, amount);
        totalDeposited += amount;
        balanceOf[accountId] += amount;
        treasuryMarket.reportAuxToken(accountId);
        emit Deposited(ERC2771Context._msgSender(), accountId, amount);
    }
    /* ========== EVENTS ========== */

    function upgradeTo(address to) external onlyOwner {
        _upgradeTo(to);
    }

    event Deposited(address indexed sender, uint128 indexed accountId, uint256 amount);
}
