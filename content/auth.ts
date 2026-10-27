/** Copy for the sign up and log in surfaces (nav, hero, /login, /welcome, the account menu). */
export const AUTH_COPY = {
  logIn: "Log in",
  signUp: "Sign up",
  logInOrSignUp: "Log in or sign up",
  openStudio: "Open Studio",
  studio: "Studio",
  signInPath: "/login",
  signUpPath: "/login?mode=signup",

  /** The card on /login. */
  card: {
    loginTitle: "Log in",
    signupTitle: "Create your account",
    loginLead: "Enter your email and we send you a code.",
    signupLead: "Your email gets a verification code. Then we set up your account.",
    email: "Email",
    emailPlaceholder: "you@email.com",
    continue: "Continue",
    productUpdates: "Send me product updates",
    or: "or",
    walletMetamask: "Continue with MetaMask",
    walletCoinbase: "Continue with Coinbase Wallet",
    walletEmailLead: "Your wallet is verified. Add the email for your account.",
    noAccount: "No account for this email yet.",
    noAccountSwitch: "Sign up instead",
    noWalletAccount: "No account for this wallet yet.",
    noWalletAccountSwitch: "Sign up with this wallet",
    haveAccount: "There is already an account with this email.",
    haveAccountSwitch: "Log in instead",
    walletTaken: "This wallet already belongs to an account.",
    walletEmailTaken:
      "That email already belongs to an account. Log in with it and add this wallet under Account.",
    secondFactor:
      "This account needs a second sign-in step that Studio does not support yet. Finish signing in on canhav.com.",
    missingFields: (fields: string) =>
      `Sign-up needs more fields than Studio collects here (${fields}). Check the Clerk settings.`,
    abandoned: "That sign-up timed out. Start again.",
    finishing: "Signing you in…",
  },

  /** The verification code step. */
  code: {
    title: "Check your email",
    lead: (email: string) => `We sent a 6-digit code to ${email}.`,
    label: "Code",
    verify: "Verify",
    resend: "Send a new code",
    resendIn: (s: number) => `Send a new code in ${s}s`,
    changeEmail: "Use a different email",
  },

  /** The three sign-up steps on /welcome. */
  welcome: {
    title: "Set up your account",
    lead: "Three short steps. The first is the only one we need.",
    steps: { name: "Your name", avatar: "Avatar", build: "How you build" },
    name: {
      lead: "Your name is shown to your team. Your handle is the byline on your public project pages.",
      first: "First name",
      last: "Last name",
      handle: "Public handle",
      handleHint: "3 or more characters: letters, numbers and underscores.",
      handleTaken: "That handle is taken.",
      continue: "Continue",
    },
    avatar: {
      lead: "A picture for your account. You can add one later under Account.",
      pick: "Choose an image",
      change: "Choose another image",
      upload: "Upload and continue",
      skip: "Skip",
      back: "Back",
      tooLarge: "Pick an image under 5 MB.",
      badType: "Use a PNG, JPEG, WebP or GIF.",
    },
    build: {
      lead: "Optional. Three quick taps so the studio can show the setup for your tools.",
      role: "Your role",
      roleOther: "Tell us more",
      roleOtherPlaceholder: "What do you do?",
      experience: "Your experience",
      ide: "Your AI IDE",
      ideHint: "The MCP connect steps and agent prompt are shown for this tool.",
      finish: "Finish",
      back: "Back",
    },
    saving: "Saving…",
    failed: "That could not be saved. Try again.",
  },

  /** The small popup on the studio after the last step. */
  welcomeToast: "Congratulations, you have signed up to CanHav.",

  /** The avatar menu. */
  account: "Account",
  signOut: "Sign out",
} as const;
