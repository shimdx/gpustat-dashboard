import { NextResponse } from "next/server";
import { gpuStatMonitor } from "@/lib/gpustat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  gpuStatMonitor.ensureRunning();
  return NextResponse.json(gpuStatMonitor.getSnapshot(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
