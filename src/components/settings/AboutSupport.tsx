import React, { useState } from "react";
import { FiCheck, FiCopy, FiHeart } from "react-icons/fi";

type Coin = {
  id: string;
  name: string;
  network: string;
  address: string;
};

const COINS: Coin[] = [
  {
    id: "btc",
    name: "Bitcoin",
    network: "Bitcoin network",
    address: "bc1qv6n67pswxdd5hal9agnlcus39l459n8fwgds6w",
  },
  {
    id: "eth",
    name: "Ether",
    network: "Ethereum (ERC-20 / mainnet)",
    address: "0xf59b0C95DEb78116190Ac14F085DaA7BA84e0651",
  },
  {
    id: "ltc",
    name: "Litecoin",
    network: "Litecoin network",
    address: "ltc1qlf4jqw54dt3x4am2wcwnuwc4d62xz9l4ldsq43",
  },
  {
    id: "xmr",
    name: "Monero",
    network: "Monero network",
    address:
      "8ByuGdoWg982iKYYNzLTDmLvnxq8KZv4BJq1QgqG4rrGYMULDLLpyVMbXi9eYfkC4SDjYpRiVdDQYQuCJHEC8az39kxDHzC",
  },
];

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    document.body.removeChild(field);
  }
}

const AboutSupport: React.FC = () => {
  const [copied, setCopied] = useState<string>("");

  const copy = async (coin: Coin) => {
    await copyText(coin.address);
    setCopied(coin.id);
    window.setTimeout(() => {
      setCopied((current) => (current === coin.id ? "" : current));
    }, 2000);
  };

  return (
    <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <FiHeart className="h-5 w-5 text-rose-600 dark:text-rose-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          About &amp; support
        </h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        SkeletonKey is local-first and source-available under a copyleft-style,
        non-commercial license. Personal and non-profit use is free; corporate
        use and resale need a separate license. There are no accounts,
        subscriptions, ads, or telemetry. If it earns a place in your life, you
        can support development with crypto — voluntarily.
      </p>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {COINS.map((coin) => (
          <div
            key={coin.id}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Donate {coin.name}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  {coin.network}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void copy(coin)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label={`Copy ${coin.name} address`}
              >
                {copied === coin.id ? (
                  <FiCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                ) : (
                  <FiCopy className="h-3.5 w-3.5" />
                )}
                {copied === coin.id ? "Copied" : "Copy"}
              </button>
            </div>
            <code className="mt-2 block break-all text-[11px] leading-relaxed text-gray-700 dark:text-gray-300 selection:bg-blue-200 dark:selection:bg-blue-800">
              {coin.address}
            </code>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
        Send only on the network named above. Crypto transfers are irreversible.
        Never share a seed phrase or private key. Donations are optional and do
        not buy support, priority, or influence over the roadmap.
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
        Forks and remixes must keep this license, attribute SkeletonKey, and
        notify the maintainer.
      </p>
      <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
        Source-available · copyleft-style · non-commercial · no accounts, no
        telemetry
      </p>
    </section>
  );
};

export default AboutSupport;
