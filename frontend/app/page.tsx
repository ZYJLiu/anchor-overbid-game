"use client";

import { MapleStory } from "@/components/maplestory";

export default function Home() {
  const convertTimestampToDate = (timestamp: any) => {
    return new Date(timestamp).toLocaleString() || "N/A";
  };

  return (
    <div className="flex items-center justify-center">
      <MapleStory />
    </div>
  );
}
