import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades } from 'hardhat';
import { FileService } from "../utils";
import { SimplePriceOracle__factory } from '../../typechain';
import MainnetConfig from '../results/mainnet.json'
import TestnetConfig from '../results/testnet.json'

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
  const { network  } = hre;
  const config = network.name === "mainnet" ? MainnetConfig : TestnetConfig
  const FEEDER_ADDR = config.FeederAddress;
  // const FEEDER_ADDR = '0xc1594110aF71D31c7F64F1EeD1f540307964873c';





  console.log(">> Feeder Address", FEEDER_ADDR);
  console.log(">> Deploying an upgradable SimplePriceOracle contract");
  const SimplePriceOracle = (await ethers.getContractFactory(
    'SimplePriceOracle',
    (await ethers.getSigners())[0]
  )) as SimplePriceOracle__factory;
  const simplePriceOracle = await upgrades.deployProxy(
    SimplePriceOracle,[FEEDER_ADDR], { unsafeAllow: ['delegatecall'] }
  );
  await simplePriceOracle.deployed();
  console.log(`>> Deployed at ${simplePriceOracle.address}`);

  console.log(">> Write simplePriceOracle address to config");
  config.Oracle.SimpleOracle = simplePriceOracle.address;
  FileService.write(network.name, config);
  console.log("✅ Done");
};

export default func;
func.tags = ['SimpleOracle'];