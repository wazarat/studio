# Alerts

Studio+ teams can have CanHav watch their contracts and tell them within a
minute when something happens on chain. Everything lives on the project
page under **Deployments**, in the **Alerts** section, and nothing needs a
terminal or a key.

## One switch

**Watch this project** creates a rule for every recorded testnet contract
(ownership changes, pauses and unpauses) and for every token launched from
or linked to the project (those, plus large transfers above one percent of
the supply and curve graduation). A contract recorded later is watched too;
the rules are brought in line with the record every time the section
loads. Turning the switch off removes those rules and leaves any you added
by address.

The first time the switch goes on and the project has no channel, the
email on your account becomes the first channel.

## Where alerts go

Up to five channels per project:

- **Email**, any address.
- **Telegram**, through **Connect Telegram** where the deployment runs a
  CanHav bot: the studio opens a link to the bot, you press Start, and the
  row reads Connected. No bot token to paste. The button is absent while no
  bot is configured; a team with its own bot can always paste the token and
  chat id under **Use your own Telegram bot**.
- **Discord**, a webhook URL from the channel's Integrations settings.
  CanHav posts a hello message to it before saving, so a wrong paste never
  saves.

Webhooks and bot tokens are encrypted before they are stored and the
studio shows only a masked form.

## Proving it works

**Send a test alert** sends one synthetic alert through every channel at
once and records it under **Last events**, marked Test. Check your inbox or
chat. One a minute per project.

The status line under the switch reads from the worker: "Watching 7
addresses on Robinhood Chain Testnet, last checked 40 seconds ago". Right
after a change it reads "Changes load within a minute"; if the worker has
not checked in for three minutes it says so, and events are recorded once
it is back.

## Watching another address

**Watch another address** holds the per address form: any address on the
project's chain, a name, the kinds to alert on, and for large transfers a
threshold in whole tokens, converted with the token's own decimals. Up to
ten rules this way; the switch's rules do not count.

## Seeing a real event

CanHav holds no keys, so a real on chain event is the team's to make. One
line from the repository that deployed the contract, with Foundry:

```
cast send <contract> "pause()" --rpc-url https://rpc.testnet.chain.robinhood.com --private-key $DEPLOYER_PRIVATE_KEY
```

and `unpause()` after. Within two minutes both show under Last events and
arrive on every channel.

## For agents

Over the project's MCP server, `get_alerts` returns the switch, the rules,
the channels (masked), the last events and the worker's status;
`set_alert_watch` turns the switch on or off; `send_test_alert` sends the
test. Channels are connected by the owner in the studio.

## How it runs

A small worker polls both testnets every minute and reloads the rules
every minute (only the rules of projects whose team is on Studio+; a team
off the plan keeps its rules and is watched again when the plan is active), reads at most two thousand blocks a poll, and catches up a
window a minute after a pause. The cursor per chain follows the head while
nothing is watched, so a rule starts from now; nothing from before it is
alerted. Public RPCs can rate limit; a failed poll is retried from the same
place next minute, so nothing is skipped.

## Related

- [Studio+](../accounts/studio-plus.md)
- [Governance](governance.md), the timelock behind every admin change on
  the platform's own contracts
