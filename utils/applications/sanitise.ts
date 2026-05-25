import type { QuestionRecord, PublicQuestion, QuestionConfig } from "./types";

export function sanitiseQuestionForPublic(q: QuestionRecord): PublicQuestion {
  const cfg: QuestionConfig = (q.config ?? {}) as QuestionConfig;
  const safeChoices = cfg.choices?.map((c) => ({ id: c.id, label: c.label }));
  return {
    id: q.id,
    order: q.order,
    title: q.title,
    description: q.description,
    type: q.type,
    required: q.required,
    config: {
      choices: safeChoices,
      min: cfg.min,
      max: cfg.max,
      step: cfg.step,
      minLabel: cfg.minLabel,
      maxLabel: cfg.maxLabel,
      minLength: cfg.minLength,
      maxLength: cfg.maxLength,
    },
  };
}
