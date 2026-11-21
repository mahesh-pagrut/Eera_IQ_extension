import { createBrowserCommandHandlers } from './commands/browserCommandHandlers.js';
import { validateCommand } from './commandValidator.js';

const browserCommandHandlers = createBrowserCommandHandlers();

export async function executeCommand(command, options = {}) {
  const handler = Object.hasOwn(browserCommandHandlers, command?.intent)
    ? browserCommandHandlers[command.intent]
    : undefined;
  const validation = validateCommand(command, handler);
  if (!validation.valid) {
    return {
      ok: false,
      response:
        validation.code === 'invalid-parameters'
          ? validation.message
          : "I couldn't validate that command. Please try again.",
      error: validation.message,
      errorCode: validation.code,
    };
  }

  try {
    return await handler.execute(command.parameters, options);
  } catch (error) {
    return {
      ok: false,
      response: 'I could not complete that command. Please try again.',
      error: error instanceof Error ? error.message : 'The command handler failed.',
      errorCode: 'handler-failed',
    };
  }
}

export { createBrowserCommandHandlers };
