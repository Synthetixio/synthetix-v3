// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

// TODO: Move to core-contracts
library ERC20Helper {
    error FailedTransfer(address from, address to, uint value);

    function safeTransfer(
        address token,
        address to,
        uint value
    ) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));

        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert FailedTransfer(address(this), to, value);
        }
    }

    function safeTransferFrom(
        address token,
        address from,
        address to,
        uint value
    ) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value)
        );

        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert FailedTransfer(from, to, value);
        }
    }
}
