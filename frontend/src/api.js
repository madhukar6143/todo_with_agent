const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  getTodos: () => request('/todos'),
  createTodo: (title) => request('/todos', { method: 'POST', body: JSON.stringify({ title }) }),
  updateTodo: (id, patch) => request(`/todos/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  deleteTodo: (id) => request(`/todos/${id}`, { method: 'DELETE' }),
};
