import { PrismaClient } from '@/prisma/generated/client';
import { getUTXOs } from './whatsOnChain';
import cron from 'node-cron';

const prisma = new PrismaClient();

const startSpentStatusMonitor = async () => {
  const updateSpentStatus = async () => {
    try {
      console.log('Starting spent status update process...');

      const unspentOutputs = await prisma.output.findMany({
        where: { spentStatus: false },
        include: { transaction: true }
      });

      for (const output of unspentOutputs) {
        const isUnspent = await checkOutputStatus(output);
        if (!isUnspent) {
          await markOutputAsSpent(output);
          console.log(`Marked output ${output.id} of transaction ${output.transaction.txid} as spent`);
        }
      }

      console.log('Finished updating spent status');
    } catch (error) {
      console.error('Error updating spent status:', error);
    }
  };

  cron.schedule('0 * * * *', updateSpentStatus);
  await updateSpentStatus(); 
};

const checkOutputStatus = async (output: any) => {
  try {
    const utxos = await getUTXOs(output.address);
    return utxos.some(
      (utxo: { tx_hash: string; tx_pos: number }) =>
        utxo.tx_hash === output.transaction.txid && utxo.tx_pos === output.voutIndex
    );
  } catch (error) {
    console.error(`Error checking output status:`, error);
    return true;
  }
};

const markOutputAsSpent = async (output: any) => {
  try {
    await prisma.output.update({
      where: { id: output.id },
      data: { spentStatus: true }
    });

    const remainingUnspentOutputs = await prisma.output.count({
      where: { 
        transactionId: output.transactionId,
        spentStatus: false
      }
    });

    if (remainingUnspentOutputs === 0) {
      await prisma.transaction.update({
        where: { id: output.transactionId },
        data: { spentStatus: true }
      });
    }
  } catch (error) {
    console.error(`Error marking output as spent:`, error);
  }
};

export const startSpentMonitor = async () => {
  try {
    await startSpentStatusMonitor();
  } catch (error) {
    console.error('Error starting the spent status monitor:', error);
  }
};