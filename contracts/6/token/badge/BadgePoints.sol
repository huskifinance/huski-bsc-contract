pragma solidity 0.6.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// HuskyToken with Governance.
contract BadgePoints is ERC20("BadgePoints", "BP"), Ownable {
  using SafeMath for uint256;

  uint256 public allocPoint;
  mapping(address => bool) public okOperators;

  struct InviteInfo {
    uint256 inviteCode;
    bool deleted;
  }
  mapping(address => InviteInfo) public inviteCodes;
  mapping(uint256 => address) public inviteCodesOwner;
  mapping(address => address) public relationShips;

  modifier onlyOperator() {
    require(okOperators[msg.sender], "BadgePoints::onlyOperator: not operator");
    _;
  }

  function makeInviteRelation(address _to, uint256 _userCode, uint256 _inviteCode) external onlyOperator {
    require(_to != address(0), "BadgePoints: mint to the zero address");
    require(_userCode > 10000, "BadgePoints: UserCode must be greater than 10000");
    require(inviteCodesOwner[_userCode] == address(0), "BadgePoints: UserCode had maked");
    require(inviteCodes[_to].deleted == false, "BadgePoints: One per person");
    inviteCodes[_to].inviteCode = _userCode;
    inviteCodes[_to].deleted = false;
    inviteCodesOwner[_userCode] = _to;

    relationShips[_to] = inviteCodesOwner[_inviteCode];
  }

  function transfer(address recipient, uint256 amount) public override onlyOperator returns (bool) {
    _transfer(_msgSender(), recipient, amount);
    inviteCodes[_msgSender()].deleted = true;
    return true;
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) public override onlyOperator returns (bool) {
    _transfer(sender, recipient, amount);
    // _approve(sender, _msgSender(), allowance(sender, _msgSender()).sub(amount, "ERC20: transfer amount exceeds allowance"));
    inviteCodes[sender].deleted = true;
    return true;
  }

  function mint(address account, uint256 amount) public onlyOperator {
    if (inviteCodes[account].deleted == false) {
      _mint(account, amount);
    }

    if (relationShips[account] == address(0)) {
      return;
    }

    if (inviteCodes[relationShips[account]].deleted == true) {
      return;
    }
    uint256 reward = allocPoint.mul(amount).div(100);
    _mint(relationShips[account], reward);
  }

  function deleteInvite(address account) external onlyOperator {
    inviteCodes[account].deleted = true;
  }

  function burn(address account, uint256 amount) external onlyOperator {
    _burn(account, amount);
    inviteCodes[account].deleted = true;
  }


  function setOperatorOk(address[] calldata operators, bool isOk) external onlyOwner {
    uint256 len = operators.length;
    for (uint256 idx = 0; idx < len; idx++) {
      okOperators[operators[idx]] = isOk;
    }
  }

  function setAllocPoint(uint256 _allocPoint) external onlyOwner {
    allocPoint = _allocPoint;
  }

  function isInvited(address account) external view returns (bool){
    return inviteCodes[account].deleted;
  }
}
