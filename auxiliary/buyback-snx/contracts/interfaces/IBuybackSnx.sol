//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {IFeeCollector} from "@synthetixio/perps-market/contracts/interfaces/external/IFeeCollector.sol";

interface IBuybackSnx is IFeeCollector {
    /**
     * @notice  .This function is callable by any party with snx willing to sell at market price + premium.
     * @dev     .The purchased snx is transferred directly to the treasury.
     * @param   snxAmount  .amount of snx to purchase
     */
    function buySnx(uint256 snxAmount) external;

    /**
     * @notice  .This function is called to transfer a given token to the treasury.
     * @dev     .Used to recover stuck tokens. Only the owner can call this.
     * @param   token  .token address
     * @param   amount  .amount of token to transfer
     */
    function sweep(address token, uint256 amount) external;

    // Setters
    function setTreasury(address newTreasury) external;
    function setPremium(uint256 newPremium) external;
    function setNodeId(bytes32 newNodeId) external;
}
