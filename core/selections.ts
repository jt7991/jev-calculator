import type { ChoiceResponse, Questions } from '@typesafe-ai/sdk';

// Carry each question beside its answer for the explanation UI. Never re-ask it.
export function attachQuestionPrompts(
  answers: Record<string, object>,
  questions: Questions,
) {
  for (const name of Object.keys(answers)) {
    Object.assign(answers[name], { prompt: questions[name]?.instructions });
  }
}

export type Selection = {
  label: string;
  value: string;
  source?: string;
  prompt?: string;
  callId?: number;
  probability?: number;
  confidence?: number;
  options?: {
    value: string;
    description?: string;
    probability: number;
    selected: boolean;
  }[];
};

// Keep the original distribution. Display code never invents a confidence score.
export function choiceSelection(
  label: string,
  answer: ChoiceResponse & { prompt?: unknown; callId?: number },
  criteria: Record<string, unknown>,
): Selection {
  const options: NonNullable<Selection['options']> = [];
  for (const value of Object.keys(criteria)) {
    const description = criteria[value];
    options.push({
      value,
      description:
        typeof description === 'string' && description !== value
          ? description
          : undefined,
      probability: answer.probabilities[value] ?? 0,
      selected: value === answer.choice,
    });
  }
  options.sort((a, b) => b.probability - a.probability);
  return {
    label,
    callId: answer.callId,
    prompt:
      typeof answer.prompt === 'string'
        ? answer.prompt
        : answer.prompt === undefined
          ? undefined
          : JSON.stringify(answer.prompt, null, 2),
    confidence: answer.confidence,
    value: answer.choice,
    probability: answer.probabilities[answer.choice],
    options,
  };
}
