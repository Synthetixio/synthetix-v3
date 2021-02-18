//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "../mixins/OwnerMixin.sol";
import "../storage/ProxyStorage.sol";
import "@openzeppelin/contracts/utils/Address.sol";


contract UpgradeModule is ProxyStorageNamespace, OwnerMixin {
    /* MUTATIVE FUNCTIONS */

    function upgradeTo(address newImplementation) public onlyOwnerOrProxy {
        require(newImplementation != address(0), "Invalid new implementation: zero address");
        require(Address.isContract(newImplementation), "Invalid new implementation: not a contract");
        _requireIsUpgradeable(newImplementation);

        _setImplementation(newImplementation);

        if (msg.sender != address(this)) {
            _validateUpgrade();
        }
    }

    function _requireIsUpgradeable(address newImplementation) private {
        // Doing a call allows us to throw a prettier error
        // in case that the `isUpgradeable` selector doesnt exist.
        (bool success, bytes memory data) = address(newImplementation).call(
            abi.encodeWithSelector(UpgradeModule(0).isUpgradeable.selector)
        );

        bool isUpgradeable = abi.decode(data, (bool));

        require(success && isUpgradeable, "Invalid new implementation: not upgradeable");
    }

    function _validateUpgrade() private {
        ProxyStorage storage store = _proxyStorage();
        if (store.knownImplementation == address(0)) {
            store.knownImplementation = address(new KnownImplementation());
        }

        bool isValid = false;

        /*
           Performs a second upgrade on the incoming upgrade using an external call.

           The external call is always reverted, but without reverting the main execution thread.

           If the second upgrade responds as expected, the first upgrade is considered safe.
           If it's not, the first upgrade is also reverted and thus rejected.
        */
        try this.canUpgradeAgain() {
            revert();
        } catch Error(string memory revertReason) {
            // revertReason == 'ok'
            isValid = keccak256(bytes(revertReason)) == keccak256("ok");

            emit SecondaryUpgradeTested(revertReason);
        } catch (bytes memory) {
            // no revert reason

            emit SecondaryUpgradeTested("not ok");
        }

        if (!isValid) {
            revert("Target upgrade is not safe");
        }
    }

    function canUpgradeAgain() public {
        upgradeTo(_proxyStorage().knownImplementation);

        (bool success, bytes memory data) = address(this).call(
            abi.encodeWithSelector(KnownImplementation(0).getKnownValue.selector)
        );

        if (success) {
            bytes1 message = abi.decode(data, (bytes1));

            if (message == 0x2a) {
                revert("ok");
            }
        }

        revert();
    }

    /* VIEW FUNCTIONS */

    function isUpgradeable() public pure returns (bool) {
        return true;
    }

    function getImplementation() public view returns (address) {
        return _getImplementation();
    }

    /* EVENTS */

    event SecondaryUpgradeTested(string revertReason);
}

contract KnownImplementation {
    function getKnownValue() public pure returns (bytes1) {
        return 0x2a;
    }

    function isUpgradeable() public pure returns (bool) {
        return true;
    }
}

