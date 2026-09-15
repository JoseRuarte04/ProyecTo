export interface PerformanceContextValues {
  context_environmental_factors: string;
  context_personal_factors: string;
  performance_pattern_habits: string;
  performance_pattern_routines: string;
  performance_pattern_roles: string;
  performance_pattern_rituals: string;
  performance_skill_motor: string;
  performance_skill_processing: string;
  performance_skill_social_interaction: string;
  client_factor_values_beliefs_spirituality: string;
  client_factor_body_functions: string;
  client_factor_body_structures: string;
}

export function emptyPerformanceContext(): PerformanceContextValues {
  return {
    context_environmental_factors: "",
    context_personal_factors: "",
    performance_pattern_habits: "",
    performance_pattern_routines: "",
    performance_pattern_roles: "",
    performance_pattern_rituals: "",
    performance_skill_motor: "",
    performance_skill_processing: "",
    performance_skill_social_interaction: "",
    client_factor_values_beliefs_spirituality: "",
    client_factor_body_functions: "",
    client_factor_body_structures: "",
  };
}
