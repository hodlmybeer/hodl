# Hodl

<p align="center">
<img src="./imgs/beers.png" width="100" height="100">
</p>

HODLing has been the best strategy in crypto. **Hodl** is here to help you do that with some extra incentive!

## What is Hodl

Hodl is the protocol designed let anyone create "hodling competition" on any ERC20 tokens. Users can always choose to quit early with a pentality charged. If the participant successsful hodl the token until expiry, he can withdraw full amount he despoited without anying fee, and with some extra tokens collected from quitters, or other "bonus token" that can be donated to the pool.

The spirit is, if you plan to hodl a token anyway, there's nothing you can loose to particiapte in such a "game". We want to encourage people to simply hodl tokens and focus more on the long term achievement of a project.

### Use cases

#### Community Treasury
A team with token which wishes to stablize the token price, can provides some extra incentive to incentivize people to hodl their token and not sell for a longer period of time. This can also be customized as a "Lock" contract, where quitters loose 100% of their deposits. We believe that these use cases are useful for projects to incentivize long term hodlers.

#### Vesting contract
Projects can mint a "hToken" (hodl token) to a user or community member by locking up the token. The user who recieved hTokens cannot trade them, but will be able to decide if he wants to withdraw now and being penalized, or wait for maybe a year to recieved the full amount. This is somehow similar to the idea of vesting, but with more customizable ideas.

#### Long term staker reward
Most protocols with tokens provide staking mechinism for token holders to stake and earn some extra money, but it's also common that people will leave the pool once the liqudity mining program is over. With Hodl, projects can incentivize long term stakers by launching a Hodl contract on "stake shares" tokens, and make sure only people who hold til the end get rewarded.

#### Bootstrap Liquidity by incentivizing long term LP
This is very similar to the previous use case, but especially featuring the `bonusToken` feature in Hodl. It's probably not the best to incentivie LP token holders with more LP tokens, cause the risk market makers are taking is huge and it's hard to be offset by offering more LP shares. This is when the `bonusToken` is helpful, where pool creators can use another token to reward the "LP token hodlers". This also solve the problems of needing an on-going liquidity mining programs to keep people in the game.

#### Other Innovations
You can always wrap our hToken into some tradable ERC20 tokens by using another wrapping contract, and add more interesting logic to build fun projects, e.g. make it only transferable before certain date.


## What is in this repository

This is the contract repo for **Hodl**, which enables anyone to create hodling pools. There are 2 contracts in the core folder:

- `HodlERC20`: Implementation contract to "Hodl" an ERC20.
- `HodlFactory`: Factory contract to clone `HodlERC20` with EIP1167.

## What does HodlERC20 do?

When a user deposit ERC20 into a HODL pool, the tokens will be lockup in the contract till the end of a pre-defined **expiry**. If a users want to remove his fund before expiry, he will be penalized by `penalty` proportional to his deposit, and the slashed amount will go back in to the **reward pool** that will be shared by everyone else holding the "share".

### Shares and hTokens

Everytime you join the pool, you got a `hodl` Token + some shares, the hodl token is a **non-transferable** ERC20, this is to prevent anyone from creating a secondary market to trade this token, which will eventually make this not a hodl strategy anymore.

The shares you get from deposit will decrease (linear / exponential according to a decrease parameter `n`.) as time goes by, this is to prevent last minute depositor sharing all the rewards. This also means that the earlier you deposit, the more shares of the pool you can get.

### Fees

A `fee` is charged from penalty when a user quit early. The creator of the HodlERC20 contract can specify a `feeRecipient` address that can later collect those fees. This can later be set to a governance contract that distribute the reward to all token stakers.

All quitter's penalty go to a common pool, which anyone with the pool share can redeem their proportion anytime.
When a user quit, he / she is also forced to redeemed some pool shares (proportional to the amount they're withdrawing). This is to prevent people from leaving the pool early but still earning rewards.

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

Slither is a static code analysis tool that help detect bad smart contract patterns.

#### Install [Slither](https://github.com/crytic/slither)
```
pip3 install slither-analyzer
```
Or find more detail [here](https://github.com/crytic/slither#how-to-install) in their documentation.

#### Run Analysis

```
slither .
```
