import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { FileService } from "../utils";
import { StronkHusky__factory } from '../../typechain';

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

  const HUSKI_TOKEN_ADDR = '0x354b3a11D5Ea2DA89405173977E271F58bE2897D';
  const HODLABLE_START_BLOCK = '7328000'
  const HODLABLE_END_BLOCK = '8328000'; // hodl can be called until this block
  const LOCK_END_BLOCK = '9122000'; // unhodl can be called after this block

  // HODLABLE_START_BLOCK = Sun Mar 14 2021 13:19:26 GMT+0700
  // HODLABLE_END_BLOCK = Wed Mar 31 2021 08:39:29 GMT+0700
  // LOCK_END_BLOCK = Mon Jul 12 2021 13:19:44 GMT+0700











  console.log(">> Deploying a StronkHusky contract");
  const StronkHusky = (await ethers.getContractFactory(   "StronkHusky",    (await ethers.getSigners())[0],  )) as StronkHusky__factory;
  // const stronkHusky = await StronkHusky.deploy(
  //   HUSKI_TOKEN_ADDR,
  //   ethers.BigNumber.from(HODLABLE_START_BLOCK),
  //   ethers.BigNumber.from(HODLABLE_END_BLOCK),
  //   ethers.BigNumber.from(LOCK_END_BLOCK),
  // );
  // await stronkHusky.deployed();
  // console.log(`>> Deployed at ${stronkHusky.address}`);
  console.log("✅ Done");

};

export default func;
func.tags = ['StronkHusky'];
