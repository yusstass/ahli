"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <div role="alert" className="rounded-2xl border border-[#e6dfd0] bg-white p-6"><p className="font-semibold">This page could not be loaded.</p><button onClick={reset} className="mt-3 min-h-[40px] rounded-full bg-[#0f7a79] px-4 font-semibold text-white">Try again</button></div>;
}
