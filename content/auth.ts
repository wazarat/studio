/** Copy for the sign up and log in surfaces (nav, hero, /login). */
export const AUTH_COPY = {
  logIn: "Log in",
  signUp: "Sign up",
  logInOrSignUp: "Log in or sign up",
  openStudio: "Open Studio",
  signUpKicker: "Accounts",
  signUpTitle: "Create your account",
  signUpLead:
    "Sign up with your email or your wallet to open the studio, design a project or a token, and publish it for anyone to verify.",
  noAccount: "No account yet?",
  haveAccount: "Already have an account?",
  signInPath: "/login",
  signUpPath: "/login",
  /** Wallet identity (M57). A token belongs to the account that holds its creator wallet. */
  /** The studio header's account menu (2026-10-13). */
  account: "Account",
  signOut: "Sign out",
  wallets: "Wallets",
  /** Teams (M107). A Studio+ team is a Clerk organization; its members share the records moved to it. */
  team: "Team",
  teams: "Teams",
  createTeam: "Create a team",
  personal: "Personal",
  switching: "Switching",
  walletsHint: "Add the wallet you launch with and its launches show up here.",
  claim: "Claim with this wallet",
  claiming: "Check your wallet…",
  claimSignIn: "Sign in to claim this launch",
  claimFailed: "The wallet could not be added to your account.",
  claimWalletTaken:
    "This wallet already belongs to another CanHav account. Sign in with the wallet itself, or remove it from that account first.",
  claimWalletsOff: "Wallets are not switched on for accounts yet. Web3 sign-in has to be enabled in Clerk.",
  claimCancelled: "Cancelled. Nothing was changed.",
  /** Every write on the launch pages needs a signed-in account. */
  launchSignIn: "Sign in to launch a token. Your launches are kept on your account and listed in the studio.",
  actSignIn: "Sign in to trade",
  actSignInHint: "Trading and creator actions need a CanHav account. Reading stays open to everyone.",
  attachSignIn: "Sign in to attach a deployed token to your design.",
} as const;
