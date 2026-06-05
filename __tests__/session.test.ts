import { COOKIE_NAME } from '@/lib/session';

describe('session constants', () => {
  it('exports the expected cookie name', () => {
    expect(COOKIE_NAME).toBe('admin_session');
  });
});

// createSession / validateSession / deleteSession hit the DB and are integration-tested
// manually at deploy time. Unit tests here cover only pure logic.
