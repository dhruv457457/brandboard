"use client";

import React, { createContext, memo, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { ConnectedWallet, useExportWallet, useSendTransaction, useSignTypedData } from "@privy-io/react-auth";
import type { InjectedWallet } from "@/lib/injectedWallets";

/**
 * Auth and wallet actions for the whole app. Privy's SDK is big (about 700 KB compressed), so it is not part
 * of the first page load: pages render and hydrate with a "not ready" value, and PrivyRuntime loads right
 * after and fills this context in. Everything outside PrivyRuntime reaches Privy only through this context.
 */
export interface AuthContextValue {
  ready: boolean;
  authenticated: boolean;
  user: { id: string; walletAddress?: `0x${string}`; xHandle?: string; email?: string } | null;
  walletAddress?: `0x${string}`;
  wallet?: ConnectedWallet;
  xHandle?: string;
  isEmbeddedWallet: boolean;
  hasGasSponsorship: boolean;
  /** Go to the welcome page to sign in, then come back here. */
  login: () => void;
  /** Privy's own window on its wallet list. Only for wallets the welcome page can't reach directly (phone wallets). */
  openPrivyLogin: () => void;
  /** Our own sign-in UI (the welcome page): X redirects out and back; email is a 6-digit code. */
  loginWithX: () => Promise<void>;
  sendEmailCode: (email: string) => Promise<void>;
  loginWithEmailCode: (code: string) => Promise<void>;
  /** Sign in with a browser wallet the person picked (MetaMask, Rabby, Phantom...) by signing one message, with no Privy window. */
  loginWithWallet: (wallet: InjectedWallet) => Promise<string>;
  /**
   * After signing in with a wallet of your own: keep using it ("own"), or create a fresh Privy wallet and use that
   * ("fresh": one-tap bids, no network fee, starts empty). `ownAddress` is the wallet you signed in with.
   */
  chooseWallet: (kind: "own" | "fresh", ownAddress: string) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  /** Embedded-wallet actions (Privy hooks, passed through as-is). */
  sendTransaction: ReturnType<typeof useSendTransaction>["sendTransaction"];
  signTypedData: ReturnType<typeof useSignTypedData>["signTypedData"];
  exportWallet: ReturnType<typeof useExportWallet>["exportWallet"];
  /** Passkey MFA: whether one is set up, ask for it, or open the setup window. */
  hasPasskey: boolean;
  promptMfa: () => Promise<void>;
  enrollPasskey: () => void;
  /** Link an email (resolves once it's linked) or change the one already linked. */
  linkEmail: () => Promise<void>;
  updateEmail: () => void;
  /** Privy signers: add Patched's key quorum to the embedded wallet with one policy, or remove every signer we added. */
  addSigner: (signerId: string, policyId: string) => Promise<void>;
  removeSigner: () => Promise<void>;
}

const notReady = () => Promise.reject(new Error("Your wallet is still loading. Try again in a second."));

/** A login pressed before Privy has loaded; PrivyRuntime opens it as soon as it's ready. */
let pendingLogin = false;
export function takePendingLogin() {
  const was = pendingLogin;
  pendingLogin = false;
  return was;
}

const NOT_READY: AuthContextValue = {
  ready: false,
  authenticated: false,
  user: null,
  isEmbeddedWallet: false,
  hasGasSponsorship: false,
  login: () => {},
  openPrivyLogin: () => {
    pendingLogin = true;
  },
  loginWithX: notReady,
  sendEmailCode: notReady,
  loginWithEmailCode: notReady,
  loginWithWallet: notReady,
  chooseWallet: notReady,
  logout: async () => {},
  getAccessToken: async () => null,
  sendTransaction: notReady,
  signTypedData: notReady,
  exportWallet: notReady,
  hasPasskey: false,
  promptMfa: notReady,
  enrollPasskey: () => {},
  linkEmail: notReady,
  updateEmail: () => {},
  addSigner: notReady,
  removeSigner: notReady,
};

const AuthContext = createContext<AuthContextValue>(NOT_READY);

const noSubscribe = () => () => {};

/**
 * Auth for a component. While that component is hydrating it always sees "not ready", exactly like the server did:
 * Privy can finish loading before a streamed part of the page hydrates, and a signed-in or signed-out view drawn
 * then would not match the server's HTML. Right after hydration it sees the real value.
 */
export function usePatchedAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const login = value.login;
  const loading = useMemo(() => ({ ...NOT_READY, login }), [login]);
  return hydrated ? value : loading;
}

// Loaded in the browser after hydration. memo: re-rendering this provider must not re-render Privy.
const PrivyRuntime = memo(dynamic(() => import("./PrivyRuntime"), { ssr: false }));

export function PrivyAuthProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<AuthContextValue>(NOT_READY);
  const router = useRouter();
  // "Sign in" anywhere goes to our welcome page (no pop-up) and comes back to the same place afterwards.
  const login = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname.startsWith("/welcome")) return;
    const domain = process.env.NEXT_PUBLIC_HANDLE_DOMAIN?.toLowerCase();
    const isSubdomain = !!domain && window.location.hostname.toLowerCase().endsWith(`.${domain}`);
    const here = isSubdomain ? window.location.href : `${window.location.pathname}${window.location.search}`;
    const target = isSubdomain
      ? `https://${domain}/welcome?next=${encodeURIComponent(here)}`
      : `/welcome?next=${encodeURIComponent(here)}`;
    if (isSubdomain) {
      window.location.href = target;
    } else {
      router.push(target);
    }
  }, [router]);
  const withLogin = useMemo(() => ({ ...value, login }), [value, login]);

  return (
    <AuthContext.Provider value={withLogin}>
      {children}
      <PrivyRuntime onChange={setValue} />
    </AuthContext.Provider>
  );
}
