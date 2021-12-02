pragma solidity ^0.5.16;

import {WhitePaperInterestRateModel} from "compound-protocol/contracts/WhitePaperInterestRateModel.sol";

contract MockIRM is WhitePaperInterestRateModel {
    constructor() public WhitePaperInterestRateModel(20000000000000000, 0) {}
}
