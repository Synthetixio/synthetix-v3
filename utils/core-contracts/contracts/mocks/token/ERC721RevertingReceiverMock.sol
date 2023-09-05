//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../interfaces/IERC721Receiver.sol";

contract ERC721RevertingReceiverMock is IERC721Receiver {
    error SomeFancyError();

    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public pure override returns (bytes4) {
        revert SomeFancyError();
    }
}
