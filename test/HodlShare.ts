import { ethers, waffle } from 'hardhat';
import { expect } from 'chai';
import { HodlShare, MockERC20 } from '../typechain';
import { BigNumber, utils } from 'ethers';

describe('HodlShare Tests', function () {
  let hodl: HodlShare;
  let token: MockERC20;
  let accounts = [];

  this.beforeAll('Deploy HodlShare', async () => {
    accounts = await ethers.getSigners();
    const HodlShare = await ethers.getContractFactory('HodlShare');
    const contract = await HodlShare.deploy();
    hodl = contract as HodlShare;
  });

  this.beforeAll('Deploy Mock tokens', async () => {
    const ERC20 = await ethers.getContractFactory('MockERC20');
    const erc20 = await ERC20.deploy();
    token = erc20 as MockERC20;
    await token.init('WETH', 'WETH', 18);

    // mint 100 WETH to account 0, 1 , 2, 3
    const amount = utils.parseUnits('100', 'ether');
    await token.mint(accounts[0].address, amount);
    await token.mint(accounts[1].address, amount);
    await token.mint(accounts[2].address, amount);
  });

  describe('#init', () => {
    let accounts = [];
    const penalty = 50; // 5%
    const lockingWindow = 86400 * 7;
    const expiry = parseInt((Date.now() / 1000).toString()) + 86400 * 30;
    const name = 'hodl share WETH';
    const symbol = 'hWETH';
    let feeRecipient: string;

    this.beforeAll('Set accounts', async () => {
      accounts = await ethers.getSigners();
      feeRecipient = accounts[3].address;
    });

    it('Should revert when init with invalid penalty', async function () {
      await expect(
        hodl.init(token.address, 1001, lockingWindow, expiry, feeRecipient, name, symbol)
      ).to.be.revertedWith('INVALID_PENALTY');
    });

    it('Should revert when init with invalid expiry', async function () {
      const wrongExpiry = expiry - 86400 * 30;
      await expect(
        hodl.init(token.address, penalty, lockingWindow, wrongExpiry, feeRecipient, name, symbol)
      ).to.be.revertedWith('INVALID_EXPIRY');
    });

    it('Should revert when init with locking window too long', async function () {
      const wrongLockingWindow = 86400 * 31;
      await expect(
        hodl.init(token.address, penalty, wrongLockingWindow, expiry, feeRecipient, name, symbol)
      ).to.be.revertedWith('INVALID_EXPIRY');
    });

    it('Should initialize the contract', async function () {
      await hodl.init(token.address, penalty, lockingWindow, expiry, feeRecipient, name, symbol);

      const fee = await hodl.totalFee();
      const reward = await hodl.totalReward();
      const totalSupply = await hodl.totalSupply();
      const _expiry = await hodl.expiry();

      expect(fee.isZero());
      expect(reward.isZero());
      expect(totalSupply.isZero());
      expect(_expiry.eq(expiry));
    });

    it('Should revert when trying to re-init', async function () {
      await expect(
        hodl.init(token.address, 0, 0, 0, feeRecipient, name, symbol)
      ).to.be.revertedWith('Initializable: contract is already initialized');
    });
  });
});
