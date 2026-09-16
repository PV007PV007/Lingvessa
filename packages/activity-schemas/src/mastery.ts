export const skillFacetMatrix = {
  vocabulary: ['recognition', 'meaning', 'recall_l2_to_l1', 'recall_l1_to_l2', 'production', 'spelling', 'context_use', 'collocation', 'variant_awareness', 'register'],
  grammar: ['grammar_form', 'morphology', 'word_order', 'register', 'context_use'],
  listening: ['listening_recognition', 'listening_gist', 'listening_detail', 'meaning'],
  speaking: ['production', 'context_use', 'register', 'interaction_repair', 'interaction_goal', 'intelligibility'],
  writing: ['production', 'spelling', 'orthography', 'grammar_form', 'context_use', 'register'],
  pronunciation: ['pronunciation_target', 'intelligibility'],
} as const;

export type Skill = keyof typeof skillFacetMatrix;

export function isSkillFacet(skill: string, facet: string): boolean {
  return Object.entries(skillFacetMatrix).some(([key, facets]) => key === skill && (facets as readonly string[]).includes(facet));
}
