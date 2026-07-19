import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import App from './App';
import About from './pages/About';

describe('App shell', () => {
  it('renders the nav and the routed page', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <App />,
          children: [{ path: 'about', element: <About /> }],
        },
      ],
      { initialEntries: ['/about'] },
    );
    render(<RouterProvider router={router} />);

    expect(screen.getByRole('link', { name: 'Home' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'About' })).toBeDefined();
    expect(
      screen.getByRole('heading', { name: 'About this template' }),
    ).toBeDefined();
  });
});
