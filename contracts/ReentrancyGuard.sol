pragma solidity 0.5.8;

/**
 * @title Helps contracts guard against reentrancy attacks.
 * @author Remco Bloemen <remco@2π.com>, Eenae <alexey@mixbytes.io>
 * @dev If you mark a function `nonReentrant`, you should also
 * mark it `external`.
 */
contract ReentrancyGuard {
    /// @dev counter to allow mutex lock with only one SSTORE operation
    uint256 private _guardCounter;

    constructor () internal {
        // The counter starts at one to prevent changing it from zero to a non-zero
        // value, which is a more expensive operation.
        _guardCounter = 1;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and make it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _guardCounter += 1;
        uint256 localCounter = _guardCounter;
        _;
        require(localCounter == _guardCounter, "re-entered");
    }
}

// File: contracts/InterestRateModel.sol

pragma solidity ^0.5.8;

/**
  * @title The Compound InterestRateModel Interface
  * @author Compound
  * @notice Any interest rate model should derive from this contract.
  * @dev These functions are specifically not marked `pure` as implementations of this
  *      contract may read from storage variables.
  */
interface InterestRateModel {
    /**
      * @notice Gets the current borrow interest rate based on the given asset, total cash, total borrows
      *         and total reserves.
      * @dev The return value should be scaled by 1e18, thus a return value of
      *      `(true, 1000000000000)` implies an interest rate of 0.000001 or 0.0001% *per block*.
      * @param cash The total cash of the underlying asset in the CToken
      * @param borrows The total borrows of the underlying asset in the CToken
      * @param reserves The total reserves of the underlying asset in the CToken
      * @return Success or failure and the borrow interest rate per block scaled by 10e18
      */
    function getBorrowRate(uint cash, uint borrows, uint reserves) external view returns (uint, uint);

    /**
      * @notice Marker function used for light validation when updating the interest rate model of a market
      * @dev Marker function used for light validation when updating the interest rate model of a market. Implementations should simply return true.
      * @return Success or failure
      */
    function isInterestRateModel() external view returns (bool);
}
