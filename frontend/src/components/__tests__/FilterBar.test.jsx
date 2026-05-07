import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { FilterBar } from '../FilterBar';

describe('FilterBar', () => {
  it('renders All, Active, Completed buttons', () => {
    render(<FilterBar current="All" onChange={vi.fn()} counts={{ active: 0 }} />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('marks current filter as pressed', () => {
    render(<FilterBar current="Active" onChange={vi.fn()} counts={{ active: 2 }} />);
    expect(screen.getByText('Active')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('All')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the filter name when clicked', async () => {
    const onChange = vi.fn();
    render(<FilterBar current="All" onChange={onChange} counts={{ active: 0 }} />);
    await userEvent.click(screen.getByText('Completed'));
    expect(onChange).toHaveBeenCalledWith('Completed');
  });

  it('displays the active count', () => {
    render(<FilterBar current="All" onChange={vi.fn()} counts={{ active: 3 }} />);
    expect(screen.getByText('3 left')).toBeInTheDocument();
  });
});
