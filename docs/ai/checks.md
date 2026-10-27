# Automated checks

**Studio+.** A workflow in your repository runs Slither (or Aderyn) on the contracts and asks Sourcify whether the deployed addresses are verified, then posts one run per tool to the project. The Review milestone shows the newest run beside the team's own verdict, so a pass reads as proof rather than a tick.

## Setup

The same **GitHub setup** card on Deployments (see [GitHub sync](github-sync.md)): the write key in the repository secret `CANHAV_PROJECT_KEY`, and the **Checks workflow** downloaded with the project's chain id and the CanHav address filled in, saved at `.github/workflows/canhav-checks.yml`. Set the repository variable `CANHAV_ADERYN` to `1` to run Aderyn instead of Slither. The plain template is `.github-templates/canhav-checks.yml` in the CanHav repository and reads the variables `CANHAV_CHAIN_ID` and `CANHAV_URL` instead.

## What it posts

| Tool | Summary | Result |
|------|---------|--------|
| Slither or Aderyn | Counts by severity and up to twenty findings with title, severity and file | Fail when any high finding, else pass; error when the tool did not run |
| Sourcify | Per address, full, partial or none, for the addresses in the chain's broadcast files | Pass when every address is verified |

A Sourcify run may only name addresses recorded on Deployments (GitHub sync records them), on the project's chain. The static analysis run shows on the **Static analysis** review pass as "Passed Slither, run 3 Nov" with the counts and the run link; the Sourcify run shows under the testnet contracts on Deployments. The team's verdict stays its own; the run is the evidence beside it.

## Evidence for every account

Every review pass has an evidence field, a run link, a test name or a commit, that any account can fill by hand (`update_project` takes `evidence` on each `kit.review` entry too). It exports with the pass line, so verified evidence is never paid only; Studio+ adds the workflow that fills the automatic runs.

## Related

- [GitHub sync](github-sync.md)
- [Studio+](../accounts/studio-plus.md)
