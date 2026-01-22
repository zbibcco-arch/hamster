
export type ContentCategory = 'QUOTES' | 'SELF_IMPROVEMENT';
export type VisualMode = 'REALISTIC' | 'ANIMATION' | 'OIL_PAINTING' | 'ORIENTAL_PAINTING';

export interface VisualScene {
  sceneNumber: number;
  description: string;
  prompt: string;
}

export interface ShortsConcept {
  id: string;
  title: string;
  hook: string;
  detailedScript: string;
  visualScenes: VisualScene[];
  visualStyle: string;
  targetAudience: string;
  personalizedReason: string;
}

export interface RecommendationResponse {
  concepts: ShortsConcept[];
}

export interface GeneratedImage {
  url: string;
  conceptId: string;
}
