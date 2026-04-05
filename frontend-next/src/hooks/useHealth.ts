'use client';

import { useState, useEffect } from 'react';
import type { HealthResponse } from '@/types';

export function useHealth() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch(() => {});
  }, []);

  return health;
}
