# hardhat-router

## Description

This hardhat plugin generates a router to be used in a router proxy smart contract architecture.

A router is simply a contract that maps the incoming call's selector to the corresponding contract that has such selector. Thus, a router allows contracts to be combined behind the same execution context.



The router is based on a set of modules, which are contracts deployed, or to be deployed. It routes incoming interactions via `DELETAGECALL` to the module containing the function corresponding to the incoming function selector, or `msg.sig` in the data payload.

The router is basically a table that maps incoming selector to target implementation that holds such selector.

### Router generation

The router itself is a single contract that hardcodes the addresses of the modules it maps to, and uses a binary search written in Yul to eficiently find the target implementation. This tools generates the router source by analyzing the modules that are to be routed to.

### Router validation

After generation, this tool also performs a series of validations on the generated source, ensuring:

* That all the modules combined contain no duplicate selectors (this is actually a limitation of the router)
* TODO: Complete list of validations
