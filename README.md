# Hodl

<p align="center">
<img src="./imgs/beers.png" width="100" height="100">
</p>

HODLing has been the best strategy in crypto. **Hodl** is here to help you do that with some extra incentive!

## What is Hodl

Hodl is a protocol designed to let anyone create "hodling competition" on any ERC20 tokens. Users can always choose to quit early with a pentality charged. If a participant successfully hodls the token until expiry, they can withdraw the full amount they despoited without any fee, and with some extra tokens collected from quitters, or other "bonus token" that can be donated to the pool.

The spirit is that if you plan to hodl a token anyway, there's nothing you can loose by participating in such a "game". We want to encourage people to simply hodl tokens and focus more on the long-term achievements of corresponding projects.

### Use cases

#### Community Treasury
A team with a token who wishes to stablize the token price can provide some extra incentive for people to hodl their tokens and not sell for a longer period of time. This can also be customized as a "Lock" contract, where quitters loose 100% of their deposits. We believe that these use cases can be helpful for projects to incentivize long-term hodlers.

#### Vesting contract
Projects can mint an "hToken" (hodl token) to a user or a community member by locking up the token. The user who then recieves hTokens cannot trade them, but will be able to decide if they want to withdraw now and be penalized, or maybe wait for a year or so to recieve the full amount. This is somewhat similar to the idea of vesting, but with more customizable features.

#### Long-term staker reward
Many protocols with tokens provide a staking mechinism for token holders to earn some extra reward, but it's also common for people to leave the pool once the liqudity mining program is over. With Hodl, projects can incentivize long-term stakers by launching a Hodl contract on "stake shares" tokens, and make sure that only the people who hold until the end get rewarded.

#### Bootstrap Liquidity by incentivizing long-term LP
This is very similar to the previous use case, but takes advantage of the `bonusToken` feature of Hodl. It might not be the best idea to incentivie LP token holders with more LP tokens, because the risk that the market makers are taking is huge and hard to offset by offering more LP shares. This is when the `bonusToken` becomes helpful - it allows pool creators to use a different token to reward the "LP token hodlers". This also solves the problem of needing some on-going liquidity mining programs to keep people in the game.

#### Other Innovations
You can always wrap your hToken into some tradable ERC20 tokens by using another wrapping contract, and add more interesting logic to build fun projects, e.g., make it transferable only until a certain date.


## What is in this repository

This is the contract repo for **Hodl**, which enables anyone to create hodling pools. There are 2 contracts in the core folder:

- `HodlERC20`: Implementation contract to "Hodl" an ERC20.
- `HodlFactory`: Factory contract to clone `HodlERC20` with EIP1167.

## What does HodlERC20 do?

When a user deposit ERC20 into a HODL pool, the tokens will be locked up in the contract until the end of a pre-defined **expiry**. If a user wants to remove their funds before expiry, they will be penalized by `penalty` proportional to their deposit, and the slashed amount will go back in to the **reward pool** that will be shared by everyone else holding a "share".

### Shares and hTokens

Every time you join a pool, you get a `hodl` Token + some shares. The hodl token is a **non-transferable** ERC20 - this is to prevent anyone from creating a secondary market to trade this token, which would eventually make it not a hodl strategy anymore.

The shares you get from the deposit will decrease (linearly / exponentially according to a decrease parameter `n`) as time goes by - this is to prevent a last minute depositor from enjoying the full reward. This also means that the earlier you deposit, the more shares of the pool you can get.

### Fees

A `fee` is charged from penalty when a pool member quits early. The creator of the HodlERC20 contract can specify a `feeRecipient` address that can later collect those fees. For example, it can be set to a governance contract address that distributes the reward to all token stakers.

All quitter's penalty goes to the common pool, from which anyone with a pool share can proportionnaly redeem at any time.
When a user quits, they are also forced to redeeme some of the pool shares (proportional to the amount they're withdrawing). This is necessary to prevent people from leaving the pool early but still earning rewards.

## Run this repo locally

### install

```bash
npm i 
```

### test

```bash
# unit test
npx hardhat test
# coverage test
npx hardhat coverage 
```

### Lint

```bash
npx hardhat format
```

### Run slither analysis

Slither is a static code analysis tool that helps to detect bad smart contract patterns.

#### Install [Slither](https://github.com/crytic/slither)
```
pip3 install slither-analyzer
```
Or find more details [here](https://github.com/crytic/slither#how-to-install) in their documentation.

#### Run Analysis

```
slither .
```
