"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { PrivyProvider as RealPrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { monadTestnet } from "@patched/shared";

interface AuthContextValue {
  ready: boolean;
  authenticated: boolean;
  user: {
    id?: string;
    walletAddress?: `0x${string}`;
    xHandle?: string;
    email?: string;
  } | null;
  walletAddress?: `0x${string}`;
  xHandle?: string;
  isEmbeddedWallet: boolean;
  hasGasSponsorship: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  ready: true,
  authenticated: false,
  user: null,
  isEmbeddedWallet: false,
  hasGasSponsorship: true,
  login: () => {},
  logout: () => {},
});

export const usePatchedAuth = () => useContext(AuthContext);

function PrivyInnerBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const activeWallet = embeddedWallet || wallets[0];
  const walletAddress = (activeWallet?.address || user?.wallet?.address) as `0x${string}` | undefined;
  const xHandle = user?.twitter?.username || (user?.twitter as unknown as { handle?: string })?.handle;

  const authValue: AuthContextValue = {
    ready,
    authenticated,
    user: authenticated
      ? {
          id: user?.id,
          walletAddress,
          xHandle,
          email: user?.email?.address,
        }
      : null,
    walletAddress,
    xHandle,
    isEmbeddedWallet: Boolean(embeddedWallet),
    hasGasSponsorship: true, // Monad testnet sponsored via EIP-7702 paymaster
    login,
    logout,
  };

  return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>;
}

// Fallback Provider when no valid Privy App ID is configured
function FallbackAuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [xHandle, setXHandle] = useState<string | undefined>(undefined);
  const [walletAddress, setWalletAddress] = useState<`0x${string}` | undefined>(undefined);

  useEffect(() => {
    const saved = localStorage.getItem("patched_mock_auth");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAuthenticated(parsed.authenticated);
        setXHandle(parsed.xHandle);
        setWalletAddress(parsed.walletAddress);
      } catch {
        // ignore
      }
    }
  }, []);

  const login = () => {
    const mockAddr: `0x${string}` = "0xC6FFc5150A7fbe71c61480EBa60Bc0Ea805B6b98";
    const handle = "nodeflux_labs";
    setAuthenticated(true);
    setXHandle(handle);
    setWalletAddress(mockAddr);
    localStorage.setItem(
      "patched_mock_auth",
      JSON.stringify({
        authenticated: true,
        xHandle: handle,
        walletAddress: mockAddr,
      })
    );
  };

  const logout = () => {
    setAuthenticated(false);
    setXHandle(undefined);
    setWalletAddress(undefined);
    localStorage.removeItem("patched_mock_auth");
  };

  const value: AuthContextValue = {
    ready: true,
    authenticated,
    user: authenticated
      ? {
          id: "did:privy:mock_user_10143",
          walletAddress,
          xHandle,
        }
      : null,
    walletAddress,
    xHandle,
    isEmbeddedWallet: true,
    hasGasSponsorship: true,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function PrivyAuthProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const rawAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const isRealPrivyConfigured = Boolean(
    rawAppId && rawAppId.trim().length > 5 && !rawAppId.includes("mock")
  );

  // Before mounting on client, render neutral children to avoid hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  if (!isRealPrivyConfigured) {
    return <FallbackAuthProvider>{children}</FallbackAuthProvider>;
  }

  return (
    <RealPrivyProvider
      appId={rawAppId as string}
      config={{
        loginMethods: ["twitter", "wallet", "email"],
        appearance: {
          theme: "light",
          accentColor: "#E65100",
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "all-users",
          },
        },
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet],
      }}
    >
      <PrivyInnerBridge>{children}</PrivyInnerBridge>
    </RealPrivyProvider>
  );
}
