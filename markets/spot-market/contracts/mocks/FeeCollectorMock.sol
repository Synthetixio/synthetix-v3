//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "../interfaces/external/IFeeCollector.sol";

contract FeeCollectorMock is IFeeCollector {
    ITokenModule public usdToken;

    function setUsdToken(ITokenModule _usdToken) external {
        usdToken = _usdToken;
    }

    function quoteFees(
        uint128 marketId,
        uint256 feeAmount,
        address sender,
        uint8 tradeType
    ) external override returns (uint256) {
        // mention the variables in the block to prevent unused local variable warning
        marketId;
        sender;
        tradeType;

        uint256 feeToCollect = feeAmount / 2;
        return feeToCollect;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IFeeCollector).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
