import { useState, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';

interface VersionInfo {
  app_version: string;
  app_name: string;
  last_update: string | null;
  last_check: string | null;
  update_status: string;
  build_date: string | null;
}

export const useAppVersion = () => {
  const [version, setVersion] = useState<VersionInfo | null>(null);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const data = await pb.send('/api/version', { method: 'GET' });
        setVersion(data);
      } catch {
        // Fallback for preview/dev mode
        setVersion({
          app_version: '2.1.0',
          app_name: 'HACCP Tracker',
          last_update: null,
          last_check: null,
          update_status: 'dev',
          build_date: new Date().toISOString(),
        });
      }
    };
    fetchVersion();
  }, []);

  return version;
};
