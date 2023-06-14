pragma solidity >=0.8.11 <0.9.0;

interface ILiquidatorRewards {
    // Views

    function earned(address account) external view returns (uint256);

    // Mutative

    function getReward(address account) external;

    function notifyRewardAmount(uint256 reward) external;

    function updateEntry(address account) external;
}
