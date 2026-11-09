export type PageLayout = {
  page: number;
  questionNumbers: number[];
  images: string[];
};

export type ExtractedDocument = {
  text: string;
  pages: PageLayout[];
};

export type GenerateRequest = {
  pastPaperText: string;
  solutionText?: string;
  subject?: string;
  academicLevel?: string;
  extraInstructions?: string;
  pageLayout?: Array<{ page: number; questionNumbers: number[]; figureCount?: number }>;
};

export type ParsedOutput = {
  pastPaper: string;
  suggestedSolution: string;
  markingScheme: string;
  raw: string;
};
