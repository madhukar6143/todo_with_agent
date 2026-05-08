import { useState, useMemo } from 'react';
import { AddTodo } from './components/AddTodo';
import { TodoList } from './components/TodoList';
import { FilterBar } from './components/FilterBar';
import { useTodos } from './hooks/useTodos';

export default function App() {
  const { todos, loading, error, addTodo, toggleTodo, removeTodo } = useTodos();
  const [filter, setFilter] = useState('All');

  const filtered = useMemo(() => {
    if (filter === 'Active') return todos.filter((t) => !t.completed);
    if (filter === 'Completed') return todos.filter((t) => t.completed);
    return todos;
  }, [todos, filter]);

  const counts = useMemo(
    () => ({ active: todos.filter((t) => !t.completed).length }),
    [todos]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 px-4 py-12">
      <div className="mx-auto w-full max-w-lg">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-green-900 tracking-tight">todo</h1>
          <p className="mt-1 text-sm text-green-900">Stay organised, get things done.</p>
        </header>

        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <AddTodo onAdd={addTodo} />

          {error && (
            <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {loading ? (
            <p className="py-8 text-center text-sm text-green-900">Loading…</p>
          ) : (
            <>
              <FilterBar current={filter} onChange={setFilter} counts={counts} />
              <TodoList todos={filtered} onToggle={toggleTodo} onDelete={removeTodo} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
