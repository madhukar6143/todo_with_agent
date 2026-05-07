import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TodoItem } from '../TodoItem';

const makeTodo = (overrides = {}) => ({
  id: 1,
  title: 'Test task',
  completed: 0,
  created_at: '2024-01-01',
  ...overrides,
});

describe('TodoItem', () => {
  it('renders the todo title', () => {
    render(<TodoItem todo={makeTodo()} onToggle={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Test task')).toBeInTheDocument();
  });

  it('shows unchecked checkbox for incomplete todo', () => {
    render(<TodoItem todo={makeTodo({ completed: 0 })} onToggle={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('shows checked checkbox for completed todo', () => {
    render(<TodoItem todo={makeTodo({ completed: 1 })} onToggle={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('applies line-through style when completed', () => {
    render(<TodoItem todo={makeTodo({ completed: 1 })} onToggle={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Test task')).toHaveClass('line-through');
  });

  it('calls onToggle with id and completed state when checkbox clicked', async () => {
    const onToggle = vi.fn();
    render(<TodoItem todo={makeTodo({ id: 42, completed: 0 })} onToggle={onToggle} onDelete={vi.fn()} />);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith(42, false);
  });

  it('calls onDelete with id when delete button clicked', async () => {
    const onDelete = vi.fn();
    render(<TodoItem todo={makeTodo({ id: 7 })} onToggle={vi.fn()} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(7);
  });
});
