export function createResponseSelector({ random = Math.random } = {}) {
  const lastIndexByKey = new Map();

  return function selectResponse(responses, key) {
    if (!Array.isArray(responses) || responses.length === 0) {
      throw new RangeError(`No response variations are configured for "${key}".`);
    }
    if (responses.length === 1) return responses[0];

    const previousIndex = lastIndexByKey.get(key);
    const offset = Math.min(
      responses.length - 1,
      Math.max(0, Math.floor(random() * (responses.length - 1))),
    );
    const nextIndex =
      previousIndex === undefined
        ? Math.min(responses.length - 1, Math.floor(random() * responses.length))
        : (previousIndex + 1 + offset) % responses.length;
    lastIndexByKey.set(key, nextIndex);
    return responses[nextIndex];
  };
}
