//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../utils/RevertUtil.sol";

contract RevertUtilMock {
    function revertIfError(bytes memory reason) external pure {
        RevertUtil.revertIfError(reason);
    }

    function revertManyIfError(bytes[] memory reasons) external pure {
        RevertUtil.revertManyIfError(reasons);
    }

    function revertWithReason(bytes memory reason) external pure {
        RevertUtil.revertWithReason(reason);
    }
}
