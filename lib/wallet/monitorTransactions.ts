// Guard: this module reads the treasury WIF. Importing it from a client
// component is a build-time error, preventing the key from reaching the browser.
import 'server-only';
import cron from 'node-cron';
import { getUTXOs, getRawTransaction } from './regest';
import { PrivateKey, Transaction, P2PKH, LockingScript } from '@bsv/sdk';
import bs58check from 'bs58check';
import { PrismaClient } from '@/prisma/generated/client';

const prisma = new PrismaClient();

function getAddressFromLockingScript(lockingScript: LockingScript, isTestnet = true) {
  try {
    const chunks = lockingScript.chunks;
    if (
      chunks.length === 5 &&
      chunks[0].op === 0x76 &&
      chunks[1].op === 0xa9 &&
      chunks[2].data instanceof Uint8Array &&
      chunks[2].data.length === 20 &&
      chunks[3].op === 0x88 &&
      chunks[4].op === 0xac
    ) {
      const pubKeyHash = chunks[2].data;
      const networkPrefix = isTestnet ? 0x6f : 0x00;
      const payload = Buffer.concat([
        Buffer.from([networkPrefix]),
        Buffer.from(pubKeyHash)
      ]);
      return bs58check.encode(payload);
    }
    return 'unknown';
  } catch (error) {
    console.error('Error extracting address from locking script:', error);
    return 'unknown';
  }
}

function transactionToObject(tx: Transaction) {
  return {
    txid: Buffer.from(tx.hash()).toString('hex'),
    version: tx.version,
    inputs: tx.inputs.map((input) => ({
      txid: input.sourceTransaction?.hash()
        ? Buffer.from(input.sourceTransaction.hash()).toString('hex')
        : 'unknown',
      vout: input.sourceOutputIndex,
      scriptSig: input.unlockingScript?.toASM() || 'unknown',
      sequence: input.sequence
    })),
    outputs: tx.outputs.map((output) => ({
      value: output.satoshis,
      scriptPubKey: {
        asm: output.lockingScript?.toASM() || 'unknown',
        hex: output.lockingScript?.toHex() || 'unknown',
        addresses: output.lockingScript
          ? [getAddressFromLockingScript(output.lockingScript)]
          : []
      }
    }))
  };
}

function mapOutputsToJson(outputs: any[]) {
  return outputs.map((output) => ({
    address: output.lockingScript
      ? getAddressFromLockingScript(output.lockingScript)
      : null,
    satoshis: output.satoshis,
    lockingScript: output.lockingScript?.toHex()
  }));
}

const startTransactionMonitor = async () => {
  const treasuryWIF = process.env.TREASURY_WALLET_WIF as string;
  const privateKey = PrivateKey.fromWif(treasuryWIF);
  const treasuryAddress = privateKey.toAddress('testnet').toString();

  const monitorIncomingTransactions = async () => {
    try {
      const utxos = await getUTXOs(treasuryAddress);
      for (const utxo of utxos) {
        const existingTransaction = await prisma.transaction.findUnique({
          where: { txid: utxo.tx_hash }
        });
        if (!existingTransaction) {
          const rawTx = await getRawTransaction(utxo.tx_hash);
          if (rawTx) {
            const tx = Transaction.fromHex(rawTx);
            const beefTx = transactionToObject(tx);
            const voutJson = mapOutputsToJson(tx.outputs);

            await prisma.transaction.create({
              data: {
                txid: utxo.tx_hash,
                date: new Date(),
                rawTx: rawTx,
                beefTx: beefTx,
                vout: voutJson,
                txType: 'deposit',
                spentStatus: false,
                testnetFlag: true,
                amount: BigInt(utxo.value)
              }
            });
            console.log(`New incoming transaction recorded: ${utxo.tx_hash}`);
          } else {
            console.error(`Failed to fetch raw transaction for: ${utxo.tx_hash}`);
          }
        }
      }
    } catch (error) {
      console.error('Error monitoring incoming transactions:', error);
    }
  };

  monitorIncomingTransactions();
  cron.schedule('* * * * *', monitorIncomingTransactions);
};

export const startMonitor = async () => {
  await startTransactionMonitor().catch((error) =>
    console.error('Error starting the monitor:', error)
  );
};