import { auth } from "@/auth";
import { clubData } from "@/lib/cached";
import { isStock, newLotDate, suggestLots } from "@/lib/club/insight";
import { proposalSpeech } from "@/lib/club/speech";

// Read aloud of one waiting order's lot proposals, spoken by ElevenLabs. Admins only: each call costs credits.
// The text is built here from our own data, never taken from the browser, so the button cannot speak anything else.
const VOICE = process.env.ELEVENLABS_VOICE_ID || "5WzSEX8Olqoxyg983ObF"; // default: "Amit", a Hindi voice from the ElevenLabs library

export async function GET(req: Request) {
  if ((await auth())?.user?.role !== "admin") return new Response("Only an admin can use Read aloud.", { status: 403 });
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return new Response("Read aloud is not set up: ELEVENLABS_API_KEY is missing.", { status: 503 });

  const prodOrder = new URL(req.url).searchParams.get("order") ?? "";
  const { orders, profiles, views, etas, today } = await clubData();
  const o = orders.find((x) => x.prodOrder === prodOrder);
  const p = profiles.get(prodOrder);
  if (!o || !p || isStock(o)) return new Response(`No waiting order ${prodOrder}.`, { status: 404 });

  const text = proposalSpeech({ prodOrder, party: o.party, km: p.km }, suggestLots(p, views, orders, profiles, etas), newLotDate(p, views, today));
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    // v3 with Hindi forced: v2 cannot force a language and read the Hinglish with an English accent.
    body: JSON.stringify({ text, model_id: "eleven_v3", language_code: "hi" }),
  });
  if (!res.ok || !res.body) {
    console.error("elevenlabs failed", res.status, await res.text().catch(() => ""));
    return new Response("ElevenLabs could not read this now. Try again.", { status: 502 });
  }
  // The browser keeps the audio for 5 minutes, so playing it again costs no credits.
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=300" } });
}
