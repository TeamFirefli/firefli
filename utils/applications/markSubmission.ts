import type {
  BreakdownItem,
  MarkingResult,
  QuestionConfig,
  QuestionRecord,
  SubmittedAnswer,
  SubmissionStatus,
} from "./types";

export class MarkingValidationError extends Error {
  questionId?: string;
  constructor(message: string, questionId?: string) {
    super(message);
    this.questionId = questionId;
    this.name = "MarkingValidationError";
  }
}

interface FormLike {
  passingScore: number | null;
  requireManualReview: boolean;
}

function normalizeText(value: string, caseSensitive: boolean) {
  const v = value.trim();
  return caseSensitive ? v : v.toLowerCase();
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function markSingleChoice(
  q: QuestionRecord,
  value: unknown,
  cfg: QuestionConfig
): BreakdownItem {
  const choices = cfg.choices ?? [];
  if (typeof value !== "string" || !choices.find((c) => c.id === value)) {
    throw new MarkingValidationError("Invalid choice value", q.id);
  }
  const correct = cfg.correctChoiceIds?.[0];
  const isCorrect = !!correct && value === correct;
  return {
    questionId: q.id,
    type: q.type,
    awardedPoints: isCorrect ? q.points : 0,
    maxPoints: q.points,
    correct: correct ? isCorrect : null,
  };
}

function markMultipleChoice(
  q: QuestionRecord,
  value: unknown,
  cfg: QuestionConfig
): BreakdownItem {
  const choices = cfg.choices ?? [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new MarkingValidationError("Invalid choice selection", q.id);
  }
  const selected = value as string[];
  for (const s of selected) {
    if (!choices.find((c) => c.id === s)) {
      throw new MarkingValidationError(`Unknown choice id: ${s}`, q.id);
    }
  }
  const correct = new Set(cfg.correctChoiceIds ?? []);
  if (correct.size === 0) {
    return { questionId: q.id, type: q.type, awardedPoints: 0, maxPoints: q.points, correct: null };
  }
  const sel = new Set(selected);
  const mode = cfg.multipleChoiceMode ?? "exact";
  if (mode === "exact") {
    const isExact = sel.size === correct.size && [...correct].every((c) => sel.has(c));
    return {
      questionId: q.id,
      type: q.type,
      awardedPoints: isExact ? q.points : 0,
      maxPoints: q.points,
      correct: isExact,
    };
  }
  // partial
  const perCorrect = correct.size > 0 ? q.points / correct.size : 0;
  let awarded = 0;
  let rightCount = 0;
  let wrongCount = 0;
  for (const s of sel) {
    if (correct.has(s)) {
      awarded += perCorrect;
      rightCount++;
    } else {
      wrongCount++;
      awarded -= cfg.partialPenalty ?? 0;
    }
  }
  awarded = Math.max(0, Math.min(q.points, Math.round(awarded)));
  return {
    questionId: q.id,
    type: q.type,
    awardedPoints: awarded,
    maxPoints: q.points,
    correct: rightCount === correct.size && wrongCount === 0,
    notes: `${rightCount}/${correct.size} correct, ${wrongCount} wrong`,
  };
}

function markScale(
  q: QuestionRecord,
  value: unknown,
  cfg: QuestionConfig
): BreakdownItem {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    throw new MarkingValidationError("Scale value must be numeric", q.id);
  }
  const min = cfg.min ?? 0;
  const max = cfg.max ?? 10;
  if (num < min || num > max) {
    throw new MarkingValidationError(`Scale value out of bounds [${min}, ${max}]`, q.id);
  }
  const mode = cfg.scaleMode ?? "exact";
  if (mode === "exact") {
    if (cfg.exactValue === undefined) {
      return { questionId: q.id, type: q.type, awardedPoints: 0, maxPoints: q.points, correct: null };
    }
    const ok = num === cfg.exactValue;
    return { questionId: q.id, type: q.type, awardedPoints: ok ? q.points : 0, maxPoints: q.points, correct: ok };
  }
  if (mode === "range") {
    if (cfg.rangeMin === undefined || cfg.rangeMax === undefined) {
      return { questionId: q.id, type: q.type, awardedPoints: 0, maxPoints: q.points, correct: null };
    }
    const ok = num >= cfg.rangeMin && num <= cfg.rangeMax;
    return { questionId: q.id, type: q.type, awardedPoints: ok ? q.points : 0, maxPoints: q.points, correct: ok };
  }
  // bands
  const band = (cfg.bands ?? []).find((b) => num >= b.from && num <= b.to);
  const awarded = band ? Math.min(q.points, Math.max(0, band.points)) : 0;
  return {
    questionId: q.id,
    type: q.type,
    awardedPoints: awarded,
    maxPoints: q.points,
    correct: awarded === q.points ? true : awarded === 0 ? false : null,
  };
}

