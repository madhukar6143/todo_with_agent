import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AddTodo } from '../AddTodo';

describe('AddTodo', () => {
  it('renders the input and button', () => {
    render(<AddTodo onAdd={vi.fn()} />);
    expect(screen.getByPlaceholderText(/what needs to be done/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });

  it('calls onAdd with the trimmed title on submit', async () => {
    const onAdd = vi.fn().mockResolvedValue({});
    render(<AddTodo onAdd={onAdd} />);
    await userEvent.type(screen.getByRole('textbox'), '  Buy groceries  ');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('Buy groceries'));
  });

  it('clears the input after successful add', async () => {
    const onAdd = vi.fn().mockResolvedValue({});
    render(<AddTodo onAdd={onAdd} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Task');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    await waitFor(() => expect(input.value).toBe(''));
  });

  it('shows error when submitting empty input', async () => {
    render(<AddTodo onAdd={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/please enter a task/i);
  });

  it('shows error message when onAdd throws', async () => {
    const onAdd = vi.fn().mockRejectedValue(new Error('Server error'));
    render(<AddTodo onAdd={onAdd} />);
    await userEvent.type(screen.getByRole('textbox'), 'Bad task');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/server error/i);
  });

  it('disables input and button while submitting', async () => {
    let resolve;
    const onAdd = vi.fn(() => new Promise((r) => { resolve = r; }));
    render(<AddTodo onAdd={onAdd} />);
    await userEvent.type(screen.getByRole('textbox'), 'Pending task');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button')).toBeDisabled();
    resolve({});
  });
});
