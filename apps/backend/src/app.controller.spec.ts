describe('Application', () => {
  it('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have working test infrastructure', () => {
    const testObject = { value: 'test' };
    expect(testObject.value).toBe('test');
  });
});
