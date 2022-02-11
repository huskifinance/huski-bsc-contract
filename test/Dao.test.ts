import { ethers, upgrades } from "hardhat";
import { Signer } from "ethers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import "@openzeppelin/test-helpers";
import "@openzeppelin/hardhat-upgrades";
import {
    MockAggregatorV3,
    MockAggregatorV3__factory,
    MockERC20,
    MockERC20__factory,
    PublicOffering,
    PublicOfferingConfig,
    PublicOfferingConfig__factory,
    PublicOffering__factory
} from "../typechain";

chai.use(solidity);
const { expect } = chai;


describe("Public Offering",() => {
    // Accounts
    let deployer: Signer;
    let alice: Signer;
    let bob: Signer;
    let eve: Signer;

    /// Token-related instance(s)
    let usdtToken: MockERC20;
    let usdtTokenAlice: MockERC20;
    let usdtTokenBob: MockERC20;
    let usdtTokenEve: MockERC20;

    let configs: PublicOfferingConfig

    let publicOffering: PublicOffering
    let publicOfferingAlice: PublicOffering
    let publicOfferingBob: PublicOffering
    let publicOfferingEve: PublicOffering

    let publicOfferingEth: PublicOffering
    let publicOfferingEthAlice: PublicOffering

    let aggregatorV3: MockAggregatorV3

    beforeEach(async () => {
        [deployer, alice, bob, eve] = await ethers.getSigners();

        // Setup price stuffs
        const MockAggregatorV3 = (await ethers.getContractFactory(
          "MockAggregatorV3",
          deployer
        )) as MockAggregatorV3__factory
        aggregatorV3 =await MockAggregatorV3.deploy() as MockAggregatorV3;

        /// Setup token stuffs
        const MockERC20 = (await ethers.getContractFactory(
            "MockERC20",
            deployer
        )) as MockERC20__factory
        usdtToken = await upgrades.deployProxy(MockERC20, ['USDT', 'USDT'], { unsafeAllow: ['delegatecall'] }) as MockERC20;
        await usdtToken.deployed();
        await usdtToken.mint(await eve.getAddress(), ethers.utils.parseEther('100000'));
        await usdtToken.mint(await alice.getAddress(), ethers.utils.parseEther('100000'));
        await usdtToken.mint(await bob.getAddress(), ethers.utils.parseEther('100000'));

        const PublicOfferingConfig = (await ethers.getContractFactory(
            "PublicOfferingConfig",
            deployer
        )) as PublicOfferingConfig__factory
        configs = await PublicOfferingConfig.deploy() as PublicOfferingConfig;

        const PublicOffering = (await ethers.getContractFactory(
            "PublicOffering",
            deployer
        )) as PublicOffering__factory;
        publicOffering = await PublicOffering.deploy(configs.address,usdtToken.address,aggregatorV3.address) as PublicOffering;
        publicOfferingEth = await PublicOffering.deploy(configs.address,"0x0000000000000000000000000000000000000000",aggregatorV3.address) as PublicOffering;

        usdtTokenAlice = MockERC20__factory.connect(usdtToken.address, alice);
        usdtTokenBob = MockERC20__factory.connect(usdtToken.address, bob);
        usdtTokenEve = MockERC20__factory.connect(usdtToken.address, eve);

        publicOfferingAlice = PublicOffering__factory.connect(publicOffering.address, alice);
        publicOfferingBob = PublicOffering__factory.connect(publicOffering.address, bob);
        publicOfferingEve = PublicOffering__factory.connect(publicOffering.address, eve);
        publicOfferingEthAlice = PublicOffering__factory.connect(publicOfferingEth.address,alice);
    });
    context("",async() => {
        it("Investment Amount Verification",async() => {
            await configs.setPublicOffering(publicOffering.address,true);
            await usdtTokenAlice.approve(publicOffering.address,ethers.utils.parseEther('10000'))
            let latestPriceData = await publicOffering.getPrice();
            let inviteCode = await publicOffering.getCode(await deployer.getAddress());

            await publicOfferingAlice.deposit(ethers.utils.parseEther('1000'),latestPriceData[1],inviteCode)

            expect(await publicOffering.investorBalanceOf(await alice.getAddress())).to.be.bignumber.eq(latestPriceData[0].mul(ethers.utils.parseEther('1000')).div(1e8));
            expect(await publicOffering.investorBalanceOf(await alice.getAddress())).to.be.bignumber.eq(await configs.raisedAmount())
            expect(await usdtToken.balanceOf(await alice.getAddress())).to.be.bignumber.eq(ethers.utils.parseEther('100000').sub(ethers.utils.parseEther('1000')))

            //only invest once
            await expect(publicOfferingAlice.deposit(ethers.utils.parseEther('1000'),latestPriceData[1],inviteCode)).to.be.revertedWith("PublicOffering::deposit:User has invested")
            /// raiseAmount unchanged
            expect(await publicOffering.investorBalanceOf(await alice.getAddress())).to.be.bignumber.eq(latestPriceData[0].mul(ethers.utils.parseEther('1000')).div(1e8));
            expect(await usdtToken.balanceOf(await alice.getAddress())).to.be.bignumber.eq(ethers.utils.parseEther('100000').sub(ethers.utils.parseEther('1000')))

            await usdtTokenBob.approve(publicOffering.address,ethers.utils.parseEther('10000'));
            await publicOfferingBob.deposit(ethers.utils.parseEther('1000'),latestPriceData[1],inviteCode);
            expect(await publicOffering.investorBalanceOf(await bob.getAddress())).to.be.bignumber.eq(latestPriceData[0].mul(ethers.utils.parseEther('1000')).div(1e8));
            expect(await usdtToken.balanceOf(await alice.getAddress())).to.be.bignumber.eq(ethers.utils.parseEther('100000').sub(ethers.utils.parseEther('1000')))
            //The current total investment is alic+bob
            expect(latestPriceData[0].mul(ethers.utils.parseEther('2000').div(1e8))).to.be.bignumber.eq(await configs.raisedAmount())
            //usdt balanceOf
            expect(await usdtToken.balanceOf(publicOffering.address)).to.be.bignumber.eq(ethers.utils.parseEther('2000'))

        })
        it('deposit range validation',  async () => {
            await configs.setPublicOffering(publicOffering.address,true);
            await usdtTokenAlice.approve(publicOffering.address,ethers.utils.parseEther('10000'))
            let latestPriceData = await publicOffering.getPrice();
            let inviteCode = await publicOffering.getCode(await deployer.getAddress());

            await expect(publicOfferingAlice.deposit(ethers.utils.parseEther('200'),latestPriceData[1],inviteCode)).to.be.revertedWith("PublicOffering::deposit:The investment amount is less than minInvestment")
            expect(await usdtToken.balanceOf(await alice.getAddress())).to.be.bignumber.eq(ethers.utils.parseEther('100000'))
            expect(await configs.raisedAmount()).to.be.bignumber.eq(0)

            await  expect(publicOfferingAlice.deposit(ethers.utils.parseEther('60000'),latestPriceData[1],inviteCode)).to.be.revertedWith("PublicOffering::deposit:The investment amount is greater than the maxInvestment")
            expect(await usdtToken.balanceOf(await alice.getAddress())).to.be.bignumber.eq(ethers.utils.parseEther('100000'))
            expect(await configs.raisedAmount()).to.be.bignumber.eq(0)
        });
        it('Manually close fundraising', async () => {
            await configs.setPublicOffering(publicOffering.address,true);
            await usdtTokenAlice.approve(publicOffering.address,ethers.utils.parseEther('10000'))
            let latestPriceData = await publicOffering.getPrice();
            await publicOffering.setPublicOfferingState(true);
            //Manually close fundraising
            await  expect(publicOfferingAlice.deposit(ethers.utils.parseEther('1000'),latestPriceData[1],"0xdd888a75")).to.be.revertedWith("PublicOffering::deposit:Public offering closed")
            // alice balanceOf unchanged
            expect(await publicOffering.investorBalanceOf(await alice.getAddress())).to.be.bignumber.eq(0);
            expect(await publicOffering.investorBalanceOf(await alice.getAddress())).to.be.bignumber.eq(await configs.raisedAmount())
            expect(await usdtToken.balanceOf(await alice.getAddress())).to.be.bignumber.eq(ethers.utils.parseEther('100000'))
        });
        it('token withdraw and InvestorData', async () => {
            await configs.setPublicOffering(publicOffering.address,true);
            let latestPriceData = await publicOffering.getPrice();
            let inviteCode = await publicOffering.getCode(await deployer.getAddress());
            let invitedCodeAlice = await publicOfferingAlice.getCode(await alice.getAddress());
            let invitedCodeBob = await publicOfferingBob.getCode(await bob.getAddress());


            await usdtTokenAlice.approve(publicOffering.address,ethers.utils.parseEther('10000'))
            await publicOfferingAlice.deposit(ethers.utils.parseEther('1000'),latestPriceData[1],inviteCode)
            await usdtTokenBob.approve(publicOffering.address,ethers.utils.parseEther('10000'))
            await publicOfferingBob.deposit(ethers.utils.parseEther('2000'),latestPriceData[1],invitedCodeAlice)
            await usdtTokenEve.approve(publicOffering.address,ethers.utils.parseEther('10000'))
            await publicOfferingEve.deposit(ethers.utils.parseEther('3000'),latestPriceData[1],invitedCodeBob)

            expect(await usdtToken.balanceOf(publicOffering.address)).to.be.bignumber.eq(ethers.utils.parseEther('6000'))

            //withdraw
            await publicOffering.withdraw(ethers.utils.parseEther('500'));
            expect(await usdtToken.balanceOf(publicOffering.address)).to.be.bignumber.eq(ethers.utils.parseEther('6000').sub(ethers.utils.parseEther('500')))
            expect(await usdtToken.balanceOf(await deployer.getAddress())).to.be.bignumber.eq(ethers.utils.parseEther('500'))

            //emergencyWithdraw
            await publicOffering.emergencyWithdraw();
            expect(await usdtToken.balanceOf(publicOffering.address)).to.be.bignumber.eq(0)
            expect(await usdtToken.balanceOf(await deployer.getAddress())).to.be.bignumber.eq(ethers.utils.parseEther('6000'))

            //InvestorData
            let investors = await publicOffering.getInvestors();

            expect(investors[0]["0"]).to.be.eq(await alice.getAddress());
            expect(investors[0]["1"]).to.be.eq(inviteCode);
            expect(investors[0]["2"]).to.be.bignumber.eq(latestPriceData[0].mul(ethers.utils.parseEther('1000')).div(1e8));

            expect(investors[1]["0"]).to.be.eq(await bob.getAddress());
            expect(investors[1]["1"]).to.be.eq(invitedCodeAlice);
            expect(investors[1]["2"]).to.be.eq(latestPriceData[0].mul(ethers.utils.parseEther('2000')).div(1e8));

            expect(investors[2]["0"]).to.be.eq(await eve.getAddress());
            expect(investors[2]["1"]).to.be.eq(invitedCodeBob);
            expect(investors[2]["2"]).to.be.eq(latestPriceData[0].mul(ethers.utils.parseEther('3000')).div(1e8));

            let invitees = await publicOffering.getInvitees(await alice.getAddress());

            expect(invitees[0]["0"]).to.be.eq(await bob.getAddress());
            expect(invitees[0]["1"]).to.be.eq(invitedCodeAlice);
            expect(invitees[0]["2"]).to.be.eq(latestPriceData[0].mul(ethers.utils.parseEther('2000')).div(1e8));
        });
        it('Eth deposit and withdraw ', async () => {
            await configs.setPublicOffering(publicOfferingEthAlice.address,true);
            let latestPriceData = await publicOfferingEthAlice.getPrice();
            let inviteCode = await publicOffering.getCode(await deployer.getAddress());

            await publicOfferingEthAlice.deposit(ethers.utils.parseEther('1000'),latestPriceData[1],inviteCode,{value: ethers.utils.parseEther('1000')});

            expect(await configs.raisedAmount()).to.be.bignumber.eq(latestPriceData[0].mul(ethers.utils.parseEther('1000')).div(1e8))
            expect(await publicOfferingEthAlice.investorBalanceOf(await alice.getAddress())).to.be.bignumber.eq(latestPriceData[0].mul(ethers.utils.parseEther('1000')).div(1e8));

            expect(await ethers.provider.getBalance(publicOfferingEthAlice.address)).to.be.bignumber.eq(ethers.utils.parseEther('1000'))
            await publicOfferingEth.withdraw(ethers.utils.parseEther('100'));

            expect(await ethers.provider.getBalance(publicOfferingEthAlice.address)).to.be.bignumber.eq(ethers.utils.parseEther('900'))

            let investors = await publicOfferingEth.getInvestors();

            expect(investors[0]["0"]).to.be.eq(await alice.getAddress());
            expect(investors[0]["1"]).to.be.eq(inviteCode);
            expect(investors[0]["2"]).to.be.bignumber.eq(latestPriceData[0].mul(ethers.utils.parseEther('1000')).div(1e8));
        });
    })

})