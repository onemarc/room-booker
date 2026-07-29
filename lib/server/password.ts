import "server-only";

import bcrypt from "bcryptjs";

const PASSWORD_COST = 12;
// Used only to equalize the work of login attempts for unknown email addresses.
const DUMMY_PASSWORD_HASH =
  "$2b$12$.Su13Rgeh99DFxAKSP57cOAsz1NGKoobSgI4/K8ELT.6K.DYn.r7O";

export function hashPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_COST);
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function verifyAgainstDummyPassword(password: string) {
  return bcrypt.compare(password, DUMMY_PASSWORD_HASH);
}
