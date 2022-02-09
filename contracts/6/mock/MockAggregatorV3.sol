pragma solidity ^0.6.6;

import "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";


contract MockAggregatorV3 {
    function latestRoundData()public view returns(uint, uint80, uint, uint, uint80){
        return (18446744073709552057,100035963,1643405676,1643405676,18446744073709552057);
    }

    function getRoundData(uint80 _roundID)public view returns(uint, uint80, uint, uint, uint80){
        return (18446744073709552057,100035963,1643405676,1643405676,18446744073709552057);
    }
}
