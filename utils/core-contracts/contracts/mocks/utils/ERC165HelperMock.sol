//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../interfaces/IERC20.sol";
import "../../interfaces/IERC721.sol";
import "../../utils/ERC165Helper.sol";

contract ERC165HelperMock {
    function supportsInterface(address candidate, bytes4 interfaceId) external returns (bool) {
        return ERC165Helper.safeSupportsInterface(candidate, interfaceId);
    }

    function getERC20InterfaceId() external pure returns (bytes4) {
        return type(IERC20).interfaceId;
    }

    function getERC721InterfaceId() external pure returns (bytes4) {
        return type(IERC721).interfaceId;
    }
}
