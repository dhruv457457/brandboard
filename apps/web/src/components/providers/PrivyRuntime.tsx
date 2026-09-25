"use client";

import { useEffect, useRef } from "react";
import {
  PrivyProvider,
  useExportWallet,
  useLinkAccount,
  useMfa,
  useMfaEnrollment,
  usePrivy,
  useSendTransaction,
  useSignTypedData,
  useWallets,
} from "@privy-io/react-auth";
import { useUpdateEmail } from "@privy-io/react-auth/ui";
import { monadMainnet, monadTestnet } from "@patched/shared";
import { CHAIN } from "@/lib/config";
import { takePendingLogin, type AuthContextValue } from "./PrivyAuthProvider";

/**
 * The Privy SDK and every Privy hook the app uses, in one lazily loaded module. Bridge reads the hooks and
 * hands the result up to PrivyAuthProvider's context on every change.
 */
function Bridge({ onChange }: { onChange: (v: AuthContextValue) => void }) {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const { signTypedData } = useSignTypedData();
  const { exportWallet } = useExportWallet();
  const { promptMfa } = useMfa();
  const { showMfaEnrollmentModal } = useMfaEnrollment();
  const { update: updateEmail } = useUpdateEmail();

  // linkEmail() resolves when Privy reports the email linked.
  const linking = useRef<{ resolve: () => void; reject: (e: unknown) => void } | null>(null);
  const { linkEmail } = useLinkAccount({
    onSuccess: () => {
      linking.current?.resolve();
      linking.current = null;
    },
    onError: (e) => {
      linking.current?.reject(new Error(String(e)));
      linking.current = null;
    },
  });

  // Prefer the Privy embedded wallet: it gets gas sponsorship and silent signing.
  const embedded = wallets.find((w) => w.walletClientType === "privy");
  const wallet = embedded ?? wallets[0];
  const walletAddress = wallet?.address as `0x${string}` | undefined;
  const xHandle = user?.twitter?.username ?? undefined;

  useEffect(() => {
    onChange({
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
      sendTransaction,
      signTypedData,
      exportWallet,
      hasPasskey: (user?.mfaMethods ?? []).includes("passkey"),
      promptMfa,
      enrollPasskey: showMfaEnrollmentModal,
      linkEmail: () =>
        new Promise<void>((resolve, reject) => {
          linking.current = { resolve, reject };
          linkEmail();
        }),
      updateEmail,
    });
  });

  // Someone pressed "Sign in" before Privy finished loading: open the login window now.
  useEffect(() => {
    if (ready && takePendingLogin() && !authenticated) login();
  }, [ready, authenticated, login]);

  return null;
}

export default function PrivyRuntime({ onChange }: { onChange: (v: AuthContextValue) => void }) {
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
      <Bridge onChange={onChange} />
    </PrivyProvider>
  );
}
