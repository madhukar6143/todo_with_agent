const { getDb } = require('./db');

function getAllTodos() {
  return getDb().prepare('SELECT * FROM todos ORDER BY created_at DESC').all();
}

function getTodoById(id) {
  return getDb().prepare('SELECT * FROM todos WHERE id = ?').get(id);
}

function createTodo(title) {
  const stmt = getDb().prepare('INSERT INTO todos (title) VALUES (?)');
  const result = stmt.run(title.trim());
  return getTodoById(result.lastInsertRowid);
}

function updateTodo(id, { title, completed }) {
  const todo = getTodoById(id);
  if (!todo) return null;

  const newTitle = title !== undefined ? title.trim() : todo.title;
  const newCompleted = completed !== undefined ? (completed ? 1 : 0) : todo.completed;

  getDb()
    .prepare('UPDATE todos SET title = ?, completed = ? WHERE id = ?')
    .run(newTitle, newCompleted, id);

  return getTodoById(id);
}

function deleteTodo(id) {
  const todo = getTodoById(id);
  if (!todo) return null;
  getDb().prepare('DELETE FROM todos WHERE id = ?').run(id);
  return todo;
}

module.exports = { getAllTodos, getTodoById, createTodo, updateTodo, deleteTodo };
