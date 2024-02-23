//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AnotherModule} from "./AnotherModule.sol";
import {SampleModule as AliasedModule} from "./SampleModule.sol";

// solhint-disable-next-line no-empty-blocks
contract SomeModule is AnotherModule {

}

// solhint-disable-next-line no-empty-blocks
contract MultipleInheritancce is SomeModule, AliasedModule {

}
