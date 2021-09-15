//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../storage/GlobalNamespace.sol";
import "../mixins/CommsMixin.sol";
import "./SomeModule.sol";

contract AnotherModule is CommsMixin {
    /*
       NOTE: This module shows an example of how to do intermodule communications.

       In general, it is not recommended to interact with other modules in a second thread (internal call)
       since its dangerous and expensive.

       The recommendation is to interact with namespace storage via auxiliary mixins within the same thread.

       Using `call` to read or write to a module, will lose the proxy storage context, unless the call
       goes through the proxy, which is expensive. Even so, in such a case, msg.sender will be lost to the proxy.

       E.g. this is bad:
       `SomeModule(address(this)).setSomeValue(42)` or `SomeModule(address(this)).getSomeValue()`

       The CommsMixin's `_intermoduleCall` function facilitates the usage of `delegatecall`,
       but cannot guarantee "read only" in calls.
    */

    /* MUTATIVE FUNCTIONS */

    function setSomeValueOnSomeModule(uint newValue) public {
        _intermoduleCall(
            abi.encodeWithSelector(SomeModule.setSomeValue.selector, newValue)
        );
    }
}
