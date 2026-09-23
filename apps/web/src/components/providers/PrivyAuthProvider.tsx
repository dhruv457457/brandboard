"use client";

import React, { createContext, useContext } from "react";
import { PrivyProvider, usePrivy, useWallets, type ConnectedWallet } from "@privy-io/react-auth";
import { monadMainnet, monadTestnet } from "@patched/shared";
import { CHAIN } from "@/lib/config";

interface AuthContextValue {
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function usePatchedAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("usePatchedAuth must be used inside PrivyAuthProvider");
  return ctx;
}

function Bridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const { wallets } = useWallets();

  // Prefer the Privy embedded wallet: it gets gas sponsorship and silent signing.
  const embedded = wallets.find((w) => w.walletClientType === "privy");
  const wallet = embedded ?? wallets[0];
  const walletAddress = wallet?.address as `0x${string}` | undefined;
  const xHandle = user?.twitter?.username ?? undefined;

  const value: AuthContextValue = {
    ready,
    authenticated,
    user: authenticated && user ? { id: user.id, walletAddress, xHandle, email: user.email?.address } : null,
    walletAddress,
    wallet,
    xHandle,
    isEmbeddedWallet: Boolean(embedded),
    hasGasSponsorship: Boolean(embedded),
    login,
    logout,
    getAccessToken,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function PrivyAuthProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is missing from .env.local");

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["twitter", "email", "wallet"],
        appearance: { theme: "light", accentColor: "#FF5A1F", showWalletLoginFirst: false },
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
          // Bids are confirmed in our own UI; don't show Privy's extra confirmation modals.
          showWalletUIs: false,
        },
        defaultChain: CHAIN,
        supportedChains: [monadTestnet, monadMainnet],
      }}
    >
      <Bridge>{children}</Bridge>
    </PrivyProvider>
  );
}
