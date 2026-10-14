// @vitest-environment happy-dom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { MotionGlobalConfig } from 'motion/react';
import { ThemeProvider } from '@mui/material/styles';
import { useAIStore } from '@/ai';
import { theme } from '@/app/theme';
import { useEngineStore } from '@/engine/store';
import { UNIQUENESS } from '@/lib/copy';
import { SetupCard } from './SetupCard';

function renderCard(onWritePost = vi.fn()) {
  const router = createMemoryRouter([
    { path: '/', element: <SetupCard onWritePost={onWritePost} /> },
  ]);
  render(
    <ThemeProvider theme={theme}>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
  return onWritePost;
}

// happy-dom can't run Web Animations; jump straight to the end state.
beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false;
});

beforeEach(() => {
  useEngineStore.setState({ setup: { stage: 'waiting-for-ai', done: 0, total: 0 } });
});

describe('SetupCard', () => {
  it('shows the download stage with size and time left, a tip and things to do', async () => {
    useAIStore.setState({
      status: 'downloading',
      tier: 'webgpu',
      phase: 'download',
      progress: 0.45,
      progressText: 'Fetching param cache[3/27]: 540MB fetched. 45% completed',
      secondsLeft: 185,
      progressAt: Date.now(),
    });
    const onWrite = renderCard();
    expect(screen.getByText('Downloading your AI (once only)')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('540 MB of 1.2 GB · About 3 minutes left')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Step 1 of 3');
    expect(screen.getByTestId('setup-tip')).toHaveTextContent(UNIQUENESS);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Next tip' }));
    expect(await screen.findByText(/downloads? happens once/)).toBeInTheDocument();
    expect(screen.getByTestId('setup-tip')).not.toHaveTextContent(UNIQUENESS);
    await user.click(screen.getByRole('button', { name: 'Write a post' }));
    expect(onWrite).toHaveBeenCalled();
  });

  it('moves to waking up, then meeting friends, then hides', () => {
    useAIStore.setState({ status: 'downloading', phase: 'load', progress: 0.3 });
    renderCard();
    expect(screen.getByText('Your AI is on this device')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Step 2 of 3: Waking it up');

    act(() => {
      useAIStore.setState({ status: 'ready', progress: 1 });
      useEngineStore.setState({ setup: { stage: 'public', done: 5, total: 50 } });
    });
    expect(screen.getByText('Your AI is awake')).toBeInTheDocument();
    expect(screen.getByText('Meeting people around you')).toBeInTheDocument();
    expect(screen.getByText('5 of 50')).toBeInTheDocument();

    act(() => useEngineStore.setState({ setup: { stage: 'done', done: 0, total: 0 } }));
    expect(screen.queryByRole('region', { name: 'Setting up FaceMango' })).toBeNull();
  });

  it('offers a retry when the download fails', () => {
    useAIStore.setState({ status: 'error', phase: 'download', error: 'Network error' });
    renderCard();
    expect(screen.getByText(/The download stopped: Network error/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
