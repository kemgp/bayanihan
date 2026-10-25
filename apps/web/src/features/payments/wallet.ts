import { getAddress, getNetworkDetails, isConnected, requestAccess, signTransaction } from '@stellar/freighter-api';
const TESTNET = 'Test SDF Network ; September 2015';
async function requireTestnet() {
  const result = await getNetworkDetails();
  if (result.error || result.networkPassphrase !== TESTNET) throw new Error('Switch Freighter to Stellar Testnet, then try again.');
}
export async function connectWallet() {
  const installed = await isConnected();
  if (installed.error || !installed.isConnected) throw new Error('Install or unlock the Freighter browser extension, then reload this page.');
  const result = await requestAccess();
  if (result.error || !result.address) throw new Error('Wallet connection was not approved. Open Freighter and try again.');
  await requireTestnet();
  return result.address;
}
export async function signPayment(xdr: string, payer: string) {
  await requireTestnet();
  const before = await getAddress();
  if (before.error || before.address !== payer) throw new Error('Select the wallet used to prepare this payment in Freighter.');
  const result = await signTransaction(xdr, { networkPassphrase: TESTNET, address: payer });
  if (result.error || !result.signedTxXdr) throw new Error('Signing was not completed. Your saved payment is ready to try again.');
  await requireTestnet();
  const after = await getAddress();
  if (after.error || after.address !== payer || result.signerAddress !== payer) throw new Error('The wallet account changed. Select the original customer account and try again.');
  return result.signedTxXdr;
}
