"use client";
import { useEffect, useState } from 'react';

const useSpentStatusMonitor = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startMonitor = async () => {
    setLoading(true);
    setError(null); // Reset any previous error

    try {
      const response = await fetch('/api/wallet/unspent-status', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

    } catch (err) {
      // Handle any error that occurred during the fetch
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error("Failed to start wallet monitoring:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startMonitor();
  }, []);

  return { loading, error }; 
};

export default useSpentStatusMonitor;
