// Shared types for the BWC Content Engine
export interface Article {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'review' | 'finalized' | 'published';
}
