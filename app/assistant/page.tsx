'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

type Source = {
  title: string;
  sourceId: string;
  stayId: string;
  score?: number;
  metadata?: {
    country?: string;
    category?: string;
    price?: number;
    reviewCount?: number;
  };
};

type AssistantResponse = {
  answer: string;
  sources: Source[];
  latencyMs?: number;
};

const SAMPLE_QUESTIONS = [
  'Which stays are near Sydney or in New South Wales?',
  'Do any cabins have great guest reviews?',
  'What is the cheapest stay and how much per night?',
  'Which stays can fit a group of 4 or more guests?',
  'Are there any treehouse or tiny home stays?',
];

// Atlas returns a normalized similarity score in roughly [0, 1].
// Above this we call it a strong match; below, we still show it but label it
// "related" so weak top-K hits are transparent rather than misleading.
const STRONG_MATCH_THRESHOLD = 0.6;

export default function AssistantPage() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssistantResponse | null>(null);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Something went wrong.');
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(message);
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold capitalize">stays assistant</h1>
        <p className="text-muted-foreground mt-1">
          Ask about our stays. Answers come only from real NomadLiving property
          and review data, with the source stays shown below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Which stays are good for families with kids?"
          rows={3}
          disabled={loading}
        />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading || !message.trim()}>
            {loading ? 'Thinking…' : 'Ask'}
          </Button>
          {result?.latencyMs != null && (
            <span className="text-xs text-muted-foreground">
              answered in {result.latencyMs} ms
            </span>
          )}
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {SAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              setMessage(q);
              ask(q);
            }}
            disabled={loading}
            className="rounded-full border border-input bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-6 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading && (
        <div className="mt-6 animate-pulse space-y-2">
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
        </div>
      )}

      {result && !loading && (
        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Answer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap leading-relaxed">
                {result.answer}
              </p>
            </CardContent>
          </Card>

          {result.sources.length > 0 && (
            <div>
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Source stays
              </h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Ranked by semantic similarity. &ldquo;Related&rdquo; entries are
                weaker matches shown for transparency, not direct answers.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {result.sources.map((s) => {
                  const isStrong =
                    s.score != null && s.score >= STRONG_MATCH_THRESHOLD;
                  return (
                    <Card
                      key={s.sourceId}
                      className={isStrong ? '' : 'opacity-70'}
                    >
                      <CardHeader className="p-4">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base">{s.title}</CardTitle>
                          {s.score != null && (
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                isStrong
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {isStrong ? 'strong match' : 'related'}
                            </span>
                          )}
                        </div>
                        <CardDescription>
                          {[s.metadata?.category, s.metadata?.country]
                            .filter(Boolean)
                            .join(' · ')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {s.metadata?.price != null && (
                            <span>{s.metadata.price} AUD / night</span>
                          )}
                          {s.metadata?.reviewCount != null && (
                            <span>{s.metadata.reviewCount} reviews</span>
                          )}
                          {s.score != null && (
                            <span>match {(s.score * 100).toFixed(0)}%</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
