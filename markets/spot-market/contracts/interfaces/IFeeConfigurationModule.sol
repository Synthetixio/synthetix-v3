//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Module for market-specific fee configuration
 */
interface IFeeConfigurationModule {
    /**
     * @notice emitted when market utilization fees are set for specified market
     * @param synthMarketId Id of the market to set the fees for.
     * @param utilizationFeeRate utilization fee rate for the corresponding market
     */
    event MarketUtilizationFeesSet(uint indexed synthMarketId, uint utilizationFeeRate);

    /**
     * @notice emitted when the skew scale is set for a market
     * @param synthMarketId Id of the market to set the fees for.
     * @param skewScale the skew scale set for the corresponding market
     */
    event MarketSkewScaleSet(uint indexed synthMarketId, uint skewScale);

    /**
     * @notice emitted when the fixed fee for atomic orders is set.
     * @param synthMarketId Id of the market to set the fees for.
     * @param atomicFixedFee the fixed fee for the corresponding market
     */
    event AtomicFixedFeeSet(uint indexed synthMarketId, uint atomicFixedFee);

    /**
     * @notice emitted when the fixed fee for async orders is set.
     * @param synthMarketId Id of the market to set the fees for.
     * @param asyncFixedFee the fixed fee for the corresponding market
     */
    event AsyncFixedFeeSet(uint indexed synthMarketId, uint asyncFixedFee);

    /**
     * @notice emitted when the fixed fee for atomic orders is set for a given transactor
     * @param synthMarketId Id of the market to set the fees for.
     * @param transactor fixed fee for the transactor (overrides the global fixed fee)
     * @param fixedFeeAmount the fixed fee for the corresponding market, and transactor
     */
    event TransactorFixedFeeSet(
        uint indexed synthMarketId,
        address transactor,
        uint fixedFeeAmount
    );

    /**
     * @notice emitted when custom fee collector is set for a given market
     * @param synthMarketId Id of the market to set the collector for.
     * @param feeCollector the address of the fee collector to set.
     */
    event FeeCollectorSet(uint indexed synthMarketId, address feeCollector);

    /**
     * @notice emitted when wrapper fees are set for a given market
     * @param synthMarketId Id of the market to set the wrapper fees.
     * @param wrapFee wrapping fee in %, 18 decimals. Can be negative.
     * @param unwrapFee unwrapping fee in %, 18 decimals. Can be negative.
     */
    event WrapperFeesSet(uint indexed synthMarketId, int wrapFee, int unwrapFee);

    /**
     * @notice Thrown when the fee collector does not implement the IFeeCollector interface
     */
    error InvalidFeeCollectorInterface(address invalidFeeCollector);

    /**
     * @notice sets the atomic fixed fee for a given market
     * @dev only marketOwner can set the fee
     * @param synthMarketId Id of the market the fee applies to.
     * @param atomicFixedFee fixed fee amount represented in bips with 18 decimals.
     */
    function setAtomicFixedFee(uint128 synthMarketId, uint atomicFixedFee) external;

    /**
     * @notice sets the async fixed fee for a given market
     * @dev only marketOwner can set the fee
     * @param synthMarketId Id of the market the fee applies to.
     * @param asyncFixedFee fixed fee amount represented in bips with 18 decimals.
     */
    function setAsyncFixedFee(uint128 synthMarketId, uint asyncFixedFee) external;

    /**
     * @notice sets the skew scale for a given market
     * @dev only marketOwner can set the skew scale
     * @param synthMarketId Id of the market the skew scale applies to.
     * @param skewScale max amount of synth which makes the skew 100%. the fee is derived as a % of the max value.  100% premium means outstanding synth == skewScale.
     */
    function setMarketSkewScale(uint128 synthMarketId, uint skewScale) external;

    /**
     * @notice sets the market utilization fee for a given market
     * @dev only marketOwner can set the fee
     * @dev 100% utilization means the fee is 0.  120% utilization means the fee is 20% * this fee rate (in bips).
     * @param synthMarketId Id of the market the utilization fee applies to.
     * @param utilizationFeeRate the rate is represented in bips with 18 decimals and is the rate at which fee increases based on the % above 100% utilization of the delegated collateral for the market.
     */
    function setMarketUtilizationFees(uint128 synthMarketId, uint utilizationFeeRate) external;

    /**
     * @notice sets the fixed fee for a given market and transactor
     * @dev overrides both the atomic and async fixed fees
     * @dev only marketOwner can set the fee
     * @dev especially useful for direct integrations where configured traders get a discount
     * @param synthMarketId Id of the market the custom transactor fee applies to.
     * @param transactor address of the trader getting discounted fees.
     * @param fixedFeeAmount the fixed fee applying to the provided transactor.
     */
    function setCustomTransactorFees(
        uint128 synthMarketId,
        address transactor,
        uint fixedFeeAmount
    ) external;

    /**
     * @notice sets a custom fee collector for a given market
     * @dev only marketOwner can set the fee collector
     * @dev a use case here would be if the market owner wants to collect the fees via this contract and distribute via rewards distributor to SNX holders for example.
     * @dev if fee collector is not set, the fees are deposited into the market manager.
     * @param synthMarketId Id of the market the fee collector applies to.
     * @param feeCollector address of the fee collector inheriting the IFeeCollector interface.
     */
    function setFeeCollector(uint128 synthMarketId, address feeCollector) external;

    /**
     * @notice sets wrapper related fees.
     * @dev only marketOwner can set the wrapper fees
     * @dev fees can be negative.  this is a way to unwind the wrapper if needed by providing incentives.
     * @param synthMarketId Id of the market the wrapper fees apply to.
     * @param wrapFee wrapping fee in %, 18 decimals. Can be negative.
     * @param unwrapFee unwrapping fee in %, 18 decimals. Can be negative.
     */
    function setWrapperFees(uint128 synthMarketId, int wrapFee, int unwrapFee) external;
}
