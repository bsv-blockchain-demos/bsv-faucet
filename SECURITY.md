# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue, pull request or discussion for a suspected vulnerability.

Include what you found, the steps to reproduce it and the impact you expect. We will acknowledge the report, keep you updated while we investigate and credit you in the fix unless you prefer otherwise.

## Scope

The faucet at [bsvfaucet.com](https://bsvfaucet.com), the code in this repository and the pairing relay in [`relay/`](relay/README.md) are in scope. Findings of particular interest include anything that lets someone withdraw more than the per-user limit, act as another user, reach admin features or read another user's data.

The faucet only handles testnet coins, which have no monetary value, but the treasury is shared by the whole developer community, so draining it is still treated as serious.
