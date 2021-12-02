pragma solidity ^0.5.16;

import {CEther} from "compound-protocol/contracts/CEther.sol";
import {ComptrollerInterface, InterestRateModel} from "compound-protocol/contracts/CErc20.sol";

contract MockCEther is CEther {
    constructor(
        ComptrollerInterface _comptroller,
        InterestRateModel _interestRateModel,
        address payable admin_
    )
        public
        CEther(
            _comptroller,
            _interestRateModel,
            200000000 * (10**18),
            "Mock Compound Ether",
            "cETH",
            8,
            admin_
        )
    {}
}