function markYesNo(
  q: QuestionRecord,
  value: unknown,
  cfg: QuestionConfig
): BreakdownItem {
  let b: boolean;
  if (typeof value === "boolean") b = value;
  else if (value === "yes" || value === "Yes" || value === "true" || value === true) b = true;
  else if (value === "no" || value === "No" || value === "false" || value === false) b = false;
  else throw new MarkingValidationError("Yes/No answer must be boolean", q.id);
  if (cfg.correctBoolean === undefined) {
    return { questionId: q.id, type: q.type, awardedPoints: 0, maxPoints: q.points, correct: null };
  }
  const ok = b === cfg.correctBoolean;
  return { questionId: q.id, type: q.type, awardedPoints: ok ? q.points : 0, maxPoints: q.points, correct: ok };
}

function markFreeText(
  q: QuestionRecord,
  value: unknown,
  cfg: QuestionConfig
): BreakdownItem {
  if (typeof value !== "string") {
    throw new MarkingValidationError("Text answer must be a string", q.id);
  }
  const text = value;
  if (cfg.minLength !== undefined && text.trim().length < cfg.minLength) {
    throw new MarkingValidationError(`Answer too short (min ${cfg.minLength})`, q.id);
  }
  if (cfg.maxLength !== undefined && text.length > cfg.maxLength) {
    throw new MarkingValidationError(`Answer too long (max ${cfg.maxLength})`, q.id);
  }
  const mode = cfg.textMode ?? "manual";
  if (mode === "manual") {
    return { questionId: q.id, type: q.type, awardedPoints: 0, maxPoints: q.points, correct: null, notes: "manual review" };
  }
  const caseSensitive = !!cfg.caseSensitive;
  const norm = normalizeText(text, caseSensitive);
  if (mode === "accepted_list") {
    const accepted = (cfg.acceptedAnswers ?? []).map((a) => normalizeText(a, caseSensitive));
    const ok = accepted.includes(norm);
    return { questionId: q.id, type: q.type, awardedPoints: ok ? q.points : 0, maxPoints: q.points, correct: ok };
  }
  // keywords
  const kws = (cfg.keywords ?? []).map((k) => normalizeText(k, caseSensitive));
  if (kws.length === 0) {
    return { questionId: q.id, type: q.type, awardedPoints: 0, maxPoints: q.points, correct: null };
  }
  const rule = cfg.keywordRule ?? "any";
  const hits = kws.filter((k) => norm.includes(k));
  const ok = rule === "all" ? hits.length === kws.length : hits.length > 0;
  return {
    questionId: q.id,
    type: q.type,
    awardedPoints: ok ? q.points : 0,
    maxPoints: q.points,
    correct: ok,
    notes: `${hits.length}/${kws.length} keywords matched`,
  };
}

export function markSubmission(
  form: FormLike,
  questions: QuestionRecord[],
  answers: SubmittedAnswer[]
): MarkingResult {
  const byId = new Map<string, SubmittedAnswer>();
  for (const a of answers) {
    if (!a || typeof a.questionId !== "string") {
      throw new MarkingValidationError("Answer missing questionId");
    }
    byId.set(a.questionId, a);
  }

  const validIds = new Set(questions.map((q) => q.id));
  for (const id of byId.keys()) {
    if (!validIds.has(id)) {
      throw new MarkingValidationError(`Unknown question id: ${id}`, id);
    }
  }

  const breakdown: BreakdownItem[] = [];
  let hasPendingManualReview = false;

  for (const q of questions) {
    const cfg: QuestionConfig = (q.config && isPlainObject(q.config) ? q.config : {}) as QuestionConfig;
    const answer = byId.get(q.id);
    const provided = answer !== undefined && answer.value !== undefined && answer.value !== null && !(typeof answer.value === "string" && answer.value.trim() === "");

    if (!provided) {
      if (q.required) {
        throw new MarkingValidationError(`Missing required answer for question ${q.id}`, q.id);
      }
      breakdown.push({ questionId: q.id, type: q.type, awardedPoints: 0, maxPoints: q.points, correct: null, notes: "no answer" });
      continue;
    }

    let item: BreakdownItem;
    switch (q.type) {
      case "single_choice":
        item = markSingleChoice(q, answer!.value, cfg); break;
      case "multiple_choice":
        item = markMultipleChoice(q, answer!.value, cfg); break;
      case "scale_slider":
        item = markScale(q, answer!.value, cfg); break;
      case "yes_no":
        item = markYesNo(q, answer!.value, cfg); break;
      case "free_text":
      case "short_text":
      case "paragraph":
        item = markFreeText(q, answer!.value, cfg); break;
      default:
        throw new MarkingValidationError(`Unsupported question type: ${q.type}`, q.id);
    }
    if (item.correct === null && q.points > 0) hasPendingManualReview = true;
    breakdown.push(item);
  }

  const score = breakdown.reduce((s, b) => s + b.awardedPoints, 0);
  const maxScore = breakdown.reduce((s, b) => s + b.maxPoints, 0);
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;
  const threshold = form.passingScore ?? null;
  const passed = threshold !== null ? percentage >= threshold : score >= maxScore && maxScore > 0;

  let status: SubmissionStatus;
  if (form.requireManualReview || hasPendingManualReview) {
    status = "pending_review";
  } else {
    status = passed ? "passed" : "failed";
  }

  return { score, maxScore, percentage, passed: status === "passed" ? passed : passed && status !== "pending_review", status, breakdown };
}
