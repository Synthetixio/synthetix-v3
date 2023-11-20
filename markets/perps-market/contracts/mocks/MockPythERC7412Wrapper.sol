//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

contract MockPythERC7412Wrapper {
    bool public alwaysRevert;
    int256 public price;

    error OracleDataRequired(bytes32 priceId, uint64 requestedTime);

    function setBenchmarkPrice(int256 _price) external {
        price = _price;
        alwaysRevert = false;
    }

    function setAlwaysRevertFlag(bool _alwaysRevert) external {
        alwaysRevert = _alwaysRevert;
    }

    function getBenchmarkPrice(
        bytes32 priceId,
        uint64 requestedTime
    ) external view returns (int256) {
        if (alwaysRevert) {
            revert OracleDataRequired(priceId, requestedTime);
        }

        return price;
    }
}
