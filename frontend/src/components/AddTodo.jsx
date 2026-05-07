import { useState } from 'react';

export function AddTodo({ onAdd }) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const title = value.trim();
    if (!title) {
      setError('Please enter a task');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onAdd(title);
      setValue('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
      <input
        type="text"
        value={value}
        onChange={(e) => { setValue(e.target.value); setError(''); }}
        placeholder="What needs to be done?"
        disabled={submitting}
        aria-label="New todo title"
        className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-blue-900 placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 active:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Adding…' : 'Add Item'}
      </button>
      {error && (
        <p role="alert" className="absolute mt-10 text-xs text-red-500">{error}</p>
      )}
    </form>
  );
}
