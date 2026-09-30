import { prisma } from "./db";
import { buildEffectiveModules, ModuleOverride, CustomModuleData } from "./adminModules";
import { generatePlan } from "./ruleEngine";
import { Answers, BusinessType, GeneratedPlan, Phase } from "./types";

interface ModuleOverrideRow {
  moduleId: string;
  title: string;
  why: string;
  timeToResult: string;
  steps: unknown;
}

interface CustomModuleRow {
  id: string;
  title: string;
  phase: string;
  timeToResult: string;
  why: string;
  steps: unknown;
  score: number;
  businessTypes: unknown;
}

export async function generatePlanForAnswers(answers: Answers): Promise<GeneratedPlan> {
  const [overrideRows, customRows] = await Promise.all([
    prisma.moduleOverride.findMany() as unknown as Promise<ModuleOverrideRow[]>,
    prisma.customModule.findMany() as unknown as Promise<CustomModuleRow[]>,
  ]);

  const overrides: Record<string, ModuleOverride> = {};
  for (const row of overrideRows) {
    overrides[row.moduleId] = {
      title: row.title,
      why: row.why,
      timeToResult: row.timeToResult,
      steps: (row.steps as string[]) ?? [],
    };
  }

  const customModules: CustomModuleData[] = customRows.map((r) => ({
    id: r.id,
    title: r.title,
    phase: r.phase as Phase,
    timeToResult: r.timeToResult,
    why: r.why,
    steps: (r.steps as string[]) ?? [],
    score: r.score,
    businessTypes: (r.businessTypes as BusinessType[]) ?? [],
  }));

  const modules = buildEffectiveModules(overrides, customModules);
  return generatePlan(modules, answers);
}
