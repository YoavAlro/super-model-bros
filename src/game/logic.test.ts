import { describe, expect, it } from 'vitest';
import { dietHint, dietMatch, emptyCounts, historyStars } from './diet';
import { LevelGrid, T } from './level';
import { bumpedTile, moveBody, type Body } from './physics';

const map = [
  '          ', // y = 4
  '   ?M     ', // y = 3
  '          ', // y = 2
  'S  e   o F', // y = 1
  '####  ####', // y = 0
];

const body = (over: Partial<Body>): Body => ({ x: 0, y: 1, w: 0.8, h: 0.95, vx: 0, vy: 0, onGround: false, ...over });

describe('LevelGrid', () => {
  const grid = new LevelGrid(map);

  it('flips rows so y = 0 is the bottom', () => {
    expect(grid.width).toBe(10);
    expect(grid.height).toBe(5);
    expect(grid.get(0, 0)).toBe(T.GROUND);
    expect(grid.get(3, 3)).toBe(T.QUESTION);
  });

  it('records block contents and spawns', () => {
    expect(grid.contents.get(grid.index(3, 3))).toBe('token');
    expect(grid.contents.get(grid.index(4, 3))).toBe('scale');
    expect(grid.spawnOf('spawn')).toMatchObject({ x: 0, y: 1 });
    expect(grid.spawns.find((s) => s.kind === 'token')).toMatchObject({ x: 7, token: 'books' });
  });

  it('treats the sides as walls and the bottom as a pit', () => {
    expect(grid.isSolid(-1, 1)).toBe(true);
    expect(grid.isSolid(10, 1)).toBe(true);
    expect(grid.isSolid(4, -1)).toBe(false);
    expect(grid.isSolid(4, 0)).toBe(false);
  });
});

describe('moveBody', () => {
  const grid = new LevelGrid(map);

  it('lands on the ground', () => {
    const b = body({ x: 1, y: 1.2, vy: -10 });
    const hits = moveBody(b, 0.05, grid);
    expect(b.y).toBe(1);
    expect(b.onGround).toBe(true);
    expect(hits.some((h) => h.side === 'feet')).toBe(true);
  });

  it('falls into a pit', () => {
    const b = body({ x: 4.1, y: 1, vy: -10 });
    moveBody(b, 0.05, grid);
    expect(b.onGround).toBe(false);
    expect(b.y).toBeLessThan(1);
  });

  it('is stopped by the left wall', () => {
    const b = body({ x: 0.05, vx: -10 });
    moveBody(b, 0.05, grid);
    expect(b.x).toBe(0);
  });

  it('reports the block bumped by a jump, nearest the center', () => {
    const b = body({ x: 3.1, y: 1.9, vy: 10 });
    const hits = moveBody(b, 0.05, grid);
    expect(b.vy).toBe(0);
    expect(bumpedTile(b, hits)).toMatchObject({ tx: 3, ty: 3 });
  });
});

describe('diet', () => {
  it('scores a pure books diet as a perfect GPT-1 match', () => {
    const c = emptyCounts();
    c.books = 20;
    expect(dietMatch(c, { books: 1 })).toBe(1);
    expect(historyStars(1)).toBe(3);
  });

  it('gives fewer stars and a hint for an off-history diet', () => {
    const c = emptyCounts();
    c.books = 5;
    c.web = 15;
    const match = dietMatch(c, { books: 1 });
    expect(match).toBeCloseTo(0.25);
    expect(historyStars(match)).toBe(1);
    expect(dietHint(c, { books: 1 }, 'GPT-1')).toBe('GPT-1 needs more Books');
  });
});
