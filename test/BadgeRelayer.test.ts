import { ethers, upgrades } from "hardhat";
import { Signer } from "ethers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import "@openzeppelin/test-helpers";
import "@openzeppelin/hardhat-upgrades";
import {
    HuskyToken,
    HuskyToken__factory,
    FairLaunch,
    FairLaunch__factory,
    BadgeNFT,
    BadgeNFT__factory,
    BadgePoints,
    BadgePoints__factory,
    WNativeRelayer,
    WNativeRelayer__factory,
    ComplexPriceOracle,
    ComplexPriceOracle__factory,
    MockERC20,
    MockERC20__factory,
    BadgeRelayer,
    BadgeRelayer__factory,
    SimpleVaultConfig,
    SimpleVaultConfig__factory,
    MockWBNB, MockWBNB__factory
} from "../typechain";

chai.use(solidity);
const { expect } = chai;

describe("BadgeRelayer",() => {
    const HUSKI_REWARD_PER_BLOCK = ethers.utils.parseEther('5000');
    const HUSKI_BONUS_LOCK_UP_BPS = 7000;

    // const FOREVER = '2000000000';
    // const CAKE_REWARD_PER_BLOCK = ethers.utils.parseEther('0.076');
    // const REINVEST_BOUNTY_BPS = '100'; // 1% reinvest bounty
    const RESERVE_POOL_BPS = '1000'; // 10% reserve pool
    const KILL_PRIZE_BPS = '1000'; // 10% Kill prize
    const INTEREST_RATE = '3472222222222'; // 30% per year
    const MIN_DEBT_SIZE = ethers.utils.parseEther('1'); // 1 BTOKEN min debt size
    // const WORK_FACTOR = '7000';
    // const KILL_FACTOR = '8000';


    // Accounts
    let deployer: Signer;
    let alice: Signer;
    let bob: Signer;
    let dev: Signer;

    let huskyToken: HuskyToken;
    let fairLaunch: FairLaunch;
    let stakingTokens: MockERC20[];
    let complexPriceOracle:ComplexPriceOracle;
    let badgePoints:BadgePoints;
    let badgeNFT:BadgeNFT;
    let badgeRelayer:BadgeRelayer;
    // let iVaultConfig:IVaultConfig;
    let simpleVaultConfig:SimpleVaultConfig;
    let wbnb: MockWBNB;
    let wNativeRelayer: WNativeRelayer;


    let badgeNFTAsAlice:BadgeNFT;
    let badgeNFTAsBob:BadgeNFT;
    let badgeNFTAsDev:BadgeNFT;

    let badgeRelayerAsAlice:BadgeRelayer;
    let badgeRelayerAsBob:BadgeRelayer;
    let badgeRelayerAsDev:BadgeRelayer;

    let badgePointsAsAlice:BadgePoints;
    let badgePointsAsBob:BadgePoints;
    let badgePointsAsDev:BadgePoints;

    let huskyTokenAsAlice:HuskyToken;
    let huskyTokenAsBob:HuskyToken;
    let huskyTokenAsDev:HuskyToken;

    let stoken0AsDeployer: MockERC20;
    let stoken0AsAlice: MockERC20;
    let stoken0AsBob: MockERC20;
    let stoken0AsDev: MockERC20;

    beforeEach(async() => {
        [deployer, alice, bob, dev] = await ethers.getSigners();

        const HuskyToken = (await ethers.getContractFactory(
            "HuskyToken",
            deployer
        )) as HuskyToken__factory;
        huskyToken = await HuskyToken.deploy(132, 137);
        await huskyToken.deployed();

        const FairLaunch = (await ethers.getContractFactory(
            "FairLaunch",
            deployer
        )) as FairLaunch__factory;
        fairLaunch = await FairLaunch.deploy(
            huskyToken.address, (await dev.getAddress()), HUSKI_REWARD_PER_BLOCK, 0, HUSKI_BONUS_LOCK_UP_BPS, 0
        )
        await fairLaunch.deployed();

        await huskyToken.manualMint(await bob.getAddress(),1000000)


        await huskyToken.transferOwnership(fairLaunch.address);

        stakingTokens = new Array();
        for(let i = 0; i < 4; i++) {
            const MockERC20 = (await ethers.getContractFactory(
                "MockERC20",
                deployer
            )) as MockERC20__factory;
            const mockERC20 = await upgrades.deployProxy(MockERC20, 
                [`STOKEN${i}`, `STOKEN${i}`], { unsafeAllow: ['delegatecall'] }) as MockERC20;
            await mockERC20.deployed();
            stakingTokens.push(mockERC20);
        }

        const ComplexPriceOracle = (await ethers.getContractFactory(
            "ComplexPriceOracle",
            deployer
        )) as ComplexPriceOracle__factory;
        complexPriceOracle = await upgrades.deployProxy(ComplexPriceOracle, 
            [await alice.getAddress()], { unsafeAllow: ['delegatecall'] }) as ComplexPriceOracle;
        await complexPriceOracle.deployed();

        const BadgePoints = (await ethers.getContractFactory(
            "BadgePoints",
            deployer
        ))as BadgePoints__factory;
        badgePoints = await BadgePoints.deploy();
        await badgePoints.deployed();

        const BadgeNFT = (await ethers.getContractFactory(
            "BadgeNFT",
            deployer
        )) as BadgeNFT__factory;
        badgeNFT = await BadgeNFT.deploy();
        await badgeNFT.deployed();

        const WBNB = (await ethers.getContractFactory(
            "MockWBNB",
            deployer
        )) as MockWBNB__factory;
        wbnb = await WBNB.deploy();
        await wbnb.deployed()


        const WNativeRelayer = (await ethers.getContractFactory(
            "WNativeRelayer",
            deployer
        )) as WNativeRelayer__factory;
        wNativeRelayer = await WNativeRelayer.deploy(wbnb.address);
        await wNativeRelayer.deployed();
        //
        const SimpleVaultConfig = (await ethers.getContractFactory(
            "SimpleVaultConfig",
            deployer
        )) as SimpleVaultConfig__factory;
        //
        simpleVaultConfig = await upgrades.deployProxy(SimpleVaultConfig, [
            MIN_DEBT_SIZE, INTEREST_RATE, RESERVE_POOL_BPS, KILL_PRIZE_BPS,
            wbnb.address, wNativeRelayer.address, fairLaunch.address], 
            { unsafeAllow: ['delegatecall'] }) as SimpleVaultConfig;
        await simpleVaultConfig.deployed();

        const BadgeRelayer = (await ethers.getContractFactory(
            "BadgeRelayer",
            deployer
        )) as BadgeRelayer__factory;
        // badgeRelayer = await BadgeRelayer.deploy();
        badgeRelayer = await upgrades.deployProxy(BadgeRelayer,
            [huskyToken.address,fairLaunch.address,
                badgeNFT.address,badgePoints.address,
                complexPriceOracle.address,
                simpleVaultConfig.address], 
                { unsafeAllow: ['delegatecall'] }) as BadgeRelayer;
        await badgeRelayer.deployed();

        //
        badgeRelayerAsAlice = BadgeRelayer__factory.connect(badgeRelayer.address,alice);
        badgeRelayerAsBob = BadgeRelayer__factory.connect(badgeRelayer.address,bob);

        badgeNFTAsAlice = BadgeNFT__factory.connect(badgeNFT.address,alice);
        badgeNFTAsBob = BadgeNFT__factory.connect(badgeNFT.address,bob);
        badgeNFTAsDev = BadgeNFT__factory.connect(badgeNFT.address,dev);

        badgePointsAsAlice = BadgePoints__factory.connect(badgePoints.address,alice);

        huskyTokenAsAlice = HuskyToken__factory.connect(huskyToken.address,alice);
        huskyTokenAsBob = HuskyToken__factory.connect(huskyToken.address,bob);
        huskyTokenAsDev = HuskyToken__factory.connect(huskyToken.address,dev);

        stoken0AsDeployer = MockERC20__factory.connect(stakingTokens[0].address, deployer);
        stoken0AsAlice = MockERC20__factory.connect(stakingTokens[0].address, alice);
        stoken0AsBob = MockERC20__factory.connect(stakingTokens[0].address, bob);
        stoken0AsDev = MockERC20__factory.connect(stakingTokens[0].address, dev);

        await badgeNFT.setOperatorsOk([badgeRelayer.address],true)
        // await badgeRelayer.initialize(huskyToken.address,fairLaunch.address,badgeNFT.address,badgePoints.address,complexPriceOracle.address,simpleVaultConfig.address)
        await fairLaunch.setBadgeRelayer(badgeRelayer.address);
        await badgeNFT.setGradeInfo([0,1,2,3,4],[0,12*(10**4),12*(10**5),12*(10**6),12*(10**7)],[10**2,10**3,10**4,10**5,10**6],[10**5,10**4,10**3,10*2,10])

    })
    context('when use badge',async()=>{
        it('should be reverted',async() => {
            await huskyTokenAsBob.transfer(await alice.getAddress(),10);
            //Verify alice's token balance
            await expect(await huskyToken.balanceOf(await alice.getAddress())).to.be.bignumber.eq(10)
            //Test that Badge cannot be purchased when the token is insufficient
            await expect(badgeRelayerAsAlice.mintBadge(123,"1",0,10001,0)).to.be.revertedWith("mintBadge: Husky not enough");
            await expect(await huskyToken.balanceOf(await alice.getAddress())).to.be.bignumber.eq(10)


            await badgePoints.setOperatorOk([await deployer.getAddress()],true);
            //Initialize the alice integral to 12000
            await badgePoints.mint(await alice.getAddress(),12*10**3)
            await huskyTokenAsBob.transfer(await alice.getAddress(),990);
            //Badge cannot be purchased when the points are insufficient.
            await expect(badgeRelayerAsAlice.mintBadge(123,"1",1,10001,0)).to.be.revertedWith("mintBadge: Points not enough");
            await expect(await huskyToken.balanceOf(await alice.getAddress())).to.be.bignumber.eq(1000);
            await expect(await badgePointsAsAlice.balanceOf(await alice.getAddress())).to.be.bignumber.eq(12*10**3)

        })
        it('Cast a first-level badge and bind the user invitation relationship',async() => {

            await badgePoints.setOperatorOk([await deployer.getAddress(),badgeRelayer.address],true);

            // alice mints first-level badge and locks 100 husky
            await huskyTokenAsBob.transfer(await alice.getAddress(),100000);
            await badgeRelayerAsAlice.mintBadge(123,"1",0,10001,0);
            // Verify that the badge belongs to alice
            await expect(await badgeNFT.ownerOf(123)).to.be.eq(await alice.getAddress());
            await expect(await huskyToken.balanceOf(await alice.getAddress())).to.be.bignumber.eq(99900);

            // Verify invitation binding relationship
            await badgeRelayerAsBob.mintBadge(124,"1",0,10002,10001);
            await expect(await badgeNFT.ownerOf(124)).to.be.eq(await bob.getAddress());
            await expect(await badgePoints.relationShips(await bob.getAddress())).to.be.eq(await alice.getAddress());


            //Alice upgrades the badge to level 3 and locks 10000 husky
            await badgePoints.mint(await alice.getAddress(),12*10**5)
            await badgeRelayerAsAlice.upgradeBadge(123,2);
            await expect(await badgeNFT.tokensGrade(123)).to.be.eq(2);
            await expect(await huskyToken.balanceOf(await alice.getAddress())).to.be.bignumber.eq(90000);
            await expect(await badgePoints.balanceOf(await alice.getAddress())).to.be.bignumber.eq(12*10**5)

            await expect(badgeRelayerAsAlice.upgradeBadge(123,3)).to.be.revertedWith("Points not enough");
            await expect(await badgeNFT.tokensGrade(123)).to.be.eq(2);
            await expect(await huskyToken.balanceOf(await alice.getAddress())).to.be.bignumber.eq(90000);
            // 验证邀请码
            let a = await badgePoints.inviteCodes(await alice.getAddress());
            await expect(a.inviteCode).to.be.bignumber.eq(10001);
            await expect(a.deleted).to.be.false;
        })
        it('After destroying the badge, unlock 90% husky and all points', async function () {

            await badgePoints.setOperatorOk([await deployer.getAddress(),badgeRelayer.address],true);

            await badgePoints.mint(await alice.getAddress(),12*10**4)
            await huskyTokenAsBob.transfer(await alice.getAddress(),1000);
            await badgeRelayerAsAlice.mintBadge(123,"1",1,10001,0)
            await expect(await badgeNFT.ownerOf(123)).to.be.eq(await alice.getAddress());
            await expect(await badgePoints.balanceOf(await alice.getAddress())).to.be.bignumber.eq(12*10**4)

            let a = await badgePoints.inviteCodes(await alice.getAddress());
            await expect(a.inviteCode).to.be.bignumber.eq(10001);

            //销毁二级令牌扣除10%token
            await badgeRelayerAsAlice.burn(123);
            await expect(await huskyToken.balanceOf(await alice.getAddress())).to.be.bignumber.eq(900);
            await expect(await badgePoints.balanceOf(await alice.getAddress())).to.be.bignumber.eq(12*10**4);

            a = await badgePoints.inviteCodes(await alice.getAddress());
            await expect(a.inviteCode).to.be.bignumber.eq(10001);
            await expect(a.deleted).to.be.true;

        });
        it('Trade badge to bob', async function () {
            await badgePoints.setOperatorOk([await deployer.getAddress(),badgeRelayer.address],true);
            await badgePoints.mint(await alice.getAddress(),12*10**4);
            await huskyTokenAsBob.transfer(await alice.getAddress(),1000);

            await badgeRelayerAsAlice.mintBadge(123,"1",1,10001,1)
            await expect(await badgeNFT.ownerOf(123)).to.be.eq(await alice.getAddress());
            // 验证 邀请码
            let a = await badgePoints.inviteCodes(await alice.getAddress());
            await expect(a.inviteCode).to.be.bignumber.eq(10001);

            //Initialize bob 400 stoken0Token
            await stoken0AsDeployer.mint((await bob.getAddress()), 400);
            await expect(await huskyToken.balanceOf(await bob.getAddress())).to.be.bignumber.eq(999000);
            await expect(await stoken0AsDeployer.balanceOf(await bob.getAddress())).to.be.bignumber.eq(400);
            await badgeNFTAsAlice.approve(badgeRelayer.address,123)
            await stoken0AsBob.approve(badgeRelayer.address,1000)

            await badgeRelayerAsBob.transferBadge(stakingTokens[0].address,100,await alice.getAddress(),123,10002);
            await expect(await huskyToken.balanceOf(await alice.getAddress())).to.be.bignumber.eq(0);
            await expect(await huskyToken.balanceOf(await bob.getAddress())).to.be.bignumber.eq(999000);
            await expect(await badgePoints.balanceOf(await bob.getAddress())).to.be.bignumber.eq(12*10**4);
            await expect(await badgePoints.balanceOf(await alice.getAddress())).to.be.bignumber.eq(0);

            await expect(await stakingTokens[0].balanceOf(await bob.getAddress())).to.be.bignumber.eq(300);
            await expect(await stakingTokens[0].balanceOf(await alice.getAddress())).to.be.bignumber.eq(100);
            await expect(await badgeNFT.ownerOf(123)).to.be.eq(await bob.getAddress());
            // Verify the alice invitation code, the invitation relationship remains unchanged, and deleted is changed to true
            a = await badgePoints.inviteCodes(await alice.getAddress());
            await expect(a.inviteCode).to.be.bignumber.eq(10001);
            await expect(a.deleted).to.be.true;

            // Destroy the badge with id 123 and return 90% alpace and all badge Points to bob.
            await badgeRelayerAsBob.burn(123);
            await expect(await huskyToken.balanceOf(await bob.getAddress())).to.be.bignumber.eq(999900);
            await expect(await badgePoints.balanceOf(await bob.getAddress())).to.be.bignumber.eq(12*10**4);
        });
    })
})
