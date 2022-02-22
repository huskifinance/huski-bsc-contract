pragma solidity ^0.6.4;
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title A contract for instantiating subgraph data templates
contract VaultFactory is Ownable {
  mapping(address => mapping(address => address)) public getPair;
  mapping(address => address) public getVault;
  address[] public allPairs;
  address[] public allVault;

  event VaultCreated(address token0, address token1, address pair, address vault);

  /// @dev Add new pair and vault contracts to instantiating subgraph data templates.
  /// @param token0 baseToken of vault.
  function CreatVault(
    address token0,
    address token1,
    address pair,
    address vault
  ) external onlyOwner {
    getPair[token0][token1] = pair;
    getVault[token0] = vault;
    allPairs.push(pair);
    allVault.push(vault);
    emit VaultCreated(token0, token1, pair, vault);
  }
}
