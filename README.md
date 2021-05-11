# ¡Hodl!

Hodling has been the best strategy in crypto. **¡Hodl!** is here to help you do that with some extra incentive!

This is the contract repo for **¡Hodl!**, which enables anyone to create hodling pools.

## What does Hodl do?

When a user deposit into a HODL pool, his fund will be lockup in the contract till the end of a pre-defined **expiry**. If a users want to remove his fund prior to expiry, he can only take out a portion of it, the remaining will go back in to the **reward pool** that can be shared by everyone else holding the share.

locking up your fund with mint you a `hold` Token, which is **not transferable**. this is to prevent anyone from creating a secondary market to trade this token, which will eventually make this not a hodl strategy anymore.

the creator of the contract can specify a `feeRecipient` address that accured fee from quitters. This can later be set to a governance contract that distribute the reward to all token stakers.

All quitter's penalty go to a common pool, which anyone with the pool share can redeem their propotion anytime.
When a user quit, he / she is also forced to redeemed all the out standing pool shares.
