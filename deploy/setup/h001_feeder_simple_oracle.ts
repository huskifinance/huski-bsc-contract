import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades } from 'hardhat';
import { FileService } from "../utils";
import { SimplePriceOracle__factory } from '../../typechain';
import MainnetConfig from '../results/mainnet.json'
import TestnetConfig from '../results/testnet.json'
import { BigNumber } from 'ethers';

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

  const FEEDER_ADDR = '0x73d7f40c3adc7e6eb693a99a7a5d41757e0a8a74';





  console.log(">> Feeder Address", FEEDER_ADDR);
  console.log(">> Setting an feeder to SimplePriceOracle contract");
  
  const simplePriceOracle = SimplePriceOracle__factory.connect(config.Oracle.SimpleOracle, (await ethers.getSigners())[0])
  await simplePriceOracle.setFeeder(FEEDER_ADDR)

  // await simplePriceOracle.setPrices(['0xCCaf3FC49B0D0F53fe2c08103F75A397052983FB'], 
  // ['0x0266693F9Df932aD7dA8a9b44C2129Ce8a87E81f'], ['56702410000000010000000'])
  console.log("✅ Done");
};

export default func;
func.tags = ['FeederSimpleOracle'];