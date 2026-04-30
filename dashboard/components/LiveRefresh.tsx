"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onmessage = () => router.refresh();
    es.onerror = () => {
      // browser auto-reconnects
    };
    return () => es.close();
  }, [router]);
  return null;
}
