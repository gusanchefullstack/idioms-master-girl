import { currentLearner } from "@/lib/auth";
import { getSettings } from "@/lib/config";
import { pingStt } from "@/lib/stt";
import { isExternalVoiceActive, pingElevenLabs } from "@/lib/tts";
import { pingOllama } from "@/lib/tutor/ollama";

export const runtime = "nodejs";

export async function GET() {
  const { llm } = getSettings();
  const learner = await currentLearner().catch(() => null);
  const voiceOn = learner ? isExternalVoiceActive(learner) : false;
  const [ollama, stt, eleven] = await Promise.all([pingOllama(), pingStt(), voiceOn ? pingElevenLabs() : false]);
  return Response.json(
    {
      ollama: ollama ? "up" : "down",
      model: llm.model,
      stt: stt ? "up" : "down",
      externalVoice: !voiceOn ? "off" : eleven ? "on" : "unreachable",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
