//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IMarket} from "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import {IPyth} from "../external/pyth/IPyth.sol";

interface IPerpMarketFactoryModule is IMarket {
    // --- Structs --- //

    struct CreatePerpMarketParameters {
        bytes32 name;
    }

    // --- Mutative --- //

    /**
     * @dev Initializes references to the Synthetix core system.
     */
    function setSynthetix(ISynthetixSystem synthetix) external;

    /**
     * @dev Stores a reference to the Pyth EVM contract.
     */
    function setPyth(IPyth pyth) external;

    /**
     * @dev Registers a new PerpMarket with Synthetix and initializes storage.
     */
    function create(IPerpMarketFactoryModule.CreatePerpMarketParameters memory data) external returns (uint128 id);
}
