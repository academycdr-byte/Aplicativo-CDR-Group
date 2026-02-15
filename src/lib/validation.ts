export type ValidationResult = {
  valid: boolean;
  errors: Record<string, string>;
};

export function validateEmail(email: string): string | null {
  if (!email || email.trim().length === 0) {
    return "Email é obrigatório.";
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Email inválido.";
  }
  if (email.length > 255) {
    return "Email muito longo (máximo 255 caracteres).";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password || password.length === 0) {
    return "Senha é obrigatória.";
  }
  if (password.length < 6) {
    return "Senha deve ter pelo menos 6 caracteres.";
  }
  if (password.length > 128) {
    return "Senha muito longa (máximo 128 caracteres).";
  }
  return null;
}

export function validateName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return "Nome é obrigatório.";
  }
  if (name.trim().length < 2) {
    return "Nome deve ter pelo menos 2 caracteres.";
  }
  if (name.length > 100) {
    return "Nome muito longo (máximo 100 caracteres).";
  }
  return null;
}

export function validateApiKey(apiKey: string): string | null {
  if (!apiKey || apiKey.trim().length === 0) {
    return "API Key é obrigatória.";
  }
  if (apiKey.length < 10) {
    return "API Key parece inválida (muito curta).";
  }
  if (apiKey.length > 500) {
    return "API Key muito longa (máximo 500 caracteres).";
  }
  // Check for obviously invalid characters
  if (/[\s<>]/.test(apiKey)) {
    return "API Key contém caracteres inválidos.";
  }
  return null;
}

export function validateLoginForm(data: { email: string; password: string }): ValidationResult {
  const errors: Record<string, string> = {};

  const emailError = validateEmail(data.email);
  if (emailError) errors.email = emailError;

  const passwordError = validatePassword(data.password);
  if (passwordError) errors.password = passwordError;

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateRegisterForm(data: {
  name: string;
  email: string;
  password: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  const nameError = validateName(data.name);
  if (nameError) errors.name = nameError;

  const emailError = validateEmail(data.email);
  if (emailError) errors.email = emailError;

  const passwordError = validatePassword(data.password);
  if (passwordError) errors.password = passwordError;

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateSlug(slug: string): string | null {
  if (!slug || slug.trim().length === 0) {
    return "Slug é obrigatório.";
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return "Slug deve conter apenas letras minúsculas, números e hifens.";
  }
  if (slug.length < 3) {
    return "Slug deve ter pelo menos 3 caracteres.";
  }
  if (slug.length > 50) {
    return "Slug muito longo (máximo 50 caracteres).";
  }
  return null;
}
