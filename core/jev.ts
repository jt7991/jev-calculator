import type { JevClient } from './trace.js';
import {
  TypeSafeClient,
  type Questions,
  type EntryType,
} from '@typesafe-ai/sdk';
import { assessChoice } from './choice.js';
import { attachQuestionPrompts } from './selections.js';

export class Jev {
  constructor(private readonly client: JevClient) {}

  async ask(state: EntryType, questions: Questions) {
    const response = await this.client.systemOne({
      model: process.env.TYPESAFE_MODEL || 'jev-1.13.0',
      state,
      questions,
    });
    attachQuestionPrompts(response.answers, questions);
    return response.answers;
  }

  read(
    answers: Awaited<ReturnType<Jev['ask']>>,
    name: string,
    criteria: Record<string, unknown>,
  ) {
    const answer = answers[name];
    if (
      !answer ||
      answer.type !== 'choice' ||
      !Object.hasOwn(criteria, answer.choice)
    )
      throw new Error(`Invalid ${name} answer.`);
    if (!assessChoice(answer.choice, answer.probabilities).accepted)
      throw new Error(`The ${name} is unclear. Be more specific.`);
    if (answer.choice === 'unsupported')
      throw new Error(`Missing, ambiguous, or unsupported ${name}.`);
    return answer.choice;
  }
}
