import {
  PrivateKey,
  P2PKH,
  Transaction,
  Hash,
  TransactionInput,
  TransactionOutput,
  Script
} from '@bsv/sdk';
import { getUTXOs, getRawTransaction, broadcastTransaction } from './regest';
import { Prisma, PrismaClient } from '@/prisma/generated/client';
import { currentUser } from '@clerk/nextjs/server';
import bs58check from 'bs58check';

interface UTXO {
  tx_hash: string;
  tx_pos: number;
  value: number;
}

// interface TransactionOutput {
//   address?: string
//   satoshis?: number
// }
function getAddressFromLockingScript(
  lockingScript: Script,
  isTestnet: boolean = true
): string {
  try {
    const chunks = lockingScript.chunks;
    if (
      chunks.length === 5 &&
      chunks[0].op === 0x76 && // OP_DUP
      chunks[1].op === 0xa9 && // OP_HASH160
      chunks[2].data instanceof Uint8Array &&
      chunks[2].data.length === 20 && // PubKeyHash length is 20 bytes
      chunks[3].op === 0x88 && // OP_EQUALVERIFY
      chunks[4].op === 0xac // OP_CHECKSIG
    ) {
      const pubKeyHash = chunks[2].data; // Already Uint8Array
      const networkPrefix = isTestnet ? 0x6f : 0x00; // 0x6f for testnet, 0x00 for mainnet
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

function transactionToObject(tx: Transaction): Record<string, any> {
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
    outputs: tx.outputs.map((output, index) => ({
      voutIndex: index,
      value: output.satoshis || 0,
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

function mapOutputsToJson(outputs: TransactionOutput[]): Prisma.InputJsonValue {
  return outputs.map((output, index) => ({
    voutIndex: index,
    address: output.lockingScript
      ? getAddressFromLockingScript(output.lockingScript)
      : null,
    satoshis: output.satoshis || 0,
    lockingScript: output.lockingScript?.toHex()
  }));
}

const prisma = new PrismaClient();

export const createAndSendTransaction = async (
  privKeyWif: string,
  toAddress: string,
  amount: number,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<string> => {
  try {
    // Validate inputs
    if (!privKeyWif || !toAddress || amount <= 0) {
      throw new Error('Invalid input parameters');
    }

    const privateKey = PrivateKey.fromWif(privKeyWif);
    const publicKey = privateKey.toPublicKey();
    const senderAddress = publicKey.toAddress(network).toString();

    const FEE_PER_BYTE = 0.5;
    const ESTIMATED_INPUT_SIZE = 148;
    const ESTIMATED_OUTPUT_SIZE = 34;
    const BASE_TX_SIZE = 10;

    const utxos = await getUTXOs(senderAddress);
    if (!utxos || utxos.length === 0) {
      throw new Error('No UTXOs available');
    }

    const estimatedSize =
      BASE_TX_SIZE +
      ESTIMATED_INPUT_SIZE * utxos.length +
      ESTIMATED_OUTPUT_SIZE * 2;
    const estimatedFee = Math.ceil(estimatedSize * FEE_PER_BYTE);

    let selectedUTXOs: UTXO[] = [];
    let totalInputSatoshis = 0;
    const requiredAmount = amount + estimatedFee;

    for (const utxo of utxos) {
      selectedUTXOs.push(utxo);
      totalInputSatoshis += utxo.value;
      if (totalInputSatoshis >= requiredAmount) {
        break;
      }
    }

    if (totalInputSatoshis < requiredAmount) {
      throw new Error(
        `Insufficient funds. Required: ${requiredAmount}, Available: ${totalInputSatoshis}`
      );
    }

    const inputs = await Promise.all(
      selectedUTXOs.map(async (utxo) => {
        const rawTx = await getRawTransaction(utxo.tx_hash);
        if (!rawTx) {
          throw new Error(
            `Failed to fetch raw transaction for UTXO: ${utxo.tx_hash}`
          );
        }

        const sourceTx = Transaction.fromHex(rawTx);
        return {
          sourceTransaction: sourceTx,
          sourceOutputIndex: utxo.tx_pos,
          unlockingScriptTemplate: new P2PKH().unlock(privateKey)
        };
      })
    );

    const changeAmount = totalInputSatoshis - amount - estimatedFee;

    const recipientP2PKH = new P2PKH().lock(toAddress);
    const changeP2PKH = new P2PKH().lock(senderAddress);

    const outputs = [
      {
        lockingScript: recipientP2PKH,
        satoshis: amount
      }
    ];

    if (changeAmount > 546) {
      outputs.push({
        lockingScript: changeP2PKH,
        satoshis: changeAmount
      });
    }

    const tx = new Transaction(1, inputs, outputs);
    await tx.sign();

    const rawTx = tx.toHex();
    const txid = await broadcastTransaction(rawTx);
    if (!txid) {
      throw new Error('Failed to broadcast transaction');
    }

    const user = await currentUser();
    const userId = user?.id;
    const voutJson = mapOutputsToJson(tx.outputs);
    await prisma.transaction.create({
      data: {
        txid,
        rawTx,
        beefTx: transactionToObject(tx),
        vout: voutJson,
        txType: 'withdraw',
        spentStatus: false,
        testnetFlag: network === 'testnet',
        amount: BigInt(amount),
        userId: userId,
        outputs: {
          create: tx.outputs.map((output, index) => ({
            voutIndex: index,
            address: getAddressFromLockingScript(output.lockingScript, network === 'testnet'),
            amount: Number(output.satoshis || 0),
            spentStatus: false
          }))
        }
      }
    });

    await prisma.user.update({
      where: { userId: userId },
      data: {
        withdrawn: {
          increment: BigInt(amount)
        }
      }
    });

    return txid;
  } catch (error) {
    console.error(
      `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    throw new Error(
      `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  } finally {
    await prisma.$disconnect();
  }
};
