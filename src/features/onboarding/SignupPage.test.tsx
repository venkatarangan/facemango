// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@/app/theme';
import { db, deleteAllData, ME } from '@/db';
import { SignupPage } from './SignupPage';

function renderSignup() {
  const router = createMemoryRouter(
    [
      { path: '/signup', element: <SignupPage /> },
      { path: '/', element: <p>Home feed</p> },
    ],
    { initialEntries: ['/signup'] },
  );
  render(
    <ThemeProvider theme={theme}>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
}

afterEach(async () => {
  await deleteAllData();
});

describe('SignupPage', () => {
  it('blocks under-13s and a missing acknowledgement', async () => {
    const user = userEvent.setup();
    renderSignup();
    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Kavya');
    await user.type(screen.getByRole('spinbutton', { name: /age/i }), '12');
    await user.type(screen.getByRole('textbox', { name: /city/i }), 'Coimbatore');
    await user.click(screen.getByRole('button', { name: /find my friends/i }));

    expect(await screen.findByText(/13 or older to use FaceMango/i)).toBeInTheDocument();
    expect(screen.getByText(/please confirm you understand/i)).toBeInTheDocument();
    expect(await db.profile.count()).toBe(0);
  });

  it('saves the profile and goes to the feed', async () => {
    const user = userEvent.setup();
    renderSignup();
    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Kavya');
    await user.type(screen.getByRole('spinbutton', { name: /age/i }), '24');
    await user.type(screen.getByRole('textbox', { name: /city/i }), 'Coimbatore');
    await user.click(screen.getByRole('checkbox', { name: /i understand/i }));
    await user.click(screen.getByRole('button', { name: /find my friends/i }));

    expect(await screen.findByText('Home feed')).toBeInTheDocument();
    const profile = await db.profile.get(ME);
    expect(profile).toMatchObject({
      name: 'Kavya',
      age: 24,
      city: 'Coimbatore',
      languages: ['English'],
    });
  });
});
