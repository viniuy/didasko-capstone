export interface Note {
  id: string;
  title: string;
  description: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteCreateInput {
  title: string;
  description?: string | null;
  userId: string;
}

export interface NoteUpdateInput extends NoteCreateInput {
  id: string;
}

export interface NoteResponse {
  notes: Note[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
