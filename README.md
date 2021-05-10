# ¡Hodl!

Hodling has been the best strategy in crypto. **¡Hodl!** is here to help you do that with some extra incentive!

This is the contract repo for **¡Hodl!**, which enables anyone to create hodling pools.

## What does Hodl do?

When a user deposit into a HODL pool, his fund will be lockup in the contract till the end of a pre-defined **expiry**. If a users want to remove his fund prior to expiry, he can only take out a portion of it, the remaining will go back in to the **reward pool** that can be shared by everyone else holding the share.

the share (`HodlShare` Token) you get from deposit decreases exponentially as time goes by. So it's possible that an early depositor gets a big portion of the shares with smaller amount of capital, and make money even if he quits early. This is extra incentive that incentivize people to deposit earlier in the cycle.

the creator of the contract can specify a `feeRecipient` address that accured fee from quitters. This can later be set to a governance contract that distribute the reward to all token stakers.

If you hold the pool share (it's an ERC20), you can redeem the extra reward accrued by anyone leaving the pool early. The share become less valueable when more people joining the pool, but it will also increase in value if more people leave. We anticipate to see more innovation come from this token that can be served as a index of market sentiment.

