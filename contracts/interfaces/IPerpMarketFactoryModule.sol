//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

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
        int256 currentFundingRate;
        uint256 lastLiquidationTime;
        uint256 remainingLiquidatableSizeCapacity;
    }

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
