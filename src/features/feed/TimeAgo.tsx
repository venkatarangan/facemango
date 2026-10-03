import Tooltip from '@mui/material/Tooltip';
import { formatFullDate, formatTimeAgo } from '@/lib/timeAgo';
import { useNow } from '@/lib/useNow';

export function TimeAgo({ timestamp }: { timestamp: number }) {
  const now = useNow();
  return (
    <Tooltip title={formatFullDate(timestamp)}>
      <time dateTime={new Date(timestamp).toISOString()}>{formatTimeAgo(timestamp, now)}</time>
    </Tooltip>
  );
}
