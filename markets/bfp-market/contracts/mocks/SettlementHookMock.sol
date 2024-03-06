//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {ISettlementHook} from "../interfaces/hooks/ISettlementHook.sol";

contract SettlementHookMock is ISettlementHook {
    bool shouldRevertOnSettlement;
    address market;

    // --- Errors --- //

    error PermissionError(address);

    error InvalidSettlement();

    // --- Events --- //

    event Settled();

    constructor(address _market) {
        market = _market;
    }

    function mockSetShouldRevertOnSettlement(bool _shouldRevertOnSettlement) external {
        shouldRevertOnSettlement = _shouldRevertOnSettlement;
    }

    function onSettle(uint128, uint128, int128, int128, uint256) external {
        if (msg.sender != market) {
            revert PermissionError(msg.sender);
        }

        if (shouldRevertOnSettlement) {
            revert InvalidSettlement();
        }

        emit Settled();
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(ISettlementHook).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
