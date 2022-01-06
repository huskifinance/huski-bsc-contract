import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import TestnetConfig from '../results/testnet.json'
import { MockERC20__factory, PancakeFactory__factory, PancakeRouter__factory } from '../../typechain';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const FOREVER = 20000000000;

  const { deployments, getNamedAccounts, network } = hre;
  const { deployer } = await getNamedAccounts();

  if (network.name !== 'testnet') {
    console.log('This deployment script should be run against testnet only')
    return
  }
  const config = TestnetConfig

  const factory = PancakeFactory__factory.connect(
    (await deployments.get('PancakeFactory')).address, (await ethers.getSigners())[0]);
  const router = PancakeRouter__factory.connect(
    (await deployments.get('PancakeRouter')).address, (await ethers.getSigners())[0]);

  const cake = MockERC20__factory.connect(
    (await deployments.get('CakeToken')).address, (await ethers.getSigners())[0]);
  const btcb = MockERC20__factory.connect(
    config.Tokens.BTCB, (await ethers.getSigners())[0]);
  const eth = MockERC20__factory.connect(
    config.Tokens.ETH, (await ethers.getSigners())[0]);
  const usdt = MockERC20__factory.connect(
    config.Tokens.USDT, (await ethers.getSigners())[0]);
  const busd = MockERC20__factory.connect(
    config.Tokens.BUSD, (await ethers.getSigners())[0]);

  console.log(">> Creating the CAKE-WBNB Trading Pair");
  await factory.createPair(
    config.Tokens.WBNB, //(await deployments.get('WBNB')).address,
    (await deployments.get('CakeToken')).address, //(await deployments.get('CAKE')).address,
    {
      gasLimit: '10000000',
    }
  );
  console.log("✅ Done");
  console.log(">> Adding liquidity to CAKE-WBNB Pair")
  await cake.approve(router.address, ethers.utils.parseEther('22.8682'));
  await router.addLiquidityETH(
    (await deployments.get('CakeToken')).address,
    ethers.utils.parseEther('22.8682'),
    '0', '0', (await ethers.getSigners())[0].address, FOREVER, { value: ethers.utils.parseEther('0.1'), gasLimit: 5000000 });
  console.log("✅ Done");

  console.log(">> Creating the BTCB-WBNB Trading Pair");
  await factory.createPair(
    config.Tokens.BTCB, //(await deployments.get('BTCB')).address,
    config.Tokens.WBNB, // (await deployments.get('WBNB')).address,
    {
      gasLimit: '10000000',
    }
  );
  console.log("✅ Done");
  console.log(">> Adding liquidity to BTCB-WBNB Pair")
  await btcb.approve(router.address, ethers.utils.parseEther('0.00467384'));
  await router.addLiquidityETH(
    btcb.address,
    ethers.utils.parseEther('0.00467384'),
    '0', '0', (await ethers.getSigners())[0].address, FOREVER, { value: ethers.utils.parseEther('0.1'), gasLimit: 5000000 })
  console.log("✅ Done");

  console.log(">> Creating the ETH-WBNB Trading Pair");
  await factory.createPair(
    config.Tokens.ETH, // (await deployments.get('ETH')).address,
    config.Tokens.WBNB, // (await deployments.get('WBNB')).address,
    {
      gasLimit: '10000000',
    }
  );
  console.log("✅ Done");
  console.log(">> Adding liquidity to ETH-WBNB Pair")
  await eth.approve(router.address, ethers.utils.parseEther('0.149565'));
  await router.addLiquidityETH(
    eth.address,
    ethers.utils.parseEther('0.149565'),
    '0', '0', (await ethers.getSigners())[0].address, FOREVER, { value: ethers.utils.parseEther('0.1'), gasLimit: 5000000 })
  console.log("✅ Done");

  console.log(">> Creating the USDT-BUSD Trading Pair");
  await factory.createPair(
    config.Tokens.USDT, // (await deployments.get('USDT')).address,
    config.Tokens.BUSD, // (await deployments.get('BUSD')).address,
    {
      gasLimit: '10000000',
    }
  );
  console.log("✅ Done");
  console.log(">> Adding liquidity to USDT-BUSD Pair")
  await usdt.approve(router.address, ethers.utils.parseEther('100000000'));
  await busd.approve(router.address, ethers.utils.parseEther('100000000'));
  await router.addLiquidity(
    config.Tokens.USDT, // (await deployments.get('USDT')).address,
    config.Tokens.BUSD, // (await deployments.get('BUSD')).address,
    ethers.utils.parseEther('100000000'),
    ethers.utils.parseEther('100000000'),
    '0', '0', (await ethers.getSigners())[0].address, FOREVER, { gasLimit: 5000000 })
  console.log("✅ Done");

  console.log(">> Creating the WBNB-BUSD Trading Pair");
  await factory.createPair(
    config.Tokens.WBNB, // (await deployments.get('WBNB')).address,
    config.Tokens.BUSD, // (await deployments.get('BUSD')).address,
    {
      gasLimit: '10000000',
    }
  );
  console.log("✅ Done");
  console.log(">> Adding liquidity to WBNB-BUSD Pair")
  await busd.approve(router.address, ethers.utils.parseEther('266.194'));
  await router.addLiquidityETH(
    config.Tokens.BUSD, // (await deployments.get('BUSD')).address,
    ethers.utils.parseEther('266.194'),
    '0', '0', (await ethers.getSigners())[0].address, FOREVER, { value: ethers.utils.parseEther('0.1'), gasLimit: 5000000 })
  console.log("✅ Done");

};

export default func;
func.tags = ['Testnet'];