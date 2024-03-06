//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IMarket} from "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import {ISpotMarketSystem} from "../external/ISpotMarketSystem.sol";
import {IPyth} from "../external/pyth/IPyth.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {IBasePerpMarket} from "./IBasePerpMarket.sol";

interface IPerpMarketFactoryModule is IMarket, IBasePerpMarket {
    // --- Structs --- //

    struct CreatePerpMarketParameters {
        // Name of the market to be created e.g, ETHPERP
        bytes32 name;
    }

    struct DepositedCollateral {
        // Id of the spot synth market collateral.
        uint128 synthMarketId;
        // Amount of available collateral deposited (unrelated to position).
        uint256 available;
    }

    struct MarketDigest {
        // Array of supported collaterals and amounts.
        IPerpMarketFactoryModule.DepositedCollateral[] depositedCollaterals;
        // Name of the market e.g, swstETHsUSDPERP.
        bytes32 name;
        // Skew in native units on market (long - shorts).
        int128 skew;
        // Market OI in native units.
        uint128 size;
        // Current oracle price (not accounting for pd adjustments).
        uint256 oraclePrice;
        // Current rate of funding velocity.
        int256 fundingVelocity;
        // Current funding rate as a function of funding velocity.
        int256 fundingRate;
        // Current utilization rate
        uint256 utilizationRate;
        // Amount of size remaining last recorded in current window.
        uint256 remainingLiquidatableSizeCapacity;
        // block.timestamp of when the last liqudation had occurred.
        uint128 lastLiquidationTime;
        // All traders unsettled debt in USD.
        uint128 totalTraderDebtUsd;
        // Total value in USD of all market depositedCollateral if sold on spot.
        uint256 totalCollateralValueUsd;
        // Most recently calculated debt entry for reportedDebt calc.
        int128 debtCorrection;
    }

    // --- Events --- //

    // @notice Emitted when a market is created.
    event MarketCreated(uint128 id, bytes32 name);

    // --- Mutations --- //

    /**
     * @notice Stores a reference to the Synthetix core system.
     */
    function setSynthetix(ISynthetixSystem synthetix) external;

    /**
     * @notice Stores a reference to the Synthetix spot market system.
     */
    function setSpotMarket(ISpotMarketSystem spotMarket) external;

    /**
     * @notice Stores a reference to the Pyth EVM contract.
     */
    function setPyth(IPyth pyth) external;

    /**
     * @notice Stores a reference to the ETH/USD oracle node.
     */
    function setEthOracleNodeId(bytes32 nodeId) external;

    /**
     * @notice Stores the address of a base perp reward distributor contract.
     */
    function setRewardDistributorImplementation(address implementation) external;

    /**
     * @notice Registers a new PerpMarket with Synthetix and initializes storage.
     */
    function createMarket(
        IPerpMarketFactoryModule.CreatePerpMarketParameters memory data
    ) external returns (uint128);

    // --- Views --- //

    /**
     * @notice Returns a digest of an existing market given the `marketId`.
     */
    function getMarketDigest(
        uint128 marketId
    ) external view returns (IPerpMarketFactoryModule.MarketDigest memory);

    /**
     * @notice Returns all market ids in the system
     */
    function getActiveMarketIds() external view returns (uint128[] memory);

    /**
     * @notice Recomputes utlisation rate for a given market
     */
    function recomputeUtilization(uint128 marketId) external;

    /**
     * @notice Recomputes funding rate for a given market
     */
    function recomputeFunding(uint128 marketId) external;
}
