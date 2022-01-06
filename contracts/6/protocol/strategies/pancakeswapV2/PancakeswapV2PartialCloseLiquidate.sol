pragma solidity 0.6.6;

import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@pancakeswap-libs/pancake-swap-core/contracts/interfaces/IPancakeFactory.sol";
import "@pancakeswap-libs/pancake-swap-core/contracts/interfaces/IPancakePair.sol";

import "../../../apis/pancake/IPancakeRouter02.sol";
import "../../../interfaces/IStrategy.sol";
import "../../../utils/SafeToken.sol";
import "../../../interfaces/IWorker.sol";

contract PancakeswapV2PartialCloseLiquidate is OwnableUpgradeSafe, ReentrancyGuardUpgradeSafe, IStrategy {
  using SafeToken for address;

  IPancakeFactory public factory;
  IPancakeRouter02 public router;

  mapping(address => bool) public okWorkers;

  // @notice require that only allowed workers are able to do the rest of the method call
  modifier onlyWhitelistedWorkers() {
    require(okWorkers[msg.sender], "PancakeswapV2PartialCloseLiquidate::onlyWhitelistedWorkers: bad worker");
    _;
  } 

  /// @dev Create a new liquidate strategy instance.
  /// @param _router The Uniswap router smart contract.
  function initialize(IPancakeRouter02 _router) public initializer {
    OwnableUpgradeSafe.__Ownable_init();
    ReentrancyGuardUpgradeSafe.__ReentrancyGuard_init();
    factory = IPancakeFactory(_router.factory());
    router = _router;
  }

  /// @dev Execute worker strategy. Take LP token. Return  BaseToken.
  /// @param data Extra calldata information passed along to this strategy.
  function execute(address /* user */, uint256 /* debt */, bytes calldata data)
    external
    override
    onlyWhitelistedWorkers
    nonReentrant
  {
    // 1. Find out what farming token we are dealing with.
    (
      uint256 returnLpToken,
      uint256 minBaseToken
    ) = abi.decode(data, (uint256, uint256));
    IWorker worker = IWorker(msg.sender);
    address baseToken = worker.baseToken();
    address farmingToken = worker.farmingToken();
    IPancakePair lpToken = IPancakePair(factory.getPair(farmingToken, baseToken));
    require(lpToken.balanceOf(address(this)) >= returnLpToken, "PancakeswapV2PartialCloseLiquidate::execute: insufficient LP amount recevied from worker");
    // 2. Approve router to do their stuffs
    lpToken.approve(address(router), uint256(-1));
    farmingToken.safeApprove(address(router), uint256(-1));
    // 3. Remove some LP back to BaseToken and farming tokens as we want to return some of the position.
    router.removeLiquidity(baseToken, farmingToken, returnLpToken, 0, 0, address(this), now);
    // 4. Convert farming tokens to baseToken.
    address[] memory path = new address[](2);
    path[0] = farmingToken;
    path[1] = baseToken;
    router.swapExactTokensForTokens(farmingToken.myBalance(), 0, path, address(this), now);
    // 5. Return all baseToken back to the original caller.
    uint256 balance = baseToken.myBalance();
    require(balance >= minBaseToken, "PancakeswapV2PartialCloseLiquidate::execute: insufficient baseToken received");
    SafeToken.safeTransfer(baseToken, msg.sender, balance);
    lpToken.transfer(msg.sender, lpToken.balanceOf(address(this)));
    // 6. Reset approve for safety reason
    lpToken.approve(address(router), 0);
    farmingToken.safeApprove(address(router), 0);
  }

  function setWorkersOk(address[] calldata workers, bool isOk) external onlyOwner {
    for (uint256 idx = 0; idx < workers.length; idx++) {
      okWorkers[workers[idx]] = isOk;
    }
  }
}
