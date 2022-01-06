import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import MainnetConfig from '../results/mainnet.json'
import TestnetConfig from '../results/testnet.json'
import { FileService } from "../utils";

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

  const DELAY_IN_DAYS = 1;


  const { deployments, getNamedAccounts, network  } = hre;
  const { deploy } = deployments;
  
  const config = network.name === "mainnet" ? MainnetConfig : TestnetConfig
  const ADMIN_ADDRESS = config.AdminAddress;

  const { deployer } = await getNamedAccounts();
  console.log(">> Deployer address", deployer);

  await deploy('Timelock', {
    from: deployer,
    args: [
      ADMIN_ADDRESS,
      DELAY_IN_DAYS*24*60*60,
    ],
    log: true,
    deterministicDeployment: false,
  });

  console.log(">> Write Timelock address to config");
  config.Timelock = (await deployments.get('Timelock')).address;
  FileService.write(network.name, config);
  console.log("✅ Done");
};

export default func;
func.tags = ['TimeLock'];