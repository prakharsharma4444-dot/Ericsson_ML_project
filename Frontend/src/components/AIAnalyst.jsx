import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, ChevronDown, Database, Loader2, Send, Sparkles, User } from 'lucide-react';
import { getApiBase } from '../api';

function AIAnalyst({ sessionId, datasetName, theme }) {
  const isDark = theme === 'dark';
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedTools, setExpandedTools] = useState({});
  const messagesEndRef = useRef(null);

  const suggestions = useMemo(() => [
    'What are the most important things I should know about this dataset?',
    'Which priority is most common?',
    'Which product has the longest average resolution time?',
    'Are there any unusual or overdue cases?',
  ], []);

  useEffect(() => {
    setMessages([]);
    setQuestion('');
    setError('');
    setExpandedTools({});
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendQuestion = async (value) => {
    const text = String(value ?? question).trim();
    if (!text || loading) return;

    if (!sessionId) {
      setError('Upload a dataset first to start an AI analysis.');
      return;
    }

    setError('');
    setQuestion('');
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: text },
    ]);
    setLoading(true);

    try {
      const response = await fetch(
        `${getApiBase()}/api/sessions/${sessionId}/ai/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: text }),
        }
      );

      const contentType = response.headers.get('content-type') || '';
      const rawBody = await response.text();

      let data = null;
      if (rawBody.trim() && contentType.includes('application/json')) {
        try {
          data = JSON.parse(rawBody);
        } catch {
          data = null;
        }
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.message ||
            rawBody ||
            `The AI Analyst request failed (HTTP ${response.status}).`
        );
      }

      if (!data) {
        throw new Error(
          `The AI Analyst returned an unexpected empty or non-JSON response (HTTP ${response.status}).`
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data?.answer || 'I could not produce an answer.',
          toolsUsed: Array.isArray(data?.tools_used) ? data.tools_used : [],
          model: data?.model || null,
        },
      ]);
    } catch (err) {
      console.error('AI Analyst request failed:', err);
      setError(err.message || 'Could not reach the AI Analyst.');
    } finally {
      setLoading(false);
    }
  };

  const formatToolName = (name) =>
    String(name || 'Analytics tool')
      .replace(/^get_/, '')
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  return (
    <div className="max-w-5xl mx-auto flex flex-col min-h-[calc(100vh-9rem)]">
      <div className={`rounded-2xl border shadow-sm overflow-hidden flex flex-col flex-1 ${
        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
      }`}>
        <div className={`px-6 py-5 border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDark ? 'bg-blue-950/60 text-blue-400' : 'bg-blue-50 text-blue-600'
            }`}>
              <Sparkles size={20} />
            </div>
            <div className="min-w-0">
              <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>AI Analyst</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Ask questions about the active dataset and get answers grounded in the analytics engine.
              </p>
            </div>
          </div>

          <div className={`mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium ${
            isDark ? 'bg-slate-900/70 text-slate-300' : 'bg-slate-50 text-slate-600'
          }`}>
            <Database size={13} />
            <span className="truncate">{datasetName || 'No dataset loaded'}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {!sessionId ? (
            <div className="min-h-[420px] flex items-center justify-center text-center max-w-md mx-auto">
              <div>
                <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${
                  isDark ? 'bg-blue-950/50 text-blue-400' : 'bg-blue-50 text-blue-600'
                }`}>
                  <Bot size={26} />
                </div>
                <h3 className={`mt-4 text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  Upload a dataset to start
                </h3>
                <p className="mt-2 text-xs leading-5 text-slate-400 dark:text-slate-500">
                  The AI Analyst uses the active dataset and Python analytics tools to calculate facts before explaining them.
                </p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="min-h-[420px] max-w-2xl mx-auto pt-10">
              <div className="text-center">
                <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${
                  isDark ? 'bg-blue-950/50 text-blue-400' : 'bg-blue-50 text-blue-600'
                }`}>
                  <Bot size={26} />
                </div>
                <h3 className={`mt-4 text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  What would you like to know?
                </h3>
                <p className="mt-2 text-xs leading-5 text-slate-400 dark:text-slate-500">
                  Ask a question in plain language. The analyst can use multiple dataset tools when needed.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => sendQuestion(suggestion)}
                    className={`text-left p-4 rounded-xl border text-xs leading-5 transition ${
                      isDark
                        ? 'border-slate-700 bg-slate-900/40 text-slate-300 hover:bg-slate-700/50 hover:border-slate-600'
                        : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-white hover:border-blue-200 hover:shadow-sm'
                    }`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' && (
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isDark ? 'bg-blue-950/60 text-blue-400' : 'bg-blue-50 text-blue-600'
                    }`}>
                      <Bot size={15} />
                    </div>
                  )}

                  <div className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : isDark
                        ? 'bg-slate-900/60 text-slate-200 rounded-bl-md'
                        : 'bg-slate-50 text-slate-700 rounded-bl-md'
                  }`}>
                    <div className="text-sm leading-6 whitespace-pre-wrap">{message.content}</div>

                    {message.role === 'assistant' && message.toolsUsed?.length > 0 && (
                      <ToolList
                        tools={message.toolsUsed}
                        isDark={isDark}
                        formatToolName={formatToolName}
                        expanded={!!expandedTools[message.id]}
                        onToggle={() => setExpandedTools((prev) => ({
                          ...prev,
                          [message.id]: !prev[message.id],
                        }))}
                        model={message.model}
                      />
                    )}
                  </div>

                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                      <User size={15} />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isDark ? 'bg-blue-950/60 text-blue-400' : 'bg-blue-50 text-blue-600'
                  }`}>
                    <Bot size={15} />
                  </div>
                  <div className={`rounded-2xl rounded-bl-md px-4 py-3 ${
                    isDark ? 'bg-slate-900/60 text-slate-300' : 'bg-slate-50 text-slate-600'
                  }`}>
                    <div className="flex items-center gap-2 text-xs">
                      <Loader2 size={14} className="animate-spin" />
                      Analyzing your dataset...
                    </div>
                  </div>
                </div>
              )}
              <div />
            </div>
          )}
        </div>

        <div className={`border-t px-6 py-4 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
          {error && (
            <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] font-medium text-red-500">
              {error}
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendQuestion();
            }}
            className="relative"
          >
            <textarea
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                if (error) setError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendQuestion();
                }
              }}
              disabled={!sessionId || loading}
              rows={2}
              placeholder={sessionId ? 'Ask a question about your dataset...' : 'Upload a dataset to start asking questions.'}
              className={`w-full resize-none rounded-xl border pl-4 pr-14 py-3 text-xs leading-5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-600'
                  : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
              }`}
            />

            <button
              type="submit"
              disabled={!sessionId || !question.trim() || loading}
              className="absolute right-2 bottom-2 w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </form>

          <p className="text-[9px] text-slate-400 dark:text-slate-600 mt-2">
            Press Enter to send · Shift + Enter for a new line
          </p>
        </div>
      </div>
    </div>
  );
}

function ToolList({ tools, isDark, formatToolName, expanded, onToggle, model }) {
  return (
    <div className="mt-3 pt-3 border-t border-slate-200/10 dark:border-slate-700">
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1.5 text-[11px] font-semibold ${
          isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        {tools.length} analytics tool{tools.length === 1 ? '' : 's'} used
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {tools.map((tool, index) => (
            <div
              key={`${tool.tool}-${index}`}
              className={`flex items-center gap-2 text-[10px] rounded-lg px-2.5 py-2 ${
                isDark ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-500 border border-slate-100'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <span>{formatToolName(tool.tool)}</span>
            </div>
          ))}
        </div>
      )}

      {model && (
        <p className="mt-2 text-[9px] text-slate-400 dark:text-slate-600">Model: {model}</p>
      )}
    </div>
  );
}

export default AIAnalyst;
