//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {IPerpAccountModule} from "../interfaces/IPerpAccountModule.sol";
import {ISettlementHook} from "../interfaces/hooks/ISettlementHook.sol";

/* solhint-disable meta-transactions/no-msg-sender */

contract MergeAccountSettlementHookMock is ISettlementHook {
    bool shouldRevertOnSettlement;
    address market;
    uint128 vaultAccountId;

    // --- Errors --- //

    error PermissionError(address);
    error InvalidSettlement();
    error VaultAccountIdNotSet();

    // --- Events --- //

    event Settled();

    constructor(address _market) {
        market = _market;
    }

    function mockSetVaultAccountId(uint128 _vaultAccountId) external {
        vaultAccountId = _vaultAccountId;
    }

    function mockSetShouldRevertOnSettlement(bool _shouldRevertOnSettlement) external {
        shouldRevertOnSettlement = _shouldRevertOnSettlement;
    }

    function onSettle(
        uint128 accountId,
        uint128 marketId,
        uint256 // oraclePrice
    ) external {
        if (msg.sender != market) {
            revert PermissionError(msg.sender);
        }

        if (shouldRevertOnSettlement) {
            revert InvalidSettlement();
        }

        if (vaultAccountId == 0) {
            revert VaultAccountIdNotSet();
        }

        IPerpAccountModule(market).mergeAccounts(accountId, vaultAccountId, marketId);

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
