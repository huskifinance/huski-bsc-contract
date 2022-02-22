pragma solidity ^0.6.6;

contract MockAggregatorV3 {
  function latestRoundData()
    public
    pure
    returns (
      uint80,
      uint256,
      uint256,
      uint256,
      uint80
    )
  {
    return (18446744073709552057, 100035963, 1643405676, 1643405676, 18446744073709552057);
  }

  function getRoundData(uint80 _roundID)
    public
    pure
    returns (
      uint80,
      uint256,
      uint256,
      uint256,
      uint80
    )
  {
    return (_roundID, 100035963, 1643405676, 1643405676, 18446744073709552057);
  }
}
