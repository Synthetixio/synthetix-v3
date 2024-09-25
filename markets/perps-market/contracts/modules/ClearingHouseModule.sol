//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {IClearinghouse} from "../interfaces/IClearinghouse.sol";
import {Clearinghouse} from "../storage/Clearinghouse.sol";

contract ClearinghouseModule is IClearinghouse {
    /// @inheritdoc IClearinghouse
    function cancelOrders(uint128 accountId, uint256[] calldata nonces) external {
        Account.loadAccountAndValidatePermission(
            accountId,
            AccountRBAC._PERPS_COMMIT_ASYNC_ORDER_PERMISSION
        );

        Clearinghouse.Data storage data = Clearinghouse.load();

        // Arrays to hold the unique word positions and corresponding bitmasks
        uint256[] memory wordPositions = new uint256[](nonces.length);
        uint256[] memory bitmasks = new uint256[](nonces.length);
        uint256 wordPosCount = 0;

        // Iterate over each nonce in the array
        for (uint256 i = 0; i < nonces.length; i++) {
            (uint256 wordPos, uint256 bitPos) = Clearinghouse._bitmapPositions(nonces[i]);

            // Create a bitmask for this nonce
            uint256 bitMask = 1 << bitPos;

            // Check if we already have this wordPos in the list
            bool found = false;
            for (uint256 j = 0; j < wordPosCount; j++) {
                if (wordPositions[j] == wordPos) {
                    // If found, update the corresponding bitmask
                    bitmasks[j] |= bitMask;
                    found = true;
                    break;
                }
            }

            // If not found, add a new entry
            if (!found) {
                wordPositions[wordPosCount] = wordPos;
                bitmasks[wordPosCount] = bitMask;
                wordPosCount++;
            }
        }

        // Now call invalidateUnorderedNonces for each unique wordPos
        for (uint256 i = 0; i < wordPosCount; i++) {
            Clearinghouse.invalidateUnorderedNonces(data, accountId, wordPositions[i], bitmasks[i]);
        }

        emit OrdersCanceled(accountId, nonces);
    }

    /*//////////////////////////////////////////////////////////////
                               SETTLEMENT
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IClearinghouse
    function settle(Request calldata request) external override returns (Response memory response) {
        // TODO
    }

    /// @inheritdoc IClearinghouse
    function canSettle(
        Request calldata request
    ) external view override returns (Response memory response) {
        // TODO
    }

    /*//////////////////////////////////////////////////////////////
                               UTILITIES
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IClearinghouse
    function hash(Order calldata order) external pure override returns (bytes32 _hash) {
        // TODO
    }
}
