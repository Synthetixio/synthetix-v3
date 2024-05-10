//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IMarket} from "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import {IPyth} from "@synthetixio/oracle-manager/contracts/interfaces/external/IPyth.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {IBasePerpMarket} from "./IBasePerpMarket.sol";

interface IPerpMarketFactoryModule is IMarket, IBasePerpMarket {
    // --- Structs --- //

    struct CreatePerpMarketParameters {
        /// Name of the market to be created e.g, ETHPERP
        bytes32 name;
    }

    struct DepositedCollateral {
        /// Address of the collateral.
        address collateralAddress;
        /// Amount of available collateral deposited (unrelated to position).
        uint256 available;
    }

    struct UtilizationDigest {
        /// Last computed utilization rate.
        uint256 lastComputedUtilizationRate;
        /// Timestamp of last computed utilization rate.
        uint256 lastComputedTimestamp;
        /// The current instantaneous utilization rate.
        uint256 currentUtilizationRate;
        /// The current instantaneous collateral utilization.
        uint256 utilization;
    }

    struct MarketDigest {
        /// Array of supported collaterals and amounts.
        IPerpMarketFactoryModule.DepositedCollateral[] depositedCollaterals;
        /// Name of the market e.g, swstETHsUSDPERP.
        bytes32 name;
        /// Skew in native units on market (long - shorts).
        int128 skew;
        /// Market OI in native units.
        uint128 size;
        /// Current oracle price (not accounting for pd adjustments).
        uint256 oraclePrice;
        /// Current rate of funding velocity.
        int256 fundingVelocity;
        /// Current funding rate as a function of funding velocity.
        int256 fundingRate;
        /// Current utilization rate
        uint256 utilizationRate;
        /// Amount of size remaining last recorded in current window.
        uint256 remainingLiquidatableSizeCapacity;
        /// block.timestamp of when the last liqudation had occurred.
        uint128 lastLiquidationTime;
        /// All traders unsettled debt in USD.
        uint128 totalTraderDebtUsd;
        /// Total value in USD of all market depositedCollateral if sold on spot.
        uint256 totalCollateralValueUsd;
        /// Most recently calculated debt entry for reportedDebt calc.
        int128 debtCorrection;
    }

    // --- Events --- //

    /// @notice Emitted when a market is created.
    /// @param id Id of market
    /// @param name Name of market
    event MarketCreated(uint128 indexed id, bytes32 name);

    // --- Mutations --- //

    /// @notice Stores a reference to the Synthetix core system.
    /// @param synthetix Address of core Synthetix proxy
    function setSynthetix(ISynthetixSystem synthetix) external;

    /// @notice Stores a reference to the Pyth EVM contract.
    /// @param pyth Address of Pyth verification contract
    function setPyth(IPyth pyth) external;

    /// @notice Stores a reference to the ETH/USD oracle node.
    /// @param nodeId Id of ETH/USD oracle node
    function setEthOracleNodeId(bytes32 nodeId) external;

    /// @notice Stores the address of a base perp reward distributor contract.
    /// @param implementation Address of reward distributor implementation
    function setRewardDistributorImplementation(address implementation) external;

    /// @notice Registers a new PerpMarket with Synthetix and initializes storage.
    /// @param data A struct of parameters to create a market with
    /// @return createMarket Market id of newly created market
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

    /// @notice Returns a the utilization digest of an existing market given their `marketId`.
    /// @param marketId Market to query the digest against
    /// @return getUtilizationDigest Utilization digest struct
    function getUtilizationDigest(
        uint128 marketId
    ) external view returns (IPerpMarketFactoryModule.UtilizationDigest memory);

    /// @notice Returns all created market ids in the system.
    /// @return getActiveMarketIds An array of market ids
    function getActiveMarketIds() external view returns (uint128[] memory);

    /// @notice Recomputes utilization rate for a given market
    /// @param marketId Market to recompute against
    function recomputeUtilization(uint128 marketId) external;

    /// @notice Recomputes funding rate for a given market
    /// @param marketId Market to recompute against
    function recomputeFunding(uint128 marketId) external;
}
