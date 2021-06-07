import { ethers, waffle } from 'hardhat';
import { expect } from 'chai';
import { HodlFactory, MockERC20, HodlERC20, HodlERC20__factory } from '../typechain';
import { BigNumber, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('Hodl Factory Tests', function () {
  const provider = waffle.provider;
  const totalDuration = 86400 * 5; // 3 days period
  const expiry = BigNumber.from(parseInt((Date.now() / 1000).toString()) + totalDuration);
  let factory: HodlFactory;
  let token: MockERC20;
  let accounts: SignerWithAddress[] = [];
  let creator: SignerWithAddress;
  let implementation: HodlERC20
  
  const penalty = 50; // 5%
  const lockingWindow = 86400 * 1; // 1 day locking
  const fee = 50; //5% of penalty
  const n = 1; // linear decay
  
  this.beforeAll('Set accounts', async () => {  
    accounts = await ethers.getSigners();
    const [_creator] = accounts;
    creator = _creator
  });

  this.beforeAll('Deploy HodlERC20 and mock contract', async () => {
    const HodlERC20 = await ethers.getContractFactory('HodlERC20');
    const contract = await HodlERC20.deploy();
    implementation = contract as HodlERC20;

    const ERC20 = await ethers.getContractFactory('MockERC20');
    const erc20 = await ERC20.deploy();
    token = erc20 as MockERC20;
    await token.init('WETH', 'WETH', 18);
  })

  this.beforeAll('Deploy factory', async () => {
    const Factory = await ethers.getContractFactory('HodlFactory');
    factory = await Factory.deploy(implementation.address);
  })

  it('deploy a new clone', async() => {

    const targetAddress = await factory.getTargetHTokenAddress(token.address, penalty, lockingWindow, expiry, fee, n, creator.address, ethers.constants.AddressZero)
    const deployedAddress = await factory.getCreatedHToken(token.address, penalty, lockingWindow, expiry, fee, n, creator.address, ethers.constants.AddressZero)
    expect(deployedAddress.toLowerCase() === ethers.constants.AddressZero).to.be.true
    await factory.connect(creator).createHodlERC20(token.address, penalty, lockingWindow, expiry, fee, n, creator.address, ethers.constants.AddressZero)
    
    const deployedAddressAfter = await factory.getCreatedHToken(token.address, penalty, lockingWindow, expiry, fee, n, creator.address, ethers.constants.AddressZero)
    expect(targetAddress === deployedAddressAfter).to.be.true
  })
  it('should revert when creating the same token', async() => {
    await expect(factory.connect(creator).createHodlERC20(token.address, penalty, lockingWindow, expiry, fee, n, creator.address, ethers.constants.AddressZero)
    ).to.be.revertedWith('CREATED');
  })
});
