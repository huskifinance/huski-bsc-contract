import { ethers, network } from "hardhat";
import "@openzeppelin/test-helpers";
import { SimplePriceOracle__factory, PancakePair__factory } from "../typechain";
import MainnetConfig from '../deploy/results/mainnet.json'
import TestnetConfig from '../deploy/results/testnet.json'

const config = network.name === "mainnet" ? MainnetConfig : TestnetConfig

async function queryOraclePrice(name: string, token0: string, token1: string) {
  console.log(config.Oracle.SimpleOracle)
  const simplePriceOracle = SimplePriceOracle__factory.connect(config.Oracle.SimpleOracle, (await ethers.getSigners())[0])
  const [price, lastTime] = await simplePriceOracle.getPrice(token0, token1)
  console.log(`name: ${name}, price: ${price}, lastUpdate: ${lastTime}`)
}

async function main() {

  const promises = []
  for (let i = 0; i < config.Exchanges.Pancakeswap.LpTokens.length; i++) {
    const pancakePair = PancakePair__factory.connect(config.Exchanges.Pancakeswap.LpTokens[i].address, ethers.provider)
    const token0 = await pancakePair.token0()
    const token1 = await pancakePair.token1()
    console.log(config.Exchanges.Pancakeswap.LpTokens[i].name)
    console.log("token0: ", token0)

    // for (let j = 0; j < config.Vaults.length; j++) {
    //   for (let k = 0; k < config.Vaults[j].workers.length; k++) {
    //     if (config.Vaults[j].workers[k].pId != config.Exchanges.Pancakeswap.LpTokens[i].pId) {
    //       continue
    //     }
    //     console.log("workers baseToken: ", config.Vaults[j].baseToken)
    //     if (token0 === config.Vaults[j].baseToken) {
    //       promises.push(
    //         queryOraclePrice(config.Exchanges.Pancakeswap.LpTokens[i].name, token0, token1)
    //       )
    //     } else {
          promises.push(
            queryOraclePrice(config.Exchanges.Pancakeswap.LpTokens[i].name, token1, token0)
          )
    //     }
    //   }
    // }

    await Promise.all(promises)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })