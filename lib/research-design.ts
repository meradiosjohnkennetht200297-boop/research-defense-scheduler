export const RESEARCH_DESIGN_OPTIONS = [
  { value: 'descriptive', label: 'Descriptive / Non-Experimental' },
  { value: 'experimental', label: 'Experimental / Quasi-Experimental' },
  { value: 'developmental', label: 'Developmental / Research and Development' },
  { value: 'qualitative', label: 'Qualitative' },
  { value: 'mixed_methods', label: 'Mixed Methods' },
  { value: 'other', label: 'Other' },
] as const

export type ResearchDesign = (typeof RESEARCH_DESIGN_OPTIONS)[number]['value']

export const RESEARCH_DESIGN_VALUES = new Set<string>(RESEARCH_DESIGN_OPTIONS.map((option) => option.value))

export function researchDesignLabel(value: string | null | undefined, other?: string | null) {
  if (!value) return 'Not specified'
  if (value === 'other') return other?.trim() || 'Other'
  return RESEARCH_DESIGN_OPTIONS.find((option) => option.value === value)?.label ?? 'Not specified'
}
