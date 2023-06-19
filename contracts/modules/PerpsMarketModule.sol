//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../external/IMarket.sol";

contract PerpsMarketModule is IMarket {
    uint128 public marketId;

    function name(
        uint128 _marketId
    ) external view override returns (string memory n) {
        if (_marketId == marketId) {
            n = string(
                abi.encodePacked("Market ", bytes32(uint256(_marketId)))
            );
        }
    }

    function reportedDebt(uint128) external pure override returns (uint256) {
        return 0;
    }

    function minimumCredit(
        uint128 _marketId
    ) external view override returns (uint256) {
        return 0;
    }

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IMarket).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
