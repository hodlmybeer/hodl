import "@nomiclabs/hardhat-waffle";
import { task, types } from "hardhat/config"


// Example execution
// npx hardhat whitelist --network matic --factory  --token 0xaa...
task("whitelist", "Whitelist a token")
  .addParam('factory', 'factory address', undefined, types.string)
  .addParam('token', 'Token address', undefined, types.string)
  .setAction(async ({token, factory}, hre) => {

  const { ethers } = hre;
  
  const factoryContract = await ethers.getContractAt("HodlFactory", factory);
  
  await factoryContract.whitelistAsset(token, true)
  console.log(`Token whitelisted ...  🍨`)
});
