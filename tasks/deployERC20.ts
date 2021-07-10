import { task, types } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";

// Example execution
// npx hardhat deployERC20 --decimals 18 --name QuickSwap --symbol QUICK --network mumbai
task("deployERC20", "Deploy a MockERC20")
  .addParam('name', 'Token name', undefined, types.string)
  .addParam('symbol', 'Token symbol', undefined, types.string)
  .addParam('decimals', 'Token decimals', 18, types.string)
  .setAction(async ({name, symbol, decimals}, hre) => {

  
  const ERC20 = await hre.ethers.getContractFactory("MockERC20");
  const erc20 = await ERC20.deploy();
  
  await erc20.deployed();
  console.log(`New mock ERC20 deployed at ${erc20.address} 🍜`)
  
  console.log(`Setting token detail...  🍨`)
  await erc20.init(name, symbol, decimals)
  
  await hre.run("verify:verify", {
    address: erc20.address, 
    network: hre.ethers.provider.network
  })
});
