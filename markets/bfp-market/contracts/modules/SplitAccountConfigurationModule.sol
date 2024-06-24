//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ERC165Helper} from "@synthetixio/core-contracts/contracts/utils/ERC165Helper.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {ISplitAccountConfigurationModule} from "../interfaces/ISplitAccountConfigurationModule.sol";
import {SplitAccountConfiguration} from "../storage/SplitAccountConfiguration.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";

contract SplitAccountConfigurationModule is ISplitAccountConfigurationModule {
    // --- Mutations --- //

    /**
     * @inheritdoc ISplitAccountConfigurationModule
     */
    function setEndorsedSplitAccounts(address[] memory addresses) external {
        OwnableStorage.onlyOwner();

        SplitAccountConfiguration.GlobalData storage config = SplitAccountConfiguration.load();
        uint256 existingAddresses = config.whitelistedAddresses.length;
        for (uint256 i = 0; i < existingAddresses; ) {
            delete config.whitelisted[config.whitelistedAddresses[i]];
            unchecked {
                ++i;
            }
        }
        delete config.whitelistedAddresses;

        uint256 addressesLength = addresses.length;
        address currentAddress;
        for (uint256 i = 0; i < addressesLength; ) {
            currentAddress = addresses[i];
            if (currentAddress == address(0)) {
                revert ErrorUtil.ZeroAddress();
            }

            config.whitelisted[currentAddress] = true;
            unchecked {
                ++i;
            }
        }
        config.whitelistedAddresses = addresses;

        emit SplitAccountConfigured(ERC2771Context._msgSender(), addressesLength);
    }

    // --- Views --- //

    /**
     * @inheritdoc ISplitAccountConfigurationModule
     */
    function getEndorsedSplitAccounts() external view returns (address[] memory addresses) {
        SplitAccountConfiguration.GlobalData storage config = SplitAccountConfiguration.load();
        return config.whitelistedAddresses;
    }

    /**
     * @inheritdoc ISplitAccountConfigurationModule
     */
    function isEndorsedForSplitAccount(address addr) external view returns (bool) {
        SplitAccountConfiguration.GlobalData storage config = SplitAccountConfiguration.load();
        return config.whitelisted[addr];
    }
}
