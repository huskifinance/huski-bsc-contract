pragma solidity 0.6.6;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "../../interfaces/IPriceOracle.sol";

contract ComplexPriceOracle is OwnableUpgradeSafe {
  event PriceUpdate(address indexed token0, uint256 price);

  address feeder;

  struct PriceData {
    uint192 price;
    uint64 lastUpdate;
  }

  /// @notice Public price data mapping storage.
  mapping(address => PriceData) public store;

  modifier onlyFeeder() {
    require(msg.sender == feeder, "ComplexPriceOracle::onlyFeeder: only feeder");
    _;
  }

  function initialize(address _feeder) external initializer {
    OwnableUpgradeSafe.__Ownable_init();

    feeder = _feeder;
  }

  function setFeeder(address _feeder) public onlyOwner {
    feeder = _feeder;
  }

  /// @dev Set the prices of the token token pairs. Must be called by the feeder.
  function setPrices(
    address[] calldata tokens,
    uint256[] calldata prices
  ) external onlyFeeder {
    uint256 len = tokens.length;
    require(prices.length == len, "ComplexPriceOracle::setPrices: bad prices length");
    for (uint256 idx = 0; idx < len; idx++) {
      address token0 = tokens[idx];
      uint256 price = prices[idx];
      store[token0] = PriceData({ price: uint192(price), lastUpdate: uint64(now) });
      emit PriceUpdate(token0, price);
    }
  }

  /// @dev Return the wad price of token0/token1, multiplied by 1e18
  /// NOTE: (if you have 1 token0 how much you can sell it for token1)
  function getPrice(address token0) external view returns (uint256 price, uint256 lastUpdate) {
    PriceData memory data = store[token0];
    price = uint256(data.price);
    lastUpdate = uint256(data.lastUpdate);
    require(price != 0 && lastUpdate != 0, "ComplexPriceOracle::getPrice: bad price data");
    return (price, lastUpdate);
  }
}
