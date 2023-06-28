//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IOrderModule {
    /* --- Order commitment/settlement --- */

    function commitOrder(int256 sizeDelta, uint256 desiredFillPrice, uint256 marketId) external;

    function settledOrder(address account) external;

    function cancelOrder(address account) external;

    /* --- Position liquidations --- */

    // function flagPosition(address account) external;

    // function liquidatePosition(address account) external;

    // function forceLiquidatePosition(address account) external;

    // function canLiquidate(address account) external view returns (bool);

    // function isFlagged(address account) external view returns (bool);

    /* --- Views --- */

    // function orderFee(int sizeDelta) external view returns (uint fee);

    /* --- Errors --- */

    /* --- Events --- */
}
