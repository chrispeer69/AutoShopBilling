import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

// NHTSA vPIC — free, no key.
export async function GET(_: Request, { params }: { params: { vin: string } }) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const vin = params.vin.trim().toUpperCase();
  if (vin.length < 11) return NextResponse.json({ error: "VIN too short" }, { status: 400 });
  try {
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`, {
      next: { revalidate: 86400 },
    });
    const data = await res.json();
    const r = data?.Results?.[0] ?? {};
    const engine = [r.DisplacementL && `${parseFloat(r.DisplacementL).toFixed(1)}L`, r.EngineCylinders && `${r.EngineCylinders}-cyl`, r.FuelTypePrimary]
      .filter(Boolean).join(" ");
    return NextResponse.json({
      year: r.ModelYear || "",
      make: r.Make ? r.Make.charAt(0) + r.Make.slice(1).toLowerCase() : "",
      model: r.Model || "",
      engine,
    });
  } catch {
    return NextResponse.json({ error: "VIN lookup failed" }, { status: 502 });
  }
}
