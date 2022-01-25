import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { FileService } from "../utils";
import { StronkHusky__factory } from '../../typechain';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {

  console.log(">> Deploying a StronkHusky contract");
  const StronkHusky = (await ethers.getContractFactory(   "StronkHusky",    (await ethers.getSigners())[0],  )) as StronkHusky__factory;
  
  console.log("✅ Done");

};

export default func;
func.tags = ['StronkHusky'];
