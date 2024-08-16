// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "../interfaces/IOVM_GasPriceOracle.sol";

contract MockOVMGasPriceOracle is IOVM_GasPriceOracle {
    uint256 public constant DECIMALS = 6;

    uint256 public gasPrice;
    uint256 public overhead;
    uint256 public baseFee;
    uint256 public l1BaseFee;
    uint256 public scalar;
    uint256 public internall1GasUsed;
    uint256 public internall1Fee;

    constructor(
        uint256 _gasPrice,
        uint256 _overhead,
        uint256 _baseFee,
        uint256 _l1BaseFee,
        uint256 _scalar,
        uint256 _internall1GasUsed,
        uint256 _internall1Fee
    ) {
        gasPrice = _gasPrice;
        overhead = _overhead;
        baseFee = _baseFee;
        l1BaseFee = _l1BaseFee;
        scalar = _scalar;
        internall1GasUsed = _internall1GasUsed;
        internall1Fee = _internall1Fee;
    }

    function setParams(
        uint256 _gasPrice,
        uint256 _overhead,
        uint256 _baseFee,
        uint256 _l1BaseFee,
        uint256 _scalar,
        uint256 _internall1GasUsed,
        uint256 _internall1Fee
    ) external {
        gasPrice = _gasPrice;
        overhead = _overhead;
        baseFee = _baseFee;
        l1BaseFee = _l1BaseFee;
        scalar = _scalar;
        internall1GasUsed = _internall1GasUsed;
        internall1Fee = _internall1Fee;
    }

    function decimals() external pure returns (uint256) {
        return DECIMALS;
    }

    function getL1Fee(bytes memory _data) external view returns (uint256) {
        _data;
        return internall1Fee;
    }

    function getL1GasUsed(bytes memory _data) external view returns (uint256) {
        _data;
        return internall1GasUsed;
    }
}
