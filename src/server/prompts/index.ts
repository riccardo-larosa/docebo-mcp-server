/**
 * MCP Prompt registry for guided workflows.
 */

export interface PromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: PromptArgument[];
  getMessages: (args: Record<string, string>) => { role: string; content: { type: string; text: string } }[];
}

const promptRegistry = new Map<string, PromptDefinition>();

export function registerPrompt(prompt: PromptDefinition): void {
  promptRegistry.set(prompt.name, prompt);
}

export function getPrompts(): PromptDefinition[] {
  return Array.from(promptRegistry.values());
}

export function getPromptMessages(
  name: string,
  args: Record<string, string>
): { role: string; content: { type: string; text: string } }[] {
  const prompt = promptRegistry.get(name);
  if (!prompt) {
    throw new Error(`Prompt not found: ${name}`);
  }

  // Validate required arguments
  if (prompt.arguments) {
    for (const arg of prompt.arguments) {
      if (arg.required && (!args[arg.name] || args[arg.name].trim() === '')) {
        throw new Error(`Missing required argument: ${arg.name}`);
      }
    }
  }

  return prompt.getMessages(args);
}

export function clearPrompts(): void {
  promptRegistry.clear();
}
