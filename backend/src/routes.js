const express = require('express');
const { getAllTodos, createTodo, updateTodo, deleteTodo } = require('./todos');

const router = express.Router();

router.get('/todos', (req, res) => {
  res.json(getAllTodos());
});

router.post('/todos', (req, res) => {
  const { title } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required and must be a non-empty string' });
  }
  const todo = createTodo(title);
  res.status(201).json(todo);
});

router.put('/todos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });

  const { title, completed } = req.body;
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    return res.status(400).json({ error: 'title must be a non-empty string' });
  }
  if (completed !== undefined && typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'completed must be a boolean' });
  }

  const todo = updateTodo(id, { title, completed });
  if (!todo) return res.status(404).json({ error: 'todo not found' });
  res.json(todo);
});

router.delete('/todos/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });

  const todo = deleteTodo(id);
  if (!todo) return res.status(404).json({ error: 'todo not found' });
  res.json({ message: 'deleted', todo });
});

module.exports = router;
