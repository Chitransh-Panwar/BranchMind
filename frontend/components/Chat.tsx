"use client";
import { useState, useRef, useEffect } from "react";
import { Message } from "@/lib/api";
interface Props {
  messages: Message[];
  onSend: (content: string) => void;
  sending: boolean;
}
export default function Chat({ messages, onSend, sending }: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = () => {
    if (!input.trim() || sending) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-600 text-xs font-mono mt-10">
            no messages on this branch yet
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={msg.id === "temp" ? `temp-${i}` : msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-lg text-sm font-mono leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-purple-600/20 border border-purple-500/30 text-gray-200"
                  : "bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300"
              }`}
            >
              <div className="text-[10px] mb-1 opacity-40">{msg.role}</div>
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] px-4 py-2.5 rounded-lg text-sm font-mono text-gray-500">
              thinking<span className="animate-pulse">...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-[#2a2a2a]">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="message this branch..."
            disabled={sending}
            className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm font-mono text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500 disabled:opacity-50 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-mono rounded hover:bg-purple-500 disabled:opacity-40 transition-colors"
          >
            send
          </button>
        </div>
      </div>
    </div>
  );
}
