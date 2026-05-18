"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AIConversation, AIConversationDetail, AIResponse, getAIConversation, getAIConversations, getCurrentUser, runStrategyAdvisor } from "@/lib/api/client";

export default function StrategyAdvisorPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("帮我设计一个适合 ETF 轮动的低频策略");
  const [riskPreference, setRiskPreference] = useState("稳健");
  const [assetFocus, setAssetFocus] = useState("ETF");
  const [result, setResult] = useState<AIResponse | null>(null);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<AIConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getCurrentUser()
      .then(() => getAIConversations())
      .then(setConversations)
      .catch(() => router.replace("/login"));
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await runStrategyAdvisor({ user_prompt: prompt, risk_preference: riskPreference, asset_focus: assetFocus });
      setResult(response);
      setConversations(await getAIConversations());
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 策略助手请求失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectConversation(conversationId: string) {
    setError("");
    try {
      setSelectedConversation(await getAIConversation(conversationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载 AI 历史失败");
    }
  }

  const recommendedTemplate = typeof result?.parsed_json?.recommended_template === "string" ? result.parsed_json.recommended_template : "";

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">AI Strategy Advisor</p>
            <h1 className="mt-2 text-3xl font-semibold">AI 策略助手</h1>
          </div>
          <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => router.push("/dashboard")}>
            返回首页
          </button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <form className="rounded-lg border border-slate-200 bg-panel p-5" onSubmit={handleSubmit}>
            <label className="text-sm">
              <span className="font-medium text-slate-700">交易想法</span>
              <textarea
                className="mt-2 min-h-40 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
              />
            </label>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-sm">
                <span className="font-medium text-slate-700">风险偏好</span>
                <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={riskPreference} onChange={(event) => setRiskPreference(event.target.value)} />
              </label>
              <label className="text-sm">
                <span className="font-medium text-slate-700">资产方向</span>
                <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={assetFocus} onChange={(event) => setAssetFocus(event.target.value)} />
              </label>
            </div>
            {error ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            <button className="mt-5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={loading} type="submit">
              {loading ? "生成中..." : "生成策略建议"}
            </button>
          </form>

          <aside className="rounded-lg border border-slate-200 bg-panel p-5">
            <h2 className="font-semibold">AI 历史</h2>
            <div className="mt-4 space-y-3">
              {conversations.slice(0, 12).map((conversation) => (
                <button className="w-full rounded-md border border-slate-200 p-3 text-left text-sm" key={conversation.id} onClick={() => handleSelectConversation(conversation.id)} type="button">
                  <p className="font-medium">{conversation.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(conversation.updated_at).toLocaleString()}</p>
                </button>
              ))}
              {conversations.length === 0 ? <p className="text-sm text-slate-500">暂无 AI 会话。</p> : null}
            </div>
          </aside>
        </div>

        {result ? (
          <section className="rounded-lg border border-slate-200 bg-panel p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">策略建议</h2>
                <p className="mt-1 text-xs text-slate-500">Provider: {result.provider} / Model: {result.model ?? "-"}</p>
              </div>
              {recommendedTemplate ? (
                <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm" href={`/strategies/templates/${recommendedTemplate}`}>
                  前往模板
                </Link>
              ) : null}
            </div>
            <AIResultBlock result={result} />
          </section>
        ) : null}

        {selectedConversation ? (
          <section className="rounded-lg border border-slate-200 bg-panel p-5">
            <h2 className="font-semibold">历史会话：{selectedConversation.title}</h2>
            <div className="mt-4 space-y-3">
              {selectedConversation.messages.map((message) => (
                <div className="rounded-md border border-slate-200 p-3 text-sm" key={message.id}>
                  <p className="font-medium text-slate-700">{message.role}</p>
                  <p className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap leading-6 text-slate-600">{message.content}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function AIResultBlock({ result }: { result: AIResponse }) {
  if (!result.parsed_json) {
    return <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{result.content}</p>;
  }
  return (
    <div className="mt-4 grid gap-3">
      {Object.entries(result.parsed_json).map(([key, value]) => (
        <div className="rounded-md border border-slate-200 p-3 text-sm" key={key}>
          <p className="font-medium text-slate-700">{key}</p>
          <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-600">{formatAIValue(value)}</p>
        </div>
      ))}
    </div>
  );
}

function formatAIValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => `- ${String(item)}`).join("\n");
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value ?? "");
}
