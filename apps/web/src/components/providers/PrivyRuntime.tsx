"use client";

import { useEffect, useRef } from "react";
import { forgetSignedIn } from "@/lib/signedIn";
import {
  PrivyProvider,
  useCreateWallet,
  useExportWallet,
  useLinkAccount,
  useLoginWithEmail,
  useLoginWithOAuth,
  useLoginWithSiwe,
  useMfa,
  useMfaEnrollment,
  usePrivy,
  useSendTransaction,
  useSigners,
  useUser,
  useSignTypedData,
  useWallets,
} from "@privy-io/react-auth";
import { useUpdateEmail } from "@privy-io/react-auth/ui";
import { getAddress } from "viem";
import { monadMainnet, monadTestnet } from "@patched/shared";
import { CHAIN, CHAIN_ID } from "@/lib/config";
import { walletClientType, type InjectedWallet } from "@/lib/injectedWallets";
import { takePendingLogin, type AuthContextValue } from "./PrivyAuthProvider";

/**
 * Privy's signTypedData sends the typed data as JSON, which can't hold a bigint ("Do not know how to serialize a
 * BigInt"), so every permit (bids, sweep, auto-bid) failed. uint256 values go as decimal strings, which EIP-712
 * signs the same way.
 */
const jsonSafe = <T,>(v: T): T =>
  (typeof v === "bigint" ? v.toString() : Array.isArray(v) ? v.map(jsonSafe) : v && typeof v === "object"
    ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, jsonSafe(x)])) : v) as T;

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
  const { initOAuth } = useLoginWithOAuth();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { generateSiweMessage, loginWithSiwe } = useLoginWithSiwe();
  const { createWallet } = useCreateWallet();
  const { refreshUser } = useUser();
  const { addSigners, removeSigners } = useSigners();

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

  // Your wallet is the one you chose at sign-in (saved on your Privy user), else the one you linked first (same rule
  // as the server): MetaMask users keep their MetaMask wallet, X and email users their Privy embedded wallet
  // (gas-sponsored, silent signing).
  const linked = (user?.linkedAccounts ?? [])
    .filter((a): a is typeof a & { address: string; chainType: string; walletClientType?: string } =>
      a.type === "wallet" && "address" in a && (("chainType" in a ? a.chainType : "ethereum") === "ethereum"))
    .sort((a, b) => (a.firstVerifiedAt?.getTime() ?? Infinity) - (b.firstVerifiedAt?.getTime() ?? Infinity));
  const chosen = (user?.customMetadata?.accountWallet as string | undefined)?.toLowerCase();
  const pick = linked.find((a) => a.address.toLowerCase() === chosen) ?? linked[0];
  const mainAddress = pick?.address.toLowerCase();
  const wallet = mainAddress
    ? wallets.find((w) => w.address.toLowerCase() === mainAddress)
    : wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
  const walletAddress = (mainAddress ?? wallet?.address) as `0x${string}` | undefined;
  const embedded = pick ? pick.walletClientType === "privy" : wallet?.walletClientType === "privy";
  const xHandle = user?.twitter?.username ?? undefined;

  const linkedRef = useRef(linked);
  linkedRef.current = linked;

  // Email and X sign-ins need a wallet too. Privy only makes one on login when the app's dashboard setting allows
  // it (ours says "off"), so make one right after sign-in whenever the account has none. Tried once per account
  // per page load, with one retry: Privy sometimes needs a moment after the login finishes.
  const walletTried = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !authenticated || !user || linked.length > 0 || walletTried.current === user.id) return;
    walletTried.current = user.id;
    const make = () => createWallet().then(() => refreshUser());
    make().catch(() => new Promise((r) => setTimeout(r, 2500)).then(make)).catch((e) => console.error("Couldn't create the wallet", e));
  }, [ready, authenticated, user, linked.length, createWallet, refreshUser]);

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
      // Privy's window opened straight on its wallet list: phone wallets over WalletConnect and anything we don't detect.
      openPrivyLogin: () => login({ loginMethods: ["wallet"] }),
      loginWithX: () => initOAuth({ provider: "twitter" }),
      sendEmailCode: (email: string) => sendCode({ email }),
      loginWithEmailCode: (code: string) => loginWithCode({ code }),
      loginWithWallet: async (picked: InjectedWallet) => {
        // Sign-In With Ethereum, headless: the wallet the person picked shows one signature request and Privy never
        // opens a window.
        const eth = picked.provider;
        const [account] = (await eth.request({ method: "eth_requestAccounts" })) as string[];
        if (!account) throw new Error("no-account");
        const address = getAddress(account);
        const message = await generateSiweMessage({ address, chainId: `eip155:${CHAIN_ID}` });
        const signature = (await eth.request({ method: "personal_sign", params: [message, address] })) as string;
        await loginWithSiwe({ signature, message, walletClientType: walletClientType(picked), connectorType: "injected" });
        return address;
      },
      chooseWallet: async (kind, ownAddress) => {
        let address = ownAddress;
        if (kind === "fresh") {
          // A Privy wallet already on this account is reused; otherwise make one.
          const existing = linkedRef.current.find((a) => a.walletClientType === "privy");
          address = existing?.address ?? (await createWallet()).address;
        }
        const token = await getAccessToken();
        const res = await fetch("/api/profile/wallet", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ address }),
        });
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't save your wallet choice.");
        await refreshUser();
      },
      // Sign out switches to the signed-out view at once (no grace period for a session being restored).
      logout: async () => {
        forgetSignedIn();
        await logout();
      },
      getAccessToken,
      sendTransaction,
      signTypedData: (data, options) => signTypedData(jsonSafe(data), options),
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
      // Auto-bid through signers: put Patched's key quorum on the wallet, limited by one policy, or take it off.
      addSigner: async (signerId: string, policyId: string) => {
        if (!walletAddress) throw new Error("not signed in");
        await addSigners({ address: walletAddress, signers: [{ signerId, policyIds: [policyId] }] });
      },
      removeSigner: async () => {
        if (!walletAddress) throw new Error("not signed in");
        await removeSigners({ address: walletAddress });
      },
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
        appearance: {
          theme: "light",
          accentColor: "#FF5A1F",
          logo: "/icon.svg",
          landingHeader: "Welcome to Patched",
          loginMessage: "No wallet needed. We make one for you.",
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          // X and email users get an embedded wallet; people who sign in with their own wallet keep using it.
          // ("all-users" gave MetaMask users a second, empty wallet and moved their account to it.)
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
