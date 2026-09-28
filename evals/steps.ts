import type { InputType } from '../core/engine.js';

export type StepCase = {
  id: string;
  text: string;
  inputType: InputType;
  inputText: string | null;
  sections: string[];
};

export const cases: StepCase[] = [
  {
    id: 'addition-conversion',
    text: '16 feet plus 100 yards in feet',
    inputType: 'numeric',
    inputText: '16 feet',
    sections: ['plus 100 yards', 'in feet'],
  },
  {
    id: 'subtraction-conversion',
    text: '5 feet minus 6 inches in inches',
    inputType: 'numeric',
    inputText: '5 feet',
    sections: ['minus 6 inches', 'in inches'],
  },
  {
    id: 'mass-conversion',
    text: '2 kilograms plus 500 grams to grams',
    inputType: 'numeric',
    inputText: '2 kilograms',
    sections: ['plus 500 grams', 'to grams'],
  },
  {
    id: 'relative-in-days',
    text: 'in 3 days',
    inputType: 'now',
    inputText: null,
    sections: ['in 3 days'],
  },
  {
    id: 'nested-years',
    text: '3 days after 15 years ago',
    inputType: 'now',
    inputText: null,
    sections: ['3 days after', '15 years ago'],
  },
  {
    id: 'nested-hours',
    text: '2 hours after 1 hour ago',
    inputType: 'now',
    inputText: null,
    sections: ['2 hours after', '1 hour ago'],
  },
  {
    id: 'nested-before',
    text: '6 hours before 2 weeks ago',
    inputType: 'now',
    inputText: null,
    sections: ['6 hours before', '2 weeks ago'],
  },
  {
    id: 'three-operations',
    text: '2 hours after 3 days after 1 week ago',
    inputType: 'now',
    inputText: null,
    sections: ['2 hours after', '3 days after', '1 week ago'],
  },
  {
    id: 'tomorrow',
    text: '1 day after tomorrow',
    inputType: 'tomorrow',
    inputText: 'tomorrow',
    sections: ['1 day after'],
  },
  {
    id: 'yesterday',
    text: '3 days after yesterday',
    inputType: 'yesterday',
    inputText: 'yesterday',
    sections: ['3 days after'],
  },
  {
    id: 'today',
    text: '2 hours after today',
    inputType: 'now',
    inputText: 'today',
    sections: ['2 hours after'],
  },
  {
    id: 'explicit-date',
    text: '3 days after July 4 2027',
    inputType: 'date',
    inputText: 'July 4 2027',
    sections: ['3 days after'],
  },
  {
    id: 'numeric-base',
    text: '3 meters more than 2 miles',
    inputType: 'numeric',
    inputText: '2 miles',
    sections: ['3 meters more than'],
  },
  {
    id: 'volume',
    text: '1 cup in ml',
    inputType: 'implicit_one',
    inputText: '1 cup',
    sections: ['in ml'],
  },
  {
    id: 'implicit-one',
    text: 'a mile in meters',
    inputType: 'implicit_one',
    inputText: 'a mile',
    sections: ['in meters'],
  },
  {
    id: 'now-ms',
    text: 'now in ms',
    inputType: 'now',
    inputText: 'now',
    sections: ['in ms'],
  },
  {
    id: 'no-operations',
    text: 'now',
    inputType: 'now',
    inputText: 'now',
    sections: [],
  },
  {
    id: 'new-minutes',
    text: '45 minutes after 2 hours ago',
    inputType: 'now',
    inputText: null,
    sections: ['45 minutes after', '2 hours ago'],
  },
  {
    id: 'new-weeks',
    text: '4 days before 3 weeks ago',
    inputType: 'now',
    inputText: null,
    sections: ['4 days before', '3 weeks ago'],
  },
  {
    id: 'new-weight',
    text: '2 grams more than 5 kilograms',
    inputType: 'numeric',
    inputText: '5 kilograms',
    sections: ['2 grams more than'],
  },
  {
    id: 'new-today',
    text: 'today in milliseconds',
    inputType: 'now',
    inputText: 'today',
    sections: ['in milliseconds'],
  },
  {
    id: 'uppercase-now',
    text: 'NOW in ms',
    inputType: 'now',
    inputText: 'NOW',
    sections: ['in ms'],
  },
];
