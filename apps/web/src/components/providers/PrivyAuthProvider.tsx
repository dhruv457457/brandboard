"use client";

import React, { createContext, memo, useContext, useState } from "react";
import dynamic from "next/dynamic";
import type { ConnectedWallet, useExportWallet, useSendTransaction, useSignTypedData } from "@privy-io/react-auth";

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
  login: () => void;
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
  login: () => {
    pendingLogin = true;
  },
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
};

const AuthContext = createContext<AuthContextValue>(NOT_READY);

export function usePatchedAuth(): AuthContextValue {
  return useContext(AuthContext);
}

// Loaded in the browser after hydration. memo: re-rendering this provider must not re-render Privy.
const PrivyRuntime = memo(dynamic(() => import("./PrivyRuntime"), { ssr: false }));

export function PrivyAuthProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<AuthContextValue>(NOT_READY);
  return (
    <AuthContext.Provider value={value}>
      {children}
      <PrivyRuntime onChange={setValue} />
    </AuthContext.Provider>
  );
}
