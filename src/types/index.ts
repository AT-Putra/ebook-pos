// Shared TypeScript types.
// Feature-specific types live alongside their feature module.

export type ApiError = {
  error: string;
  fields?: Record<string, string[]>;
};
