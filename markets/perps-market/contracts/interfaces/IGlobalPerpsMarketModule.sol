//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IGlobalPerpsMarketModule {
    function getMaxCollateralAmountsForSynthMarket(
        uint128 synthMarketId
    ) external view returns (uint);

    function getSynthDeductionPriorty() external view returns (uint128[] memory);

    function getMinLiquidationRewardUsd() external view returns (uint256);

    function getMaxLiquidationRewardUsd() external view returns (uint256);

    function setMaxCollateralForSynthMarketId(
        uint128 synthMarketId,
        uint collateralAmount
    ) external;

    function setSynthDeductionPriorty(uint128[] memory newSynthDeductionPriority) external;

    function setMinLiquidationRewardUsd(uint256 minLiquidationRewardUsd) external;

    function setMaxLiquidationRewardUsd(uint256 maxLiquidationRewardUsd) external;
}
