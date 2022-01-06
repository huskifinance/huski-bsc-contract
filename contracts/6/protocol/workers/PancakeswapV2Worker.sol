pragma solidity 0.6.6;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "@pancakeswap-libs/pancake-swap-core/contracts/interfaces/IPancakeFactory.sol";
import "@pancakeswap-libs/pancake-swap-core/contracts/interfaces/IPancakePair.sol";

import "../../apis/pancake/IPancakeRouter02.sol";
import "../../interfaces/IStrategy.sol";
import "../../interfaces/IWorker.sol";
import "../../interfaces/IPancakeMasterChef.sol";
import "../../utils/HuskyMath.sol";
import "../../utils/SafeToken.sol";

contract PancakeswapV2Worker is OwnableUpgradeSafe, ReentrancyGuardUpgradeSafe, IWorker {
  /// @notice Libraries
  using SafeToken for address;
  using SafeMath for uint256;

  /// @notice Events
  event Reinvest(address indexed caller, uint256 reward, uint256 bounty);
  event AddShare(uint256 indexed id, uint256 share);
  event RemoveShare(uint256 indexed id, uint256 share);
  event Liquidate(uint256 indexed id, uint256 wad);

  /// @notice Configuration variables
  IPancakeMasterChef public masterChef;
  IPancakeFactory public factory;
  IPancakeRouter02 public router;
  IPancakePair public override lpToken;
  address public wNative;
  address public override baseToken;
  address public override farmingToken;
  address public cake;
  address public operator;
  uint256 public pid;

  /// @notice Mutable state variables
  mapping(uint256 => uint256) public shares;
  mapping(address => bool) public okStrats;
  uint256 public totalShare;
  IStrategy public addStrat;
  IStrategy public liqStrat;
  uint256 public reinvestBountyBps;
  uint256 public maxReinvestBountyBps;
  mapping(address => bool) public okReinvestors;

  /// @notice Configuration varaibles for V2
  uint256 public fee;
  uint256 public feeDenom;

  function initialize(
    address _operator,
    address _baseToken,
    IPancakeMasterChef _masterChef,
    IPancakeRouter02 _router,
    uint256 _pid,
    IStrategy _addStrat,
    IStrategy _liqStrat,
    uint256 _reinvestBountyBps
  ) external initializer {
    OwnableUpgradeSafe.__Ownable_init();
    ReentrancyGuardUpgradeSafe.__ReentrancyGuard_init();

    operator = _operator;
    baseToken = _baseToken;
    wNative = _router.WETH();
    masterChef = _masterChef;
    router = _router;
    factory = IPancakeFactory(_router.factory());
    // Get lpToken and farmingToken from MasterChef pool
    pid = _pid;
    (IERC20 _lpToken, , , ) = masterChef.poolInfo(_pid);
    lpToken = IPancakePair(address(_lpToken));
    address token0 = lpToken.token0();
    address token1 = lpToken.token1();
    farmingToken = token0 == baseToken ? token1 : token0;
    cake = address(masterChef.cake());
    addStrat = _addStrat;
    liqStrat = _liqStrat;
    okStrats[address(addStrat)] = true;
    okStrats[address(liqStrat)] = true;
    reinvestBountyBps = _reinvestBountyBps;
    maxReinvestBountyBps = 500;
    fee = 9975;
    feeDenom = 10000;

    require(reinvestBountyBps <= maxReinvestBountyBps, "PancakeswapV2Worker::initialize: reinvestBountyBps exceeded maxReinvestBountyBps");
    require(
      (farmingToken == lpToken.token0() || farmingToken == lpToken.token1()) &&
      (baseToken == lpToken.token0() || baseToken == lpToken.token1()), "PancakeswapV2Worker::initialize: LP underlying not match with farm & base token");
  }

  /// @dev Require that the caller must be an EOA account to avoid flash loans.
  modifier onlyEOA() {
    require(msg.sender == tx.origin, "PancakeswapV2Worker::onlyEOA: not eoa");
    _;
  }

  /// @dev Require that the caller must be the operator.
  modifier onlyOperator() {
    require(msg.sender == operator, "PancakeswapV2Worker::onlyOperator: not operator");
    _;
  }

  //// @dev Require that the caller must be ok reinvestor.
  modifier onlyReinvestor() {
    require(okReinvestors[msg.sender], "PancakeswapV2Worker::onlyReinvestor: not reinvestor");
    _;
  }

  /// @dev Return the entitied LP token balance for the given shares.
  /// @param share The number of shares to be converted to LP balance.
  function shareToBalance(uint256 share) public view returns (uint256) {
    if (totalShare == 0) return share; // When there's no share, 1 share = 1 balance.
    (uint256 totalBalance, ) = masterChef.userInfo(pid, address(this));
    return share.mul(totalBalance).div(totalShare);
  }

  /// @dev Return the number of shares to receive if staking the given LP tokens.
  /// @param balance the number of LP tokens to be converted to shares.
  function balanceToShare(uint256 balance) public view returns (uint256) {
    if (totalShare == 0) return balance; // When there's no share, 1 share = 1 balance.
    (uint256 totalBalance, ) = masterChef.userInfo(pid, address(this));
    return balance.mul(totalShare).div(totalBalance);
  }

  /// @dev Re-invest whatever this worker has earned back to staked LP tokens.
  /// 1. Approve tokens
  /// 2. Withdraw all the rewards.
  /// 3. Send the reward bounty to the caller.
  /// 4. Convert all the remaining rewards to BaseToken via Native for liquidity.
  /// 5. Use add Token strategy to convert all BaseToken to LP tokens.
  /// 6. Mint more LP tokens and stake them for more rewards.
  /// 7. Reset approve
  function reinvest() external override onlyEOA onlyReinvestor nonReentrant {
    cake.safeApprove(address(router), uint256(-1));
    address(lpToken).safeApprove(address(masterChef), uint256(-1));
    
    masterChef.withdraw(pid, 0);
    uint256 reward = cake.balanceOf(address(this));
    if (reward == 0) return;
    
    uint256 bounty = reward.mul(reinvestBountyBps) / 10000;
    if (bounty > 0) cake.safeTransfer(msg.sender, bounty);
    
    address[] memory path;
    if (baseToken == wNative) {
      path = new address[](2);
      path[0] = address(cake);
      path[1] = address(wNative);
    } else {
      path = new address[](3);
      path[0] = address(cake);
      path[1] = address(wNative);
      path[2] = address(baseToken);
    }
    router.swapExactTokensForTokens(reward.sub(bounty), 0, path, address(this), now);
    
    baseToken.safeTransfer(address(addStrat), baseToken.myBalance());
    addStrat.execute(address(0), 0, abi.encode(0));
    
    masterChef.deposit(pid, lpToken.balanceOf(address(this)));
    
    cake.safeApprove(address(router), 0);
    address(lpToken).safeApprove(address(masterChef), 0);
    emit Reinvest(msg.sender, reward, bounty);
  }

  /// @dev Work on the given position. Must be called by the operator.
  /// 1. Convert this position back to LP tokens.
  /// 2. Perform the worker strategy; sending LP tokens + BaseToken; expecting LP tokens + BaseToken.
  /// 3. Add LP tokens back to the farming pool.
  /// 4. Return any remaining BaseToken back to the operator.
  /// @param id The position ID to work on.
  /// @param user The original user that is interacting with the operator.
  /// @param debt The amount of user debt to help the strategy make decisions.
  /// @param data The encoded data, consisting of strategy address and calldata.
  function work(uint256 id, address user, uint256 debt, bytes calldata data)
    override
    external
    onlyOperator nonReentrant
  {
    _removeShare(id);
    
    (address strat, bytes memory ext) = abi.decode(data, (address, bytes));
    require(okStrats[strat], "PancakeswapV2Worker::work: unapproved work strategy");
    require(lpToken.transfer(strat, lpToken.balanceOf(address(this))), "PancakeswapV2Worker::work: unable to transfer lp to strat");
    baseToken.safeTransfer(strat, baseToken.myBalance());
    IStrategy(strat).execute(user, debt, ext);
    
    _addShare(id);
    
    baseToken.safeTransfer(msg.sender, baseToken.myBalance());
  }

  /// @dev Return maximum output given the input amount and the status of Uniswap reserves.
  /// @param aIn The amount of asset to market sell.
  /// @param rIn the amount of asset in reserve for input.
  /// @param rOut The amount of asset in reserve for output.
  function getMktSellAmount(uint256 aIn, uint256 rIn, uint256 rOut) public view returns (uint256) {
    if (aIn == 0) return 0;
    require(rIn > 0 && rOut > 0, "PancakeswapV2Worker::getMktSellAmount: bad reserve values");
    uint256 aInWithFee = aIn.mul(fee);
    uint256 numerator = aInWithFee.mul(rOut);
    uint256 denominator = rIn.mul(feeDenom).add(aInWithFee);
    return numerator / denominator;
  }

  /// @dev Return the amount of BaseToken to receive if we are to liquidate the given position.
  /// 1. Get the position's LP balance and LP total supply.
  /// 2. Get the pool's total supply of BaseToken and FarmingToken.
  /// 3. Convert the position's LP tokens to the underlying assets.
  /// 4. Convert all FarmingToken to BaseToken and return total BaseToken.
  /// @param id The position ID to perform health check.
  function health(uint256 id) external override view returns (uint256) {
    uint256 lpBalance = shareToBalance(shares[id]);
    uint256 lpSupply = lpToken.totalSupply(); // Ignore pending mintFee as it is insignificant
    
    (uint256 r0, uint256 r1,) = lpToken.getReserves();
    (uint256 totalBaseToken, uint256 totalFarmingToken) = lpToken.token0() == baseToken ? (r0, r1) : (r1, r0);
    
    uint256 userBaseToken = lpBalance.mul(totalBaseToken).div(lpSupply);
    uint256 userFarmingToken = lpBalance.mul(totalFarmingToken).div(lpSupply);
    
    return getMktSellAmount(
      userFarmingToken, totalFarmingToken.sub(userFarmingToken), totalBaseToken.sub(userBaseToken)
    ).add(userBaseToken);
  }

  /// @dev Liquidate the given position by converting it to BaseToken and return back to caller.
  /// 1. Convert the position back to LP tokens and use liquidate strategy.
  /// 2. Return all available BaseToken back to the operator.
  /// @param id The position ID to perform liquidation
  function liquidate(uint256 id) external override onlyOperator nonReentrant {
    _removeShare(id);
    lpToken.transfer(address(liqStrat), lpToken.balanceOf(address(this)));
    liqStrat.execute(address(0), 0, abi.encode(0));
    
    uint256 wad = baseToken.myBalance();
    baseToken.safeTransfer(msg.sender, wad);
    emit Liquidate(id, wad);
  }

  /// @dev Internal function to stake all outstanding LP tokens to the given position ID.
  /// 1. Approve token to be spend by masterChef
  /// 2. Convert balance to share
  /// 3. Deposit balance to PancakeMasterChef
  /// 4. Update shares
  /// 5. Reset approve token
  function _addShare(uint256 id) internal {
    uint256 balance = lpToken.balanceOf(address(this));
    if (balance > 0) {
      address(lpToken).safeApprove(address(masterChef), uint256(-1));
      
      uint256 share = balanceToShare(balance);
      
      masterChef.deposit(pid, balance);
      // Update shares
      shares[id] = shares[id].add(share);
      totalShare = totalShare.add(share);
      
      address(lpToken).safeApprove(address(masterChef), 0);
      emit AddShare(id, share);
    }
  }

  /// @dev Internal function to remove shares of the ID and convert to outstanding LP tokens.
  function _removeShare(uint256 id) internal {
    uint256 share = shares[id];
    if (share > 0) {
      uint256 balance = shareToBalance(share);
      masterChef.withdraw(pid, balance);
      totalShare = totalShare.sub(share);
      shares[id] = 0;
      emit RemoveShare(id, share);
    }
  }

  /// @dev Set the reward bounty for calling reinvest operations.
  /// @param _reinvestBountyBps The bounty value to update.
  function setReinvestBountyBps(uint256 _reinvestBountyBps) external onlyOwner {
    require(_reinvestBountyBps <= maxReinvestBountyBps, "PancakeswapV2Worker::setReinvestBountyBps: _reinvestBountyBps exceeded maxReinvestBountyBps");
    reinvestBountyBps = _reinvestBountyBps;
  }

  /// @dev Set Max reinvest reward for set upper limit reinvest bounty.
  /// @param _maxReinvestBountyBps The max reinvest bounty value to update.
  function setMaxReinvestBountyBps(uint256 _maxReinvestBountyBps) external onlyOwner {
    require(_maxReinvestBountyBps >= reinvestBountyBps, "PancakeswapV2Worker::setMaxReinvestBountyBps: _maxReinvestBountyBps lower than reinvestBountyBps");
    maxReinvestBountyBps = _maxReinvestBountyBps;
  }

  /// @dev Set the given strategies' approval status.
  /// @param strats The strategy addresses.
  /// @param isOk Whether to approve or unapprove the given strategies.
  function setStrategyOk(address[] calldata strats, bool isOk) external override onlyOwner {
    uint256 len = strats.length;
    for (uint256 idx = 0; idx < len; idx++) {
      okStrats[strats[idx]] = isOk;
    }
  }

  /// @dev Set the given address's to be reinvestor.
  /// @param reinvestors The reinvest bot addresses.
  /// @param isOk Whether to approve or unapprove the given strategies.
  function setReinvestorOk(address[] calldata reinvestors, bool isOk) external override onlyOwner {
    uint256 len = reinvestors.length;
    for (uint256 idx = 0; idx < len; idx++) {
      okReinvestors[reinvestors[idx]] = isOk;
    }
  }

  /// @dev Update critical strategy smart contracts. EMERGENCY ONLY. Bad strategies can steal funds.
  /// @param _addStrat The new add strategy contract.
  /// @param _liqStrat The new liquidate strategy contract.
  function setCriticalStrategies(IStrategy _addStrat, IStrategy _liqStrat) external onlyOwner {
    addStrat = _addStrat;
    liqStrat = _liqStrat;
  }

}
