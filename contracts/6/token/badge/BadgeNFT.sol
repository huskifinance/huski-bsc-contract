pragma solidity 0.6.6;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./BadgePoints.sol";
import "../HuskyToken.sol";

contract BadgeNFT is ERC721("BadgeNFT", "BNFT"), Ownable {
  using SafeMath for uint256;

  uint256 public GRADE_CEILING = 15;
  uint256 public GRADE_LIMIT = 5;

  BadgePoints public badgePoints;
  HuskyToken public husky;
  uint256[] public gradeNeedPoints;
  uint256[] public gradeLockHuskys;
  uint256[] public gradeLimitAmount;

  uint256[] public gradeAmount;
  mapping(uint256 => uint256) public tokensGrade;
  mapping(address => bool) public okOperators;

  modifier onlyOperator() {
    require(okOperators[msg.sender], "BadgePoints::onlyOperator: not operator");
    _;
  }

  constructor() public {
    gradeNeedPoints = new uint256[](GRADE_CEILING);
    gradeLockHuskys = new uint256[](GRADE_CEILING);
    gradeAmount = new uint256[](GRADE_CEILING);
    gradeLimitAmount = new uint256[](GRADE_CEILING);
  }

  function transferFrom(
    address from,
    address to,
    uint256 tokenId
  ) public override onlyOperator {
    _transfer(from, to, tokenId);
  }

  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId
  ) public override onlyOperator {
    safeTransferFrom(from, to, tokenId, "");
  }

  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId,
    bytes memory _data
  ) public override onlyOperator {
    _safeTransfer(from, to, tokenId, _data);
  }

  function burn(address from, uint256 tokenId) external onlyOperator {
    require(ERC721.ownerOf(tokenId) == from, "ERC721: transfer of token that is not own");

    _burn(tokenId);
    uint256 grade = tokensGrade[tokenId];
    gradeAmount[grade] = gradeAmount[grade] - 1;
    tokensGrade[tokenId] = 0;
  }

  function mintTo(
    address to,
    uint256 tokenId,
    uint256 grade
  ) external onlyOperator {
    // uint256 grade = tokensGrade[tokenId];
    uint256 amount = gradeAmount[grade];
    uint256 limintAmount = gradeLimitAmount[grade];
    require(ERC721.balanceOf(to) == 0, "ERC721: One per person");
    require(amount < limintAmount, "upgrade: over AMOUNT LIMIT");

    _mint(to, tokenId);
    tokensGrade[tokenId] = grade;
    gradeAmount[grade] = gradeAmount[grade] + 1;
  }

  function upgrade(uint256 tokenId, uint256 _newGrade) external onlyOperator {
    uint256 grade = tokensGrade[tokenId];
    require(grade < GRADE_LIMIT, "upgrade: over GRADE LIMIT");
    uint256 amount = gradeAmount[_newGrade];
    uint256 limintAmount = gradeLimitAmount[_newGrade];
    require(amount < limintAmount, "upgrade: over AMOUNT LIMIT");

    tokensGrade[tokenId] = _newGrade;
    gradeAmount[grade] = gradeAmount[grade] - 1;
    gradeAmount[_newGrade] = gradeAmount[_newGrade] + 1;
  }

  function setTokenURI(uint256 tokenId, string calldata tokenURI) external onlyOperator {
    _setTokenURI(tokenId, tokenURI);
  }

  function setOperatorsOk(address[] calldata operators, bool isOk) external onlyOwner {
    uint256 len = operators.length;
    for (uint256 idx = 0; idx < len; idx++) {
      okOperators[operators[idx]] = isOk;
    }
  }

  function setGradeInfo(
    uint256[] calldata ids,
    uint256[] calldata points,
    uint256[] calldata huskys,
    uint256[] calldata amounts
  ) external onlyOwner {
    if (ids.length > GRADE_LIMIT) {
      GRADE_LIMIT = ids.length;
    }

    uint256 len = ids.length;
    for (uint256 idx = 0; idx < len; idx++) {
      gradeNeedPoints[ids[idx]] = points[idx];
      gradeLockHuskys[ids[idx]] = huskys[idx];
      gradeLimitAmount[ids[idx]] = amounts[idx];
    }
  }
}
