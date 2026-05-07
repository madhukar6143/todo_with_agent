const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Use an in-memory-style temp DB for tests
const TEST_DB = path.join(__dirname, '..', 'test.db');
process.env.DB_PATH = TEST_DB;

const app = require('../src/app');
const { closeDb } = require('../src/db');

afterAll(() => {
  closeDb();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

beforeEach(async () => {
  // Clear todos between tests
  closeDb();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe('GET /api/todos', () => {
  it('returns an empty array when no todos exist', async () => {
    const res = await request(app).get('/api/todos');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all todos', async () => {
    await request(app).post('/api/todos').send({ title: 'First' });
    await request(app).post('/api/todos').send({ title: 'Second' });
    const res = await request(app).get('/api/todos');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe('POST /api/todos', () => {
  it('creates a todo and returns 201', async () => {
    const res = await request(app).post('/api/todos').send({ title: 'Buy milk' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Buy milk', completed: 0 });
    expect(res.body.id).toBeDefined();
  });

  it('trims whitespace from title', async () => {
    const res = await request(app).post('/api/todos').send({ title: '  Walk dog  ' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Walk dog');
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/api/todos').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when title is empty string', async () => {
    const res = await request(app).post('/api/todos').send({ title: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when title is not a string', async () => {
    const res = await request(app).post('/api/todos').send({ title: 123 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe('PUT /api/todos/:id', () => {
  let todo;
  beforeEach(async () => {
    const res = await request(app).post('/api/todos').send({ title: 'Original' });
    todo = res.body;
  });

  it('marks a todo as completed', async () => {
    const res = await request(app).put(`/api/todos/${todo.id}`).send({ completed: true });
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(1);
  });

  it('marks a todo as incomplete', async () => {
    await request(app).put(`/api/todos/${todo.id}`).send({ completed: true });
    const res = await request(app).put(`/api/todos/${todo.id}`).send({ completed: false });
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(0);
  });

  it('updates the title', async () => {
    const res = await request(app).put(`/api/todos/${todo.id}`).send({ title: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
  });

  it('returns 404 for non-existent todo', async () => {
    const res = await request(app).put('/api/todos/9999').send({ completed: true });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid id', async () => {
    const res = await request(app).put('/api/todos/abc').send({ completed: true });
    expect(res.status).toBe(400);
  });

  it('returns 400 when completed is not boolean', async () => {
    const res = await request(app).put(`/api/todos/${todo.id}`).send({ completed: 'yes' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/todos/:id', () => {
  let todo;
  beforeEach(async () => {
    const res = await request(app).post('/api/todos').send({ title: 'To delete' });
    todo = res.body;
  });

  it('deletes a todo and returns it', async () => {
    const res = await request(app).delete(`/api/todos/${todo.id}`);
    expect(res.status).toBe(200);
    expect(res.body.todo.id).toBe(todo.id);
  });

  it('removes the todo from the list', async () => {
    await request(app).delete(`/api/todos/${todo.id}`);
    const res = await request(app).get('/api/todos');
    expect(res.body.find((t) => t.id === todo.id)).toBeUndefined();
  });

  it('returns 404 for non-existent todo', async () => {
    const res = await request(app).delete('/api/todos/9999');
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid id', async () => {
    const res = await request(app).delete('/api/todos/abc');
    expect(res.status).toBe(400);
  });
});
