//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "../interfaces/external/IFeeCollector.sol";

contract FeeCollectorMock is IFeeCollector {
    ITokenModule public usdToken;

    function setUsdToken(ITokenModule _usdToken) external {
        usdToken = _usdToken;
    }

    // solc-ignore-next-line func-mutability
    function quoteFees(
        // solc-ignore-next-line unused-param
        uint128 marketId,
        uint256 feeAmount,
        // solc-ignore-next-line unused-param
        address sender,
        // solc-ignore-next-line unused-param
        uint8 tradeType
    ) external override returns (uint256) {
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
