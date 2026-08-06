'use client';

import { useEffect } from 'react';

import { track } from '@/components/site/analytics-provider';

/** Records the checkout_completed analytics event exactly once per page view. */
export function CheckoutTracker({ productKey }: { productKey: string | null }) {
  useEffect(() => {
    track('checkout_completed', productKey ? { productKey } : {});
  }, [productKey]);

  return null;
}
