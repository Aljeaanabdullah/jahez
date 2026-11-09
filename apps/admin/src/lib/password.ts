// Password rules, identical to the change-password Edge Function and the mobile app:
// at least 8 characters, with letters and digits, and not containing the file number.
export function passwordProblem(password: string, fileNumber: number): string | null {
  if (password.length < 8) return "too_short";
  if (password.length > 72) return "too_long";
  if (!/\p{L}/u.test(password)) return "needs_letter";
  if (!/\p{Nd}/u.test(password)) return "needs_digit";
  if (password.includes(String(fileNumber))) return "contains_file_number";
  return null;
}
