// ---------------------------------------------------------------------------
// caduceus — error types
//
// CaduceusError is the base; CaduceusConfigError is thrown by config-store
// when a config file is malformed or unreadable. Slash commands catch
// CaduceusError and surface a friendly message via ctx.ui.notify().
// ---------------------------------------------------------------------------

export class CaduceusError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "CaduceusError";
    this.code = code;
  }
}

export class CaduceusConfigError extends CaduceusError {
  readonly path: string;

  constructor(message: string, path: string) {
    super(message, "CADUCEUS_CONFIG_ERROR");
    this.name = "CaduceusConfigError";
    this.path = path;
  }
}
