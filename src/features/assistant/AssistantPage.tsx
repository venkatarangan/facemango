import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import StopRounded from '@mui/icons-material/StopRounded';
import DeleteSweepRounded from '@mui/icons-material/DeleteSweepRounded';
import { describeAIError, getAI, useAIStore } from '@/ai';
import { brand } from '@/app/tokens';
import { db, ME, type ChatMessage } from '@/db';
import {
  addChatMessage,
  buildAssistantRequest,
  MANGO_SYSTEM,
  QUICK_ACTIONS,
  type QuickAction,
} from '@/engine/assistant';
import { ComposerDialog } from '@/features/compose/ComposerDialog';
import { useAuthors } from '@/features/feed/useAuthors';

function Bubble({
  message,
  onUse,
}: {
  message: Pick<ChatMessage, 'role' | 'text' | 'draft'>;
  onUse?: () => void;
}) {
  const mine = message.role === 'user';
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end' }}
    >
      {!mine && (
        <Avatar sx={{ width: 30, height: 30, bgcolor: brand.mango, color: brand.ink }} aria-hidden>
          <AutoAwesomeRounded sx={{ fontSize: 18 }} />
        </Avatar>
      )}
      <Box
        sx={{
          maxWidth: '82%',
          px: 1.75,
          py: 1,
          borderRadius: 4,
          borderBottomRightRadius: mine ? 6 : undefined,
          borderBottomLeftRadius: mine ? undefined : 6,
          bgcolor: mine ? alpha(brand.mango, 0.35) : brand.surface,
          border: mine ? 'none' : `1px solid ${brand.divider}`,
        }}
      >
        <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {message.text || '…'}
        </Typography>
        {message.draft && onUse && message.text && (
          <Button size="small" variant="contained" onClick={onUse} sx={{ mt: 1 }}>
            Use as post
          </Button>
        )}
      </Box>
    </Stack>
  );
}

/** Mango AI (SPEC §3.5): chat with streaming replies and post-writing quick actions. */
export function AssistantPage() {
  const ai = useAIStore();
  const authors = useAuthors();
  const messages = useLiveQuery(() => db.chat.orderBy('createdAt').toArray(), []) ?? [];
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState<{ text: string; draft: boolean } | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const me = authors?.get(ME);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, streaming?.text]);

  const send = async (text: string, action: QuickAction | null = null) => {
    const model = getAI();
    if (!model || streaming || !text.trim()) return;
    setInput('');
    const history = await db.chat.orderBy('createdAt').toArray();
    await addChatMessage('user', text.trim());
    const request = await buildAssistantRequest(text.trim(), action, history);
    abort.current = new AbortController();
    setStreaming({ text: '', draft: request.draft });
    let out = '';
    try {
      for await (const delta of model.stream(request.prompt, {
        system: MANGO_SYSTEM,
        priority: 'interactive',
        signal: abort.current.signal,
        maxTokens: 320,
        temperature: 0.8,
      })) {
        out += delta;
        setStreaming({ text: out, draft: request.draft });
      }
    } catch (error) {
      if (!out)
        out = `Sorry, I couldn’t answer that just now (${describeAIError(error)}). Please try again.`;
    } finally {
      const clean = out.trim().replace(/^["“]|["”]$/g, '');
      await addChatMessage('assistant', clean, request.draft);
      setStreaming(null);
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const ready = ai.status === 'ready';
  return (
    <Stack
      spacing={2}
      sx={{ minHeight: { xs: 'calc(100dvh - 180px)', md: 'calc(100dvh - 120px)' } }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', px: { xs: 0.5, sm: 0 } }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" component="h1">
            Mango AI
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your writing buddy. Runs on this device; nothing you type leaves it.
          </Typography>
        </Box>
        {messages.length > 0 && (
          <Tooltip title="Clear chat">
            <IconButton aria-label="Clear chat" onClick={() => void db.chat.clear()}>
              <DeleteSweepRounded />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Stack
          spacing={1.5}
          sx={{ flex: 1, p: 2, overflowY: 'auto' }}
          role="log"
          aria-live="polite"
          aria-label="Conversation"
        >
          {messages.length === 0 && !streaming && (
            <Stack
              spacing={1}
              sx={{ alignItems: 'center', textAlign: 'center', py: 4, color: 'text.secondary' }}
            >
              <Avatar sx={{ width: 56, height: 56, bgcolor: brand.mango, color: brand.ink }}>
                <AutoAwesomeRounded />
              </Avatar>
              <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>
                Hi{me ? `, ${me.name.split(' ')[0]}` : ''}! What shall we write today?
              </Typography>
              <Typography variant="body2">Pick a suggestion below or ask me anything.</Typography>
            </Stack>
          )}
          {messages.map((m) => (
            <Bubble key={m.id} message={m} onUse={() => setDraft(m.text)} />
          ))}
          {streaming && (
            <Bubble message={{ role: 'assistant', text: streaming.text, draft: false }} />
          )}
          <div ref={bottom} />
        </Stack>
        <Box sx={{ p: 1.5, borderTop: `1px solid ${brand.divider}` }}>
          <Stack
            direction="row"
            sx={{
              gap: 0.75,
              overflowX: 'auto',
              pb: 1,
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            {QUICK_ACTIONS.map((q) => (
              <Chip
                key={q.action}
                label={q.label}
                onClick={() => void send(q.message, q.action)}
                disabled={!ready || !!streaming}
                sx={{ flexShrink: 0 }}
              />
            ))}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
            <InputBase
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={ready ? 'Ask Mango AI…' : 'Mango AI is setting up…'}
              disabled={!ready}
              multiline
              maxRows={5}
              inputProps={{ 'aria-label': 'Message Mango AI', maxLength: 1000 }}
              sx={{
                flex: 1,
                px: 1.5,
                py: 1,
                bgcolor: brand.surface,
                borderRadius: 4,
                border: `1px solid ${brand.divider}`,
              }}
            />
            {streaming ? (
              <IconButton aria-label="Stop" onClick={() => abort.current?.abort()}>
                <StopRounded />
              </IconButton>
            ) : (
              <IconButton
                aria-label="Send"
                disabled={!ready || !input.trim()}
                onClick={() => void send(input)}
                sx={{ bgcolor: brand.mango, '&:hover': { bgcolor: brand.mangoLight } }}
              >
                <SendRounded />
              </IconButton>
            )}
          </Stack>
        </Box>
      </Card>
      {me && draft !== null && (
        <ComposerDialog
          key={draft}
          open
          onClose={() => setDraft(null)}
          me={me}
          initialText={draft}
        />
      )}
    </Stack>
  );
}
