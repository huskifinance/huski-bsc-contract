pragma solidity 0.6.6;

interface IStronkHusky {
  function prepareHodl() external;
  function hodl() external;
  function unhodl() external;

  event PrepareHodl(address indexed user, address indexed relayer);
  event Hodl(address indexed user, address indexed relayer, uint256 receivingStronkHuskyAmount);
  event Unhodl(address indexed user, uint256 receivingHuskyAmount);
}
