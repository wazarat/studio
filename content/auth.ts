/** Copy for the sign up and log in surfaces (nav, hero, /login, the studio pop-up, the account menu). */
export const AUTH_COPY = {
  logIn: "Log in",
  signUp: "Sign up",
  logInOrSignUp: "Log in or sign up",
  openStudio: "Open Studio",
  studio: "Studio",
  signInPath: "/login",
  signUpPath: "/login?mode=signup",

  /** The sign-up page heading, as on canhav.com. */
  signUpKicker: "Accounts",
  signUpTitle: "Create your account",
  signUpLead:
    "Sign up with your email, Google or your wallet to open the studio, design a project or a token, and publish it for anyone to verify.",
  noAccount: "No account yet?",
  haveAccount: "Already have an account?",

  /** The three sign-up steps in the pop-up over /studio. */
  welcome: {
    title: "Set up your account",
    lead: "Three short steps. The first is the only one we need.",
    steps: { name: "Your name", avatar: "Avatar", build: "How you build" },
    name: {
      lead: "Your name is shown to your team. Your username is the byline on your public project pages.",
      first: "First name",
      last: "Last name",
      handle: "Username",
      handleTaken: "That username is taken.",
      productUpdates: "Send me product updates",
      continue: "Continue",
    },
    avatar: {
      lead: "A picture for your account. You can add one later under Account.",
      pick: "Choose an image",
      change: "Choose another image",
      remove: "Remove",
      next: "Next",
      back: "Back",
      tooLarge: "Pick an image under 5 MB.",
      badType: "Use a PNG, JPEG, WebP or GIF.",
    },
    build: {
      lead: "Optional. Three quick picks so the studio can show the setup for your tools.",
      placeholder: "Choose…",
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
