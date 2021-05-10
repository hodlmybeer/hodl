import { ethers, waffle } from 'hardhat'
import { expect } from"chai";
import { HodlShare, MockERC20 } from '../typechain'
import { BigNumber, utils } from 'ethers';

describe("HodlShare", function() {
  let hodl: HodlShare
  let token: MockERC20

  this.beforeAll("Deploy HodlShare", async () => {    
    const HodlShare = await ethers.getContractFactory("HodlShare");
    const contract  = await HodlShare.deploy();
    hodl = (contract as HodlShare);
  })

  this.beforeAll("Deploy Mock tokens", async () => { 
    const accounts = await ethers.getSigners();   
    const ERC20 = await ethers.getContractFactory("MockERC20");
    const erc20  = await ERC20.deploy();
    token = (erc20 as MockERC20);
    await token.init('WETH', 'WETH', 18);

    // mint 100 WETH to account 0, 1 , 2, 3
    const amount = utils.parseUnits('100', 'ether')
    await token.mint(accounts[0].address, amount)
    await token.mint(accounts[1].address, amount)
    await token.mint(accounts[2].address, amount)
  })

  it("Should initialize the contract", async function() {
    const accounts = await ethers.getSigners();   

    const penalty = 50 // 5%
    const lockingWindow = 86400 * 7
    const expiry = parseInt((Date.now() / 1000).toString()) + (86400 * 30)
    const feeRecipient = accounts[3] 

    await hodl.init(token.address, penalty, lockingWindow, expiry, feeRecipient.address, 'hodl share WETH', 'hWETH')

    const fee = await hodl.totalFee()
    const reward = await hodl.totalReward()
    const totalSupply = await hodl.totalSupply()
    const _expiry = await hodl.expiry()

    expect(fee.isZero(), "Fee is zero")
    expect(reward.isZero())
    expect(totalSupply.isZero())
    expect(_expiry.eq(expiry))
  });
});
