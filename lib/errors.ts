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

export class CaduceusPersonaNotFoundError extends CaduceusError {
  readonly persona: string;

  constructor(persona: string) {
    super(`Persona not found: ${persona}`, "CADUCEUS_PERSONA_NOT_FOUND");
    this.name = "CaduceusPersonaNotFoundError";
    this.persona = persona;
  }
}

export class CaduceusLintError extends CaduceusError {
  readonly issueCount: number;

  constructor(message: string, issueCount: number) {
    super(message, "CADUCEUS_LINT_FAILED");
    this.name = "CaduceusLintError";
    this.issueCount = issueCount;
  }
}

export class CaduceusTemplateError extends CaduceusError {
  readonly templateId: string;

  constructor(templateId: string, message?: string) {
    super(
      message ?? `Unknown template id: '${templateId}'`,
      "CADUCEUS_TEMPLATE_ERROR",
    );
    this.name = "CaduceusTemplateError";
    this.templateId = templateId;
  }
}

export class CaduceusReviewError extends CaduceusError {
  readonly code:
    | "already-started"
    | "invalid-transition"
    | "not-in-review"
    | "not-finalized"
    | "missing-artifact"
    | "no-receipt";

  constructor(code: CaduceusReviewError["code"], message?: string) {
    super(message ?? `Review error: ${code}`, "CADUCEUS_REVIEW_ERROR");
    this.name = "CaduceusReviewError";
    this.code = code;
  }
}


export class CaduceusProfileNotFoundError extends CaduceusError {
  readonly name: string;

  constructor(name: string) {
    super(`Profile not found: ${name}`, "CADUCEUS_PROFILE_NOT_FOUND");
    this.name = "CaduceusProfileNotFoundError";
    this.name = name;
  }
}

export class CaduceusProfileError extends CaduceusError {
  readonly path: string;

  constructor(message: string, path: string) {
    super(message, "CADUCEUS_PROFILE_ERROR");
    this.name = "CaduceusProfileError";
    this.path = path;
  }
}
