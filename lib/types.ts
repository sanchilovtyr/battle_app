export type BusinessType =
  | "retail"
  | "services"
  | "horeca"
  | "b2b"
  | "online_edu"
  | "ecommerce"
  | "other";

export type Budget = "under20" | "20to100" | "100to500" | "over500";

export type Goal = "awareness" | "leads" | "sales_online" | "repeat_sales";

export type Geo = "local" | "regional" | "national";

export type Experience = "beginner" | "middle" | "advanced";

export interface Answers {
  businessType: BusinessType;
  hasSite: boolean;
  hasSocial: boolean;
  budget: Budget;
  goal: Goal;
  geo: Geo;
  experience: Experience;
}

export type Phase = "foundation" | "traffic" | "retention";

export interface PlanModule {
  id: string;
  title: string;
  phase: Phase;
  minBudget: Budget; // минимальный бюджет, при котором модуль реалистичен
  why: (a: Answers) => string;
  steps: string[];
  timeToResult: string; // "2-4 недели" и т.п.
  score: (a: Answers) => number;
}

export interface PlanEntry {
  module: PlanModule;
  score: number;
  reason: string;
}

export interface GeneratedPlan {
  answers: Answers;
  foundation: PlanEntry[];
  traffic: PlanEntry[];
  retention: PlanEntry[];
  summary: string;
}
