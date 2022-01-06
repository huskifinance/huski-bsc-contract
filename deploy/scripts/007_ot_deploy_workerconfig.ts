import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades } from 'hardhat';
import { FileService } from "../utils";
import { IVault, IVault__factory, WorkerConfig__factory } from '../../typechain';
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
  const SIMPLE_ORACLE_ADDR = config.Oracle.SimpleOracle;
  // const SIMPLE_ORACLE_ADDR = '0xFb0645d38e35DA4C4Aa0079366B7d9905f162fCe';



  console.log(">> Oracle Address", SIMPLE_ORACLE_ADDR);
  console.log(">> Deploying an upgradable WorkerConfig contract");
  const WorkerConfig = (await ethers.getContractFactory(
    'WorkerConfig',
    (await ethers.getSigners())[0]
  )) as WorkerConfig__factory;
  const workerConfig = await upgrades.deployProxy(
    WorkerConfig,[SIMPLE_ORACLE_ADDR], { unsafeAllow: ['delegatecall'] }
  );
  // await workerConfig.deployed();
  console.log(`>> Deployed at ${workerConfig.address}`);

  console.log(">> Write WorkerConfig address to config");
  config.SharedConfig.WorkerConfig = workerConfig.address;
  FileService.write(network.name, config);
  console.log("✅ Done");
};

export default func;
func.tags = ['WorkerConfig'];