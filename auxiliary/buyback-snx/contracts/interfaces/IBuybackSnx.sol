//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {IFeeCollector} from "@synthetixio/perps-market/contracts/interfaces/external/IFeeCollector.sol";

interface IBuybackSnx is IFeeCollector {
    /**
     * @notice  .This function is callable by any party with snx willing to sell at market price + premium.
     * @dev     .The purchased snx is transferred directly to the proxy address which is effectively burnt.
     * @param   snxAmount  .amount of snx to purchase
     */
    function buyback(uint256 snxAmount) external;
}
