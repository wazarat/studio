"use client";

import { useCallback, useState } from "react";
import { RedirectToTasks, useClerk, useSignIn, useSignUp } from "@clerk/nextjs";

import { CodeStep } from "@/components/auth/CodeStep";
import { WALLET_STRATEGY, WalletButtons, type WalletProvider } from "@/components/auth/WalletButtons";
import { Button } from "@/components/ui/Button";
import { Card, CardSection } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { StatusChip } from "@/components/ui/StatusChip";
import { AUTH_COPY } from "@/content/auth";
import { STUDIO_PATH, WELCOME_PATH, safeRedirectPath } from "@/lib/auth-paths";
import { errorCode, fieldMessage, globalMessage } from "@/lib/clerk-errors";
import { STUDIO_META_KEY } from "@/lib/onboarding";

export type AuthMode = "login" | "signup";
type Phase = "email" | "walletEmail" | "code" | "finalizing" | "task";

/**
 * Log in and sign up on one card. Email plus a code is the required path;
 * a wallet is optional, and a wallet sign-up still has to add and verify an
 * email before the account exists. Built on Clerk's custom-flow objects
 * (useSignIn / useSignUp), never on the prebuilt components, so the steps
 * after this one can be ours.
 */
export function AuthCard({ initialMode, redirectUrl }: { initialMode: AuthMode; redirectUrl: string | null }) {
  const C = AUTH_COPY.card;
  const clerk = useClerk();
  const { signIn, errors: signInErrors, fetchStatus: signInFetch } = useSignIn();
  const { signUp, errors: signUpErrors, fetchStatus: signUpFetch } = useSignUp();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [phase, setPhase] = useState<Phase>("email");
  const [email, setEmail] = useState("");
  const [productUpdates, setProductUpdates] = useState(false);
  const [origin, setOrigin] = useState<"email" | "wallet">("email");
  const [notice, setNotice] = useState<React.ReactNode>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const busy = !clerk.loaded || signInFetch === "fetching" || signUpFetch === "fetching";
  const metadata = { [STUDIO_META_KEY]: { productUpdates } };

  const switchMode = useCallback(
    (next: AuthMode) => {
      void signIn?.reset();
      void signUp?.reset();
      setMode(next);
      setPhase("email");
      setOrigin("email");
      setNotice(null);
      setLocalError(null);
    },
    [signIn, signUp],
  );

  const destination = () => safeRedirectPath(redirectUrl, window.location.origin) ?? STUDIO_PATH;

  /** The navigate callback both finalize calls share. A session task means Clerk needs its own screen first. */
  const navigateTo = (dest: string) =>
    ({ session, decorateUrl }: { session: { currentTask?: unknown } | null; decorateUrl: (url: string) => string }) => {
      if (session?.currentTask) {
        setPhase("task");
        return;
      }
      window.location.assign(decorateUrl(dest));
    };

  // ---- Log in -----------------------------------------------------------

  async function loginWithEmail() {
    if (!signIn) return;
    setNotice(null);
    setLocalError(null);
    const { error } = await signIn.create({ identifier: email.trim() });
    if (error) {
      if (errorCode(error) === "form_identifier_not_found") {
        setNotice(
          <>
            {C.noAccount}{" "}
            <button type="button" className="text-electric-300 underline-offset-2 hover:underline" onClick={() => switchMode("signup")}>
              {C.noAccountSwitch}
            </button>
          </>,
        );
      } else if (errorCode(error) === "session_exists") {
        window.location.assign(destination());
      }
      return;
    }
    const sent = await signIn.emailCode.sendCode();
    if (sent.error) return;
    setPhase("code");
  }

  async function loginWithWallet(provider: WalletProvider) {
    if (!signIn) return;
    setNotice(null);
    setLocalError(null);
    const { error } = await signIn.web3({ provider, strategy: WALLET_STRATEGY[provider] });
    if (error) {
      if (errorCode(error) === "form_identifier_not_found") {
        setNotice(
          <>
            {C.noWalletAccount}{" "}
            <button
              type="button"
              className="text-electric-300 underline-offset-2 hover:underline"
              onClick={() => {
                switchMode("signup");
                void signupWithWallet(provider);
              }}
            >
              {C.noWalletAccountSwitch}
            </button>
          </>,
        );
      }
      return;
    }
    await afterLoginVerified();
  }

  async function loginVerify(code: string) {
    if (!signIn) return;
    const { error } = await signIn.emailCode.verifyCode({ code });
    if (error) return;
    await afterLoginVerified();
  }

  async function afterLoginVerified() {
    if (!signIn) return;
    if (signIn.status === "complete") {
      setPhase("finalizing");
      const { error } = await signIn.finalize({ navigate: navigateTo(destination()) });
      if (error) setPhase("code");
      return;
    }
    if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
      setNotice(C.secondFactor);
    }
  }

  // ---- Sign up ----------------------------------------------------------

  async function signupWithEmail() {
    if (!signUp) return;
    setNotice(null);
    setLocalError(null);
    const { error } = await signUp.create({ emailAddress: email.trim(), unsafeMetadata: metadata });
    if (error) {
      if (errorCode(error) === "form_identifier_exists") setNotice(haveAccountNotice());
      return;
    }
    const sent = await signUp.verifications.sendEmailCode();
    if (sent.error) return;
    setOrigin("email");
    setPhase("code");
  }

  async function signupWithWallet(provider: WalletProvider) {
    if (!signUp) return;
    setNotice(null);
    setLocalError(null);
    const { error } = await signUp.web3({ strategy: WALLET_STRATEGY[provider], unsafeMetadata: metadata });
    if (error) {
      if (errorCode(error) === "form_identifier_exists") {
        setNotice(
          <>
            {C.walletTaken}{" "}
            <button type="button" className="text-electric-300 underline-offset-2 hover:underline" onClick={() => switchMode("login")}>
              {C.haveAccountSwitch}
            </button>
          </>,
        );
      }
      return;
    }
    setOrigin("wallet");
    if (signUp.status === "complete") {
      await finalizeSignup();
      return;
    }
    if (!signUp.emailAddress || signUp.missingFields.includes("email_address")) {
      setPhase("walletEmail");
      return;
    }
    if (signUp.unverifiedFields.includes("email_address")) {
      const sent = await signUp.verifications.sendEmailCode();
      if (!sent.error) setPhase("code");
      return;
    }
    setNotice(C.missingFields(signUp.missingFields.join(", ")));
  }

  async function signupAddWalletEmail() {
    if (!signUp) return;
    setNotice(null);
    setLocalError(null);
    const { error } = await signUp.update({ emailAddress: email.trim() });
    if (error) {
      if (errorCode(error) === "form_identifier_exists") setNotice(C.walletEmailTaken);
      return;
    }
    const sent = await signUp.verifications.sendEmailCode();
    if (sent.error) return;
    setPhase("code");
  }

  async function signupVerify(code: string) {
    if (!signUp) return;
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) return;
    if (signUp.status === "complete") {
      await finalizeSignup();
      return;
    }
    if (signUp.status === "abandoned") {
      setNotice(C.abandoned);
      void signUp.reset();
      setPhase("email");
      return;
    }
    setNotice(C.missingFields(signUp.missingFields.join(", ") || "unknown"));
  }

  async function finalizeSignup() {
    if (!signUp) return;
    setPhase("finalizing");
    const { error } = await signUp.finalize({ navigate: navigateTo(WELCOME_PATH) });
    if (error) setPhase("code");
  }

  function haveAccountNotice() {
    return (
      <>
        {C.haveAccount}{" "}
        <button type="button" className="text-electric-300 underline-offset-2 hover:underline" onClick={() => switchMode("login")}>
          {C.haveAccountSwitch}
        </button>
      </>
    );
  }

  function changeEmail() {
    setNotice(null);
    if (mode === "signup" && origin === "wallet") {
      setPhase("walletEmail");
      return;
    }
    void (mode === "login" ? signIn?.reset() : signUp?.reset());
    setPhase("email");
  }

  // ---- Render -----------------------------------------------------------

  if (phase === "task") return <RedirectToTasks />;

  const errs = mode === "login" ? signInErrors : signUpErrors;
  // A notice with a link already says what the field error would say.
  const emailError =
    localError ??
    (notice
      ? null
      : mode === "login"
        ? fieldMessage(signInErrors.fields.identifier)
        : fieldMessage(signUpErrors.fields.emailAddress));
  const codeError = fieldMessage(errs.fields.code);
  const captchaError = mode === "signup" ? fieldMessage(signUpErrors.fields.captcha) : null;
  const globalError = globalMessage(errs);

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!email.trim()) {
      setLocalError(C.email + " is required.");
      return;
    }
    if (mode === "login") void loginWithEmail();
    else if (phase === "walletEmail") void signupAddWalletEmail();
    else void signupWithEmail();
  };

  return (
    <Card className="max-w-md">
      <CardSection className="space-y-5">
        <Segmented
          value={mode}
          onChange={switchMode}
          role="tablist"
          fill
          ariaLabel="Log in or sign up"
          options={[
            { value: "login", label: AUTH_COPY.logIn },
            { value: "signup", label: AUTH_COPY.signUp },
          ]}
        />

        {phase === "finalizing" ? (
          <p className="text-sm text-ink-300">{C.finishing}</p>
        ) : phase === "code" ? (
          <CodeStep
            email={email.trim()}
            onVerify={mode === "login" ? loginVerify : signupVerify}
            onResend={async () => {
              if (mode === "login") await signIn?.emailCode.sendCode();
              else await signUp?.verifications.sendEmailCode();
            }}
            onChangeEmail={changeEmail}
            error={codeError}
            busy={busy}
          />
        ) : (
          <form className="space-y-4" onSubmit={submitEmail} noValidate>
            <div className="space-y-1">
              <h2 className="font-display text-xl font-semibold tracking-tight text-ink-50">
                {mode === "login" ? C.loginTitle : C.signupTitle}
              </h2>
              <p className="text-sm text-ink-300">
                {phase === "walletEmail" ? C.walletEmailLead : mode === "login" ? C.loginLead : C.signupLead}
              </p>
            </div>
            <Field label={C.email} required error={emailError ?? undefined}>
              <Input
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setLocalError(null);
                }}
                placeholder={C.emailPlaceholder}
              />
            </Field>
            {mode === "signup" && phase === "email" ? (
              <label className="flex items-center gap-2 text-sm text-ink-200">
                <input
                  type="checkbox"
                  checked={productUpdates}
                  onChange={(e) => setProductUpdates(e.target.checked)}
                  className="h-4 w-4 rounded border-ink-600 bg-ink-950 accent-electric-500"
                />
                {C.productUpdates}
              </label>
            ) : null}
            {mode === "signup" ? <div id="clerk-captcha" /> : null}
            {captchaError ? <StatusChip tone="error" variant="block">{captchaError}</StatusChip> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {C.continue}
            </Button>
            {phase === "email" ? (
              <WalletButtons
                disabled={busy}
                onPick={(p) => (mode === "login" ? void loginWithWallet(p) : void signupWithWallet(p))}
              />
            ) : null}
          </form>
        )}

        {notice ? (
          <StatusChip tone="neutral" variant="block" role="status">
            {notice}
          </StatusChip>
        ) : null}
        {globalError ? (
          <StatusChip tone="error" variant="block" role="alert">
            {globalError}
          </StatusChip>
        ) : null}
      </CardSection>
    </Card>
  );
}
