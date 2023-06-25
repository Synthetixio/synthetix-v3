//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IGlobalPerpsMarketModule {
    event MaxCollateralAmountSet(uint128 indexed synthMarketId, uint256 collateralAmount);
    event SynthDeductionPrioritySet(uint128[] newSynthDeductionPriority);
    event LiquidationRewardGuardsSet(
        uint256 indexed minLiquidationRewardUsd,
        uint256 indexed maxLiquidationRewardUsd
    );

    function getMaxCollateralAmount(uint128 synthMarketId) external view returns (uint);

    function setMaxCollateralAmount(uint128 synthMarketId, uint collateralAmount) external;

    function setSynthDeductionPriority(uint128[] memory newSynthDeductionPriority) external;

    function getSynthDeductionPriority() external view returns (uint128[] memory);

    function setLiquidationRewardGuards(
        uint256 minLiquidationRewardUsd,
        uint256 maxLiquidationRewardUsd
    ) external;

    function getLiquidationRewardGuards()
        external
        view
        returns (uint256 minLiquidationRewardUsd, uint256 maxLiquidationRewardUsd);
}
