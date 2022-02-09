import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { FileService } from "../utils";
import { PublicOfferingConfig__factory, PublicOffering__factory } from '../../typechain';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    /*
  ░██╗░░░░░░░██╗░█████╗░██████╗░███╗░░██╗██╗███╗░░██╗░██████╗░
  ░██║░░██╗░░██║██╔══██╗██╔══██╗████╗░██║██║████╗░██║██╔════╝░
  ░╚██╗████╗██╔╝███████║██████╔╝██╔██╗██║██║██╔██╗██║██║░░██╗░
  ░░████╔═████║░██╔══██║██╔══██╗██║╚████║██║██║╚████║██║░░╚██╗
  ░░╚██╔╝░╚██╔╝░██║░░██║██║░░██║██║░╚███║██║██║░╚███║╚██████╔╝
  ░░░╚═╝░░░╚═╝░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝╚═╝╚═╝░░╚══╝░╚═════╝░
  Check all variables below before execute the deployment script
  */
  // mainnet
  // const ETH = '0x0000000000000000000000000000000000000000'; 
  // const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7'; 
  // const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  // const ETH_FEED = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'; 
  // const USDT_FEED = '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D'; 
  // const USDC_FEED = '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6'; 

  // kovan
  const ETH = '0x0000000000000000000000000000000000000000'; 
  const USDT = '0x1484a6020a0f08400f6f56715016d2c80e26cdc1'; 
  const USDC = '0x7079f3762805cff9c979a5bdc6f5648bcfee76c8';
  const ETH_FEED = '0x9326BFA02ADD2366b30bacB125260Af641031331'; 
  const USDT_FEED = '0x2ca5A90D34cA333661083F89D831f757A9A50148'; 
  const USDC_FEED = '0x9211c6b3BF41A10F78539810Cf5c64e1BB78Ec60'; 


  console.log(">> Deploying Sheild contract");
  const Config = (await ethers.getContractFactory(
    "PublicOfferingConfig",
    (await ethers.getSigners())[0])) as PublicOfferingConfig__factory;
  const config = await Config.deploy();
  await config.deployed();
  console.log(`>> Deployed at ${config.address}`);
  console.log("✅ Done");

  
  const EthPublicOffering = (await ethers.getContractFactory(
    "PublicOffering",
    (await ethers.getSigners())[0])) as PublicOffering__factory;
  const ethPublicOffering = await EthPublicOffering.deploy(config.address, ETH, ETH_FEED);
  await ethPublicOffering.deployed();
  console.log(`>> Deployed at ${ethPublicOffering.address}`);

  console.log(`>> Set EthPublicOffering to config`);
  config.setPublicOffering(ethPublicOffering.address, true);
  console.log("✅ Done");


  const UsdtPublicOffering = (await ethers.getContractFactory(
    "PublicOffering",
    (await ethers.getSigners())[0])) as PublicOffering__factory;
  const usdtPublicOffering = await UsdtPublicOffering.deploy(config.address, USDT, USDT_FEED);
  await usdtPublicOffering.deployed();
  console.log(`>> Deployed at ${usdtPublicOffering.address}`);

  console.log(`>> Set UsdtPublicOffering to config`);
  config.setPublicOffering(usdtPublicOffering.address, true);
  console.log("✅ Done");

  const UsdcPublicOffering = (await ethers.getContractFactory(
    "PublicOffering",
    (await ethers.getSigners())[0])) as PublicOffering__factory;
  const usdcPublicOffering = await UsdcPublicOffering.deploy(config.address, USDC, USDC_FEED);
  await usdcPublicOffering.deployed();
  console.log(`>> Deployed at ${usdcPublicOffering.address}`);

  console.log(`>> Set UsdcPublicOffering to config`);
  config.setPublicOffering(usdcPublicOffering.address, true);
  console.log("✅ Done");
};

export default func;
func.tags = ['DAO'];