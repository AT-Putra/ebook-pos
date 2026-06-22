import { emailConfigured, buildEbookEmail } from '@/lib/email';

describe('emailConfigured', () => {
  it('is true only when enabled AND both creds are present', () => {
    expect(emailConfigured({ enabled: true, user: 'a@gmail.com', password: 'pw' })).toBe(true);
  });

  it('is false when disabled, even with creds', () => {
    expect(emailConfigured({ enabled: false, user: 'a@gmail.com', password: 'pw' })).toBe(false);
  });

  it('is false when a credential is missing', () => {
    expect(emailConfigured({ enabled: true, user: '', password: 'pw' })).toBe(false);
    expect(emailConfigured({ enabled: true, user: 'a@gmail.com', password: '' })).toBe(false);
  });
});

describe('buildEbookEmail', () => {
  const content = buildEbookEmail({
    customerName: 'Budi',
    productName: 'Lose Weight Challenge',
    fileNames: ['ebook.pdf', 'todo-list.pdf'],
  });

  it('puts the product name in the subject', () => {
    expect(content.subject).toBe('E-book kamu: Lose Weight Challenge');
  });

  it('greets the buyer by name', () => {
    expect(content.text).toContain('Halo Budi,');
  });

  it('explains the WhatsApp fallback reason', () => {
    expect(content.text).toContain('WhatsApp');
  });

  it('lists every attached file', () => {
    expect(content.text).toContain('• ebook.pdf');
    expect(content.text).toContain('• todo-list.pdf');
  });
});
