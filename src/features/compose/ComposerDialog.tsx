import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import List from '@mui/material/List';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import CloseRounded from '@mui/icons-material/CloseRounded';
import AddPhotoAlternateRounded from '@mui/icons-material/AddPhotoAlternateRounded';
import EmojiEmotionsRounded from '@mui/icons-material/EmojiEmotionsRounded';
import AlternateEmailRounded from '@mui/icons-material/AlternateEmailRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import { useAIStore, getAI } from '@/ai';
import { brand } from '@/app/tokens';
import { useObjectUrl } from '@/app/useProfile';
import { useUiStore } from '@/app/uiStore';
import { AuthorAvatar } from '@/components/AuthorAvatar';
import { createUserPost, db, updatePost, type Post } from '@/db';
import { onUserPost } from '@/engine';
import { compressToWebP, POST_PHOTO_MAX_PX } from '@/lib/imaging';
import { firstName } from '@/lib/text';
import type { Author } from '@/features/feed/useAuthors';
import { FEELINGS } from './feelings';
import { rewritePost, type RewriteMode } from './mangoRewrite';

const REWRITES: { mode: RewriteMode; label: string }[] = [
  { mode: 'polish', label: 'Polish my post' },
  { mode: 'funnier', label: 'Make it funnier' },
  { mode: 'shorter', label: 'Make it shorter' },
  { mode: 'warmer', label: 'Make it warmer' },
];

interface ComposerProps {
  open: boolean;
  onClose: () => void;
  me: Author;
  /** Edit an existing post instead of creating one. */
  editing?: Post | null;
}

