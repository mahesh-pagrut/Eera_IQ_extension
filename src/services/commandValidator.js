const COMMAND_KEYS = new Set([
  'type',
  'intent',
  'parameters',
  'confidence',
  'normalizedText',
]);

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function validateCommand(command, handler) {
  if (!isRecord(command)) {
    return {
      valid: false,
      code: 'invalid-command',
      message: 'The command was invalid.',
    };
  }
  if (
    Object.keys(command).some((key) => !COMMAND_KEYS.has(key)) ||
    command.type !== 'command' ||
    typeof command.intent !== 'string' ||
    !command.intent.trim() ||
    typeof command.normalizedText !== 'string' ||
    !Number.isFinite(command.confidence) ||
    command.confidence <= 0 ||
    command.confidence > 1
  ) {
    return {
      valid: false,
      code: 'invalid-command',
      message: 'The command was invalid.',
    };
  }
  if (!isRecord(command.parameters)) {
    return {
      valid: false,
      code: 'invalid-parameters',
      message: 'The command parameters are missing or invalid.',
    };
  }
  if (!handler) {
    return {
      valid: false,
      code: 'unsupported-command',
      message: 'That command is not supported yet.',
    };
  }
  if (typeof handler.execute !== 'function') {
    return {
      valid: false,
      code: 'invalid-handler',
      message: 'That command is not available right now.',
    };
  }
  if (
    handler.validateParameters !== undefined &&
    typeof handler.validateParameters !== 'function'
  ) {
    return {
      valid: false,
      code: 'invalid-handler',
      message: 'That command is not available right now.',
    };
  }

  const parameterError = handler.validateParameters?.(command.parameters);
  if (
    parameterError !== undefined &&
    parameterError !== null &&
    (typeof parameterError !== 'string' || !parameterError.trim())
  ) {
    return {
      valid: false,
      code: 'invalid-handler',
      message: 'That command is not available right now.',
    };
  }
  if (parameterError) {
    return {
      valid: false,
      code: 'invalid-parameters',
      message: parameterError,
    };
  }

  return { valid: true };
}

export { isRecord };
