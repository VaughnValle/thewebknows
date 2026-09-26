import type { ChecklistQuestionId } from '../types';
import type { FieldCategory } from '../checks';

export interface ChecklistQuestion {
  id: ChecklistQuestionId;
  question: string;
  /** Label used in the report's field list. */
  field: string;
  /** API observation categories that speak to this question. */
  apiCategories: FieldCategory[];
}

/** Yes/no observations only — the app never asks for the actual value. */
export const CHECKLIST: ChecklistQuestion[] = [
  { id: 'name', question: 'Does your public profile show your full name?', field: 'Name', apiCategories: ['name'] },
  {
    id: 'affiliation',
    question: 'Does it show your school, workplace, or location?',
    field: 'School, workplace or location',
    apiCategories: ['affiliation'],
  },
  { id: 'contact', question: 'Is a personal email or phone number visible?', field: 'Email or phone', apiCategories: ['contact'] },
  { id: 'linked', question: 'Does it link to another personal account or website?', field: 'Links to other accounts', apiCategories: ['linked'] },
  { id: 'oldPosts', question: 'Are there old posts or photos you want to review?', field: 'Old posts or photos to review', apiCategories: [] },
];