/** Create/edit post (SPEC §3.3): text + one photo, feeling, @mentions, ✨ Mango AI rewrite. */
export function ComposerDialog({ open, onClose, me, editing }: ComposerProps) {
  const fullScreen = useMediaQuery('(max-width:600px)');
  const showToast = useUiStore((s) => s.showToast);
  const aiReady = useAIStore((s) => s.status === 'ready');
  const [text, setText] = useState(editing?.text ?? '');
  const [feeling, setFeeling] = useState<string | undefined>(editing?.feeling);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [mentions, setMentions] = useState<string[]>(editing?.mentions ?? []);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [feelingMenu, setFeelingMenu] = useState<HTMLElement | null>(null);
  const [aiMenu, setAiMenu] = useState<HTMLElement | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const photoUrl = useObjectUrl(photo);
  const friendRows = useLiveQuery(
    () => db.personas.where('kind').equals('friend').sortBy('name'),
    [],
  );
  const friends = useMemo(() => friendRows ?? [], [friendRows]);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return friends
      .filter(
        (f) =>
          f.name
            .toLowerCase()
            .split(' ')
            .some((part) => part.startsWith(q)) || f.name.toLowerCase().startsWith(q),
      )
      .slice(0, 6);
  }, [friends, mentionQuery]);

  const reset = () => {
    abort.current?.abort();
    setText('');
    setFeeling(undefined);
    setPhoto(null);
    setMentions([]);
    setMentionQuery(null);
  };

  const close = () => {
    if (!editing) reset();
    onClose();
  };

  const onTextChange = (value: string) => {
    setText(value);
    const caret = input.current?.selectionStart ?? value.length;
    const match = /(?:^|\s)@([\p{L}]{0,20})$/u.exec(value.slice(0, caret));
    setMentionQuery(match ? match[1]! : null);
  };

  const insertMention = (id: string, name: string) => {
    const caret = input.current?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([\p{L}]{0,20})$/u, `@${name} `);
    setText(before + text.slice(caret));
    setMentions((m) => [...new Set([...m, id])]);
    setMentionQuery(null);
    requestAnimationFrame(() => input.current?.focus());
  };

  const pickPhoto = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return showToast('Please choose an image.');
    try {
      setPhoto(await compressToWebP(f, POST_PHOTO_MAX_PX, 1));
    } catch {
      showToast("Couldn't read that photo.");
    }
  };

  const runRewrite = async (mode: RewriteMode) => {
    setAiMenu(null);
    const ai = getAI();
    if (!ai) return;
    abort.current?.abort();
    abort.current = new AbortController();
    const original = text;
    setAiBusy(true);
    setText('');
    try {
      let out = '';
      for await (const delta of rewritePost(ai, mode, original, me.name, abort.current.signal)) {
        out += delta;
        setText(out);
      }
      if (!out.trim()) setText(original);
    } catch {
      setText(original);
      showToast('Mango AI could not help this time.');
    } finally {
      setAiBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const liveMentions = mentions.filter((id) =>
        text.includes(`@${friends.find((f) => f.id === id)?.name ?? '\u0000'}`),
      );
      if (editing) {
        await updatePost(editing.id, { text, feeling });
        showToast('Post updated.');
      } else {
        const post = await createUserPost({
          text,
          photo: photo ?? undefined,
          feeling,
          mentions: liveMentions,
        });
        void onUserPost(post);
        showToast('Posted! Your friends will see it soon. 🥭');
      }
      reset();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const canPost = !busy && !aiBusy && (text.trim().length > 0 || !!photo);
  const feelingMeta = FEELINGS.find((f) => f.value === feeling);

  return (
    <Dialog
      open={open}
      onClose={close}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      aria-labelledby="composer-title"
    >
      <DialogTitle
        id="composer-title"
        sx={{ textAlign: 'center', fontWeight: 800, position: 'relative' }}
      >
        {editing ? 'Edit post' : 'Create post'}
        <IconButton
          aria-label="Close"
          onClick={close}
          sx={{ position: 'absolute', right: 12, top: 10 }}
        >
          <CloseRounded />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 1.5 }}>
          <AuthorAvatar author={me} size={42} />
          <Box>
            <Typography sx={{ fontWeight: 700 }}>
              {me.name}
              {feelingMeta && (
                <Typography component="span" color="text.secondary">
                  {' '}
                  is {feelingMeta.emoji} feeling {feelingMeta.value}
                </Typography>
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Only your simulated friends see this. It never leaves your device.
            </Typography>
          </Box>
        </Stack>

        <Box sx={{ position: 'relative' }}>
          <InputBase
            inputRef={input}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder={`What's on your mind, ${firstName(me.name)}?`}
            multiline
            minRows={photo ? 2 : 5}
            maxRows={14}
            autoFocus
            fullWidth
            readOnly={aiBusy}
            inputProps={{ 'aria-label': 'Post text', maxLength: 5000 }}
            sx={{ fontSize: text.length < 90 ? '1.4rem' : '1.05rem', lineHeight: 1.4 }}
          />
          {suggestions.length > 0 && (
            <Paper
              elevation={6}
              sx={{ position: 'absolute', zIndex: 2, left: 0, right: 0, mt: 0.5, maxWidth: 360 }}
            >
              <List dense aria-label="Mention a friend">
                {suggestions.map((f) => (
                  <ListItemButton key={f.id} onClick={() => insertMention(f.id, f.name)}>
                    <ListItemAvatar sx={{ minWidth: 44 }}>
                      <AuthorAvatar
                        author={{ id: f.id, kind: f.kind, name: f.name, persona: f }}
                        size={30}
                      />
                    </ListItemAvatar>
                    <ListItemText primary={f.name} secondary={f.city} />
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          )}
        </Box>

        {photoUrl && (
          <Box
            sx={{
              position: 'relative',
              mt: 1.5,
              borderRadius: 3,
              overflow: 'hidden',
              border: `1px solid ${brand.divider}`,
            }}
          >
            <Box
              component="img"
              src={photoUrl}
              alt="Selected photo"
              sx={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'cover' }}
            />
            <IconButton
              aria-label="Remove photo"
              onClick={() => setPhoto(null)}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: 'rgba(255,255,255,0.9)',
                '&:hover': { bgcolor: '#fff' },
              }}
            >
              <CloseRounded />
            </IconButton>
          </Box>
        )}
        {editing?.photo && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            The photo stays as it is.
          </Typography>
        )}

        <Stack
          direction="row"
          sx={{
            mt: 2,
            p: 1,
            border: `1px solid ${brand.divider}`,
            borderRadius: 3,
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 0.5,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, px: 1, mr: 'auto' }}>
            Add to your post
          </Typography>
          {!editing && (
            <Tooltip title="Photo">
              <IconButton aria-label="Add photo" onClick={() => file.current?.click()}>
                <AddPhotoAlternateRounded sx={{ color: '#43A047' }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Feeling">
            <IconButton aria-label="Feeling" onClick={(e) => setFeelingMenu(e.currentTarget)}>
              <EmojiEmotionsRounded sx={{ color: brand.mangoText }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Mention a friend">
            <IconButton
              aria-label="Mention a friend"
              onClick={() => {
                onTextChange(`${text}${text && !text.endsWith(' ') ? ' ' : ''}@`);
                input.current?.focus();
              }}
            >
              <AlternateEmailRounded sx={{ color: '#1E88E5' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={aiReady ? 'Mango AI' : 'Mango AI is still setting up'}>
            <span>
              <Button
                size="small"
                startIcon={<AutoAwesomeRounded />}
                disabled={!aiReady || aiBusy}
                onClick={(e) =>
                  text.trim() ? setAiMenu(e.currentTarget) : void runRewrite('write')
                }
                sx={{
                  color: brand.ink,
                  bgcolor: 'rgba(255,196,0,0.18)',
                  '&:hover': { bgcolor: 'rgba(255,196,0,0.3)' },
                }}
              >
                {aiBusy ? 'Writing…' : text.trim() ? 'Mango AI' : 'Write it for me'}
              </Button>
            </span>
          </Tooltip>
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            aria-label="Post photo"
            onChange={(e) => {
              void pickPhoto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </Stack>

        {mentions.length > 0 && (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
            {mentions.map((id) => {
              const f = friends.find((p) => p.id === id);
              return f && text.includes(`@${f.name}`) ? (
                <Chip key={id} size="small" label={`@${f.name} will reply`} />
              ) : null;
            })}
          </Stack>
        )}

        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={!canPost}
          onClick={() => void submit()}
          sx={{ mt: 2 }}
        >
          {editing ? 'Save' : 'Post'}
        </Button>
      </DialogContent>

      <Menu anchorEl={feelingMenu} open={!!feelingMenu} onClose={() => setFeelingMenu(null)}>
        {feeling && (
          <MenuItem
            onClick={() => {
              setFeeling(undefined);
              setFeelingMenu(null);
            }}
          >
            No feeling
          </MenuItem>
        )}
        {FEELINGS.map((f) => (
          <MenuItem
            key={f.value}
            selected={f.value === feeling}
            onClick={() => {
              setFeeling(f.value);
              setFeelingMenu(null);
            }}
          >
            <span aria-hidden style={{ marginRight: 10 }}>
              {f.emoji}
            </span>
            {f.value}
          </MenuItem>
        ))}
      </Menu>
      <Menu anchorEl={aiMenu} open={!!aiMenu} onClose={() => setAiMenu(null)}>
        {REWRITES.map((r) => (
          <MenuItem key={r.mode} onClick={() => void runRewrite(r.mode)}>
            {r.label}
          </MenuItem>
        ))}
      </Menu>
    </Dialog>
  );
}
