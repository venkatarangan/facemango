// @vitest-environment happy-dom
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@/app/theme';
import { AboutPage } from './AboutPage';

function renderPage() {
  const router = createMemoryRouter([{ path: '/', element: <AboutPage /> }]);
  return render(
    <ThemeProvider theme={theme}>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
}

describe('AboutPage books', () => {
  it('ends with a Books by the author section with correct external links', () => {
    const { container } = renderPage();
    const sections = [...container.querySelectorAll('section')];
    const last = sections[sections.length - 1]!;
    expect(last.getAttribute('aria-label')).toBe('Books by the author');
    const box = within(last as HTMLElement);
    const expected: Record<string, string> = {
      'The Founder Catalyst': 'https://thefoundercatalyst.com/fcbook/',
      'Seyaligalin Kathai (செயலிகளின் கதை)': 'https://thefoundercatalyst.com/seyaligalinkathaibook/',
      'Nutpam (நுட்பம்)': 'https://thefoundercatalyst.com/nutpambook/',
    };
    for (const [name, href] of Object.entries(expected)) {
      const link = box.getByRole('link', { name });
      expect(link.getAttribute('href')).toBe(href);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
    expect(screen.getAllByRole('link').length).toBeGreaterThan(3);
  });
});
