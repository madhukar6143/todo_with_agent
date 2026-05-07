import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TodoList } from '../TodoList';

const todos = [
  { id: 1, title: 'First', completed: 0, created_at: '2024-01-01' },
  { id: 2, title: 'Second', completed: 1, created_at: '2024-01-02' },
];

describe('TodoList', () => {
  it('renders empty state when no todos', () => {
    render(<TodoList todos={[]} onToggle={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
  });

  it('renders a list item for each todo', () => {
    render(<TodoList todos={todos} onToggle={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('renders correct number of items', () => {
    render(<TodoList todos={todos} onToggle={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
