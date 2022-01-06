import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { ethers, upgrades } from 'hardhat';
import { FileService } from "../utils";
import { Vault__factory, MockWBNB__factory } from '../../typechain';
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
  const { network, getNamedAccounts  } = hre;
  const config = network.name === "mainnet" ? MainnetConfig : TestnetConfig
  const VAULT_ADDR = '0xf9d32C5E10Dd51511894b360e6bD39D7573450F9'; // config.Vaults[3].address
  const WORKER_ADDR = '0x937ADf954C878155B51aAd9d7b95D5C1C13fD315'; // config.Vaults[3].workers[2].address
  const StrategyAddBaseTokenOnly_ADDR = '0x2943b6fC64bDF5bD26E9DFeB9b35d1DBcbdE936C'; // config.SharedStrategies.StrategyAddBaseTokenOnly
  
  
  console.log(">> Open a position without debt");
  console.log(">> Vault name : ", config.Vaults[3].name);
  console.log(">> Worker name : ", config.Vaults[3].workers[2].name);

  console.log(">> Deployer address", (await ethers.getSigners())[0].address);
  // const wbnb = MockWBNB__factory.connect(config.Tokens.WBNB, (await ethers.getSigners())[0])
  // await wbnb.approve(VAULT_ADDR, ethers.utils.parseEther('1'))
  // console.log(">> Sleep for 10000msec waiting for token to approve");
  // await new Promise(resolve => setTimeout(resolve, 10000));

  await new Promise(resolve => setTimeout(resolve, 10000));
  const bnbVault = Vault__factory.connect(VAULT_ADDR, (await ethers.getSigners())[0])
  await bnbVault.work(
    0,
    WORKER_ADDR,
    ethers.utils.parseEther('0.3'),
    ethers.utils.parseEther('0'),
    '0',
    ethers.utils.defaultAbiCoder.encode(
      ['address', 'bytes'],
      [StrategyAddBaseTokenOnly_ADDR, ethers.utils.defaultAbiCoder.encode(
        ['uint256'],
        ['0'])
      ]
    ),
    {
      gasLimit: 30000,
      gasPrice: 10*1e9
    }
  )

  console.log("✅ Done");
};

export default func;
func.tags = ['OpenPositionVault'];