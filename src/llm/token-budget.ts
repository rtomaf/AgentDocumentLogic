export interface BudgetAllocation {
  systemPromptBudget: number;
  overlapBudget: number;
  sectionContentBudget: number;
  outputBudget: number;
}

export function allocateBudget(totalBudget: number, overlapTokens: number): BudgetAllocation {
  const systemPromptBudget = 500;
  const overlapBudget = overlapTokens * 2;
  const outputBudget = Math.min(16384, Math.floor(totalBudget * 0.3));
  const sectionContentBudget = totalBudget - systemPromptBudget - overlapBudget - outputBudget;

  return { systemPromptBudget, overlapBudget, sectionContentBudget, outputBudget };
}

export function canFitInBudget(
  sectionTokens: number,
  overlapTokens: number,
  totalBudget: number,
): boolean {
  const allocation = allocateBudget(totalBudget, overlapTokens);
  return sectionTokens <= allocation.sectionContentBudget;
}
