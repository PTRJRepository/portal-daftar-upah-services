/** @vitest-environment jsdom */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
const { act } = React;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token', loading: false }),
}));

vi.mock('../components/employee/EmployeeDetailPage', () => ({
  default: () => React.createElement('main', { 'data-testid': 'employee-detail-page' }, 'Employee detail'),
}));

vi.mock('../components/common/LoadingScreen', () => ({
  default: ({ message }) => React.createElement('div', null, message),
}));

import EmployeeDetailRoute from './EmployeeDetailRoute';

describe('EmployeeDetailRoute layout', () => {
  it('does not add a second vertical scroll container around the detail page', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/employee/detail?emp_code=B001&month=4&year=2026&division=PG2B']}>
          <EmployeeDetailRoute />
        </MemoryRouter>
      );
    });

    expect(container.firstElementChild?.getAttribute('data-testid')).toBe('employee-detail-page');

    await act(async () => {
      root.unmount();
    });
  });
});
