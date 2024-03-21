//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {ISettlementHook} from "../interfaces/hooks/ISettlementHook.sol";

/* solhint-disable meta-transactions/no-msg-sender */

contract SettlementHookMock is ISettlementHook {
    bool shouldRevertOnSettlement;
    address market;

    // --- Errors --- //

    error PermissionError(address);

    error InvalidSettlement();

    // --- Events --- //

    event OnSettledInvoked(uint128 accountId, uint128 marketId, uint256 oraclePrice);

    constructor(address _market) {
        market = _market;
    }

    function mockSetShouldRevertOnSettlement(bool _shouldRevertOnSettlement) external {
        shouldRevertOnSettlement = _shouldRevertOnSettlement;
    }

    function onSettle(uint128 accountId, uint128 marketId, uint256 oraclePrice) external {
        if (msg.sender != market) {
            revert PermissionError(msg.sender);
        }

        if (shouldRevertOnSettlement) {
            revert InvalidSettlement();
        }

        emit OnSettledInvoked(accountId, marketId, oraclePrice);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(ISettlementHook).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
