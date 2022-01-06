import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { FileService } from "../utils";
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
  const WNATIVE_ADDR = config.NativeAddress;

  // const WNATIVE_ADDR = '0xDfb1211E2694193df5765d54350e1145FD2404A1';





  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  console.log(">> Native Address", WNATIVE_ADDR);
  await deploy('WNativeRelayer', {
    from: deployer,
    args: [WNATIVE_ADDR],
    log: true,
    deterministicDeployment: false,
  });

  console.log(">> Write Native address to config");
  config.SharedConfig.WNativeRelayer = (await deployments.get('WNativeRelayer')).address;
  FileService.write(network.name, config);
  console.log("✅ Done");
};

export default func;
func.tags = ['WNativeRelayer'];