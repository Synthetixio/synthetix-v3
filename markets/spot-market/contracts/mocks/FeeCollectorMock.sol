//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "../interfaces/external/IFeeCollector.sol";

contract FeeCollectorMock is IFeeCollector {
    ITokenModule public usdToken;

    function setUsdToken(ITokenModule _usdToken) external {
        usdToken = _usdToken;
    }

    // collects 50% of the fees
    function collectFees(uint128 marketId, uint256 feeAmount) external override {
        uint feeToCollect = feeAmount / 2;

        usdToken.transferFrom(msg.sender, address(this), feeToCollect);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IFeeCollector).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
