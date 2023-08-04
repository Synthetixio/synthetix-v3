//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/external/IFeeCollector.sol";

/**
 * @title Mock Fee Collector.
 */
contract FeeCollectorMock is IFeeCollector {
    uint internal feeRatioD18;

    function mockSetFeeRatio(uint _feeRatio) external {
        feeRatioD18 = _feeRatio;
    }

    // solc-ignore-next-line func-mutability
    function quoteFees(
        uint128 marketId,
        uint256 feeAmount,
        address sender
    ) external override returns (uint256) {
        // mention the variables in the block to prevent unused local variable warning
        marketId;
        sender;

        return (feeAmount * feeRatioD18) / 1e18;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IFeeCollector).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
