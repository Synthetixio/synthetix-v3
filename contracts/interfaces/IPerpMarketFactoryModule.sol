//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IMarket} from "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import {IPyth} from "../external/pyth/IPyth.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";

interface IPerpMarketFactoryModule is IMarket {
    // --- Structs --- //

    struct CreatePerpMarketParameters {
        bytes32 name;
    }

    struct MarketDigest {
        bytes32 name;
        int128 skew;
        uint128 size;
        uint256 oraclePrice;
        int256 fundingVelocity;
        int256 fundingRate;
        uint256 lastLiquidationTime;
        uint256 remainingLiquidatableSizeCapacity;
    }

    // --- Events --- //

    event MarketCreated(uint128 id, bytes32 name);

    // --- Mutative --- //

    /**
     * @dev Stores a reference to the Synthetix core system.
     */
    function setSynthetix(ISynthetixSystem synthetix) external;

    /**
     * @dev Stores a reference to the Pyth EVM contract.
     */
    function setPyth(IPyth pyth) external;

    /**
     * @dev Stores a reference to the ETH/USD oracle node.
     */
    function setEthOracleNodeId(bytes32 nodeId) external;

    /**
     * @dev Registers a new PerpMarket with Synthetix and initializes storage.
     */
    function createMarket(IPerpMarketFactoryModule.CreatePerpMarketParameters memory data) external returns (uint128);

    // --- Views --- //

    /**
     * @dev Returns a digest of a market given the `marketId`.
     */
    function getMarketDigest(uint128 marketId) external view returns (IPerpMarketFactoryModule.MarketDigest memory);
}
