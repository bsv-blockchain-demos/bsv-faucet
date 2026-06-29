'use client';
import useSpentStatusMonitor from '@/hooks/useUpdateSpentStatus';

// Background monitor: runs the spent-status side effect, renders nothing.
const SpentStatusMonitorClient = () => {
  useSpentStatusMonitor();
  return null;
};

export default SpentStatusMonitorClient;
