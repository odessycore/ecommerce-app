import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, X, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatMoney } from '@/lib/utils';
import { streamChat, type ChatProductCard, type ChatTurn } from '@/lib/ai';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  products?: ChatProductCard[];
}

const SUGGESTIONS = [
  'A warm wool jacket under $400',
  'Minimal white sneakers',
  "Where's my latest order?",
];

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const send = async (text: string) => {
    const value = text.trim();
    if (!value || streaming) return;
    setInput('');

    const history: ChatTurn[] = messages
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }));
    const userMessage: Message = { id: nextId.current++, role: 'user', content: value };
    const assistant: Message = { id: nextId.current++, role: 'assistant', content: '' };
    setMessages((prev) => [...prev, userMessage, assistant]);
    setStreaming(true);

    const patch = (changes: Partial<Message>) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === assistant.id ? { ...m, ...changes } : m)),
      );

    try {
      await streamChat({ message: value, history }, (event) => {
        if (event.type === 'products') patch({ products: event.products });
        else if (event.type === 'token')
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistant.id ? { ...m, content: m.content + event.value } : m,
            ),
          );
        else if (event.type === 'error') patch({ content: event.message });
      });
    } catch {
      patch({ content: 'The assistant is unavailable right now. Please try again.' });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <>
      <Button
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-xl"
        aria-label="Open assistant"
      >
        {open ? <X className="size-5" /> : <Sparkles className="size-5" />}
      </Button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[34rem] max-h-[75vh] w-[22rem] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-fade-in">
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Sparkles className="size-4" />
            <div className="leading-tight">
              <p className="text-sm font-semibold">ACME Assistant</p>
              <p className="text-xs text-muted-foreground">Find products · check orders</p>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <Welcome onPick={send} />
            ) : (
              messages.map((message) => <Bubble key={message.id} message={message} />)
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for anything…"
              className="h-10 flex-1 rounded-full border border-input bg-secondary/40 px-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button size="icon" type="submit" disabled={streaming || !input.trim()} className="rounded-full">
              <ArrowUp className="size-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}

function Welcome({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Hi! I can recommend products or look up your orders. Try:
      </p>
      <div className="flex flex-col gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
      {(message.content || isUser) && (
        <div
          className={cn(
            'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm',
            isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
          )}
        >
          {message.content || <span className="text-muted-foreground">Thinking…</span>}
        </div>
      )}
      {message.products && message.products.length > 0 && (
        <div className="grid w-full grid-cols-1 gap-2">
          {message.products.slice(0, 4).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: ChatProductCard }) {
  return (
    <Link
      to={`/products/${product.slug}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-background p-2 transition-colors hover:border-foreground/40"
    >
      <div className="size-12 shrink-0 overflow-hidden rounded-md bg-secondary">
        {product.imageUrl && (
          <img src={product.imageUrl} alt={product.name} className="size-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{product.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatMoney(product.priceAmount, product.currency)}
        </p>
      </div>
    </Link>
  );
}
