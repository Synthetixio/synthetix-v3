//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/// @title Clearinghouse Interface
/// @author wasp in bush
/// @notice Defines order structure and settlement procedures for peer-to-peer trading
interface IClearinghouse {

    /*//////////////////////////////////////////////////////////////
                                GLOSSARY
    //////////////////////////////////////////////////////////////*/

    /// @custom:LOB acronym for "Limit Order Book"
    /// @custom:UNDERLYING refers to the asset whose value the market tracks
    /// @custom:QUOTE the asset used to express the price of the market's UNDERLYING

    /*//////////////////////////////////////////////////////////////
                               ORDER TYPE
    //////////////////////////////////////////////////////////////*/

    /// @notice Enumerates the types of orders that can be settled
    enum Type {
        // conditional execution:
        //  - buy   @ QUOTE != 0
        //  - sell  @ QUOTE != 0
        //
        // side effects:
        //  - LOB depth consumed if available; order "killed" otherwise
        MARKET,
        // conditional execution:
        //  - buy   @ QUOTE <= LIMIT price
        //  - sell  @ QUOTE >= LIMIT price
        //
        // side effects:
        //  - LOB depth increases when condition not satisfied
        //  - LOB depth decreases when condition satisfied
        LIMIT,
        // conditional execution:
        //  - buy   @ QUOTE >= STOP price
        //  - sell  @ QUOTE <= STOP price
        //
        // side effects:
        // - LOB depth unchanged until condition satisfied
        // - LOB depth decreases when condition satisfied
        STOP,
        // conditional execution:
        //  - buy   @ QUOTE >= STOP price && QUOTE <= LIMIT price
        //  - sell  @ QUOTE <= STOP price && QUOTE >= LIMIT price
        //
        // side effects:
        // - LOB depth unchanged when STOP condition is not satisfied
        // - LOB depth increases when STOP condition satisfied but not LIMIT
        // - LOB depth decreases when both conditions satisfied
        STOP_LIMIT
    }

    /*//////////////////////////////////////////////////////////////
                            ORDER STRUCTURE
    //////////////////////////////////////////////////////////////*/

    /// @notice Defines all relevant metadata for the order
    struct Metadata {
        // timestamp when the order was created
        uint256 genesis;
        // timestamp when the order will expire
        uint256 expiration;
        // tracking code for the order
        bytes32 trackingCode;
        // address of the referrer
        address referrer;
    }

    /// @notice Defines trader identity and encapsulates authentication logic
    struct Trader {
        // unique order identifier for a given account
        uint256 nonce;
        // unique account identifier
        uint128 accountId;
        // address of the trade signer which:
        //  - must be the account owner
        //  - must satisfy account-specified permissions
        address signer;
    }

    /// @notice Defines the market and trade details
    struct Trade {
        // type of order
        Type t;
        // unique market identifier
        uint128 marketId;
        // size of the trade:
        //  - measured in the market's underlying asset
        //  - sign indicates the direction of the trade
        int128 size;
        // indicates the price of the trade:
        //  - measured in the asset used to quote the market's underlying asset
        //  - logic varies depending on the order type
        uint256 price;
    }

    /// @notice Defines some condition that must be satisfied at settlement
    /// @dev Mechanism to allow for arbitrary settlement logic
    /// @custom:caution Condition can be malicious; 
    /// prior off-chain sanitation is mandatory
    struct Condition {
        // address of the contract to staticcall
        address target;
        // identifier of the function to call
        bytes4 selector;
        // data to pass to the function
        bytes data;
        // expected return value
        bytes32 expected;
    }

    /// @notice Defines the structure of an Order
    /// @dev Used in conjunction with a valid signature (i.e., ERC712)
    struct Order {
        Metadata metadata;
        Trader trader;
        Trade trade;
        Condition[] conditions;
    }

    /*//////////////////////////////////////////////////////////////
                           SETTLEMENT OBJECTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Defines the request to settle a collection of orders
    struct Request {
        // orders to validate and settle
        Order[] orders;
        // signatures corresponding to each order used for validation
        bytes[] signatures;
    }

    /// @notice Defines the response to a settlement request
    struct Response {
        // indicates the success of the settlement
        bool success;
        // details of the settlement response
        bytes data;
    }

    /*//////////////////////////////////////////////////////////////
                               SETTLEMENT
    //////////////////////////////////////////////////////////////*/

    /// @notice Settle (i.e., "Clear") the orders requested
    /// @dev Reverts if settlement would impact net market exposure
    /// @param request the orders to settle
    /// @return response of the settlement procedure
    function settle(
        Request calldata request
    )
        external
        returns (Response memory response);

    /*//////////////////////////////////////////////////////////////
                               SIMULATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Simulate the settlement of the orders requested
    /// @dev Does not modify the state of the contract
    /// @param request the orders to simulate
    /// @return response of the simulated settlement procedure
    function canSettle(
        Request calldata request
    )
        external
        view
        returns (Response memory response);

    /*//////////////////////////////////////////////////////////////
                               UTILITIES
    //////////////////////////////////////////////////////////////*/

    /// @notice Hashes a given order
    /// @param order to hash
    /// @return hash of the order
    function hash(
        Order calldata order
    ) 
        external
        pure 
        returns (bytes32 hash);

}