import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

export function useTodos() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTodos = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getTodos();
      setTodos(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const addTodo = useCallback(async (title) => {
    const todo = await api.createTodo(title);
    setTodos((prev) => [todo, ...prev]);
    return todo;
  }, []);

  const toggleTodo = useCallback(async (id, completed) => {
    const updated = await api.updateTodo(id, { completed: !completed });
    setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }, []);

  const removeTodo = useCallback(async (id) => {
    await api.deleteTodo(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { todos, loading, error, addTodo, toggleTodo, removeTodo };
}
