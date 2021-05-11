# ¡Hodl!

Hodling has been the best strategy in crypto. **¡Hodl!** is here to help you do that with some extra incentive!

This is the contract repo for **¡Hodl!**, which enables anyone to create hodling pools.

## What does Hodl do?

When a user deposit into a HODL pool, his fund will be lockup in the contract till the end of a pre-defined **expiry**. If a users want to remove his fund prior to expiry, he will be penalized and the slashed amount will go back in to the **reward pool** that will be shared by everyone else holding the "share".

### Shares and hTokens

Everytime you join the pool, you got a `hodl` Token + a share, the hodl token is a **non-transferable** ERC20, this is to prevent anyone from creating a secondary market to trade this token, which will eventually make this not a hodl strategy anymore. The share you get from deposit will decrease exponentially as time goes by, this is to prevent last minute depositor sharing all the rewards. 

the creator of the contract can specify a `feeRecipient` address that accured fee from quitters. This can later be set to a governance contract that distribute the reward to all token stakers.

All quitter's penalty go to a common pool, which anyone with the pool share can redeem their proportion anytime.
When a user quit, he / she is also forced to redeemed some pool shares (proportional to the amount they're withdrawing). This is to prevent people from leaving the pool early but still earning rewards.
