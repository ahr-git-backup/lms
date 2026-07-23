// Guest identity for anonymous (login-free) Free Exam attempts.
// Collected once via GuestExamInfoDialog, then kept in sessionStorage so the
// visitor doesn't have to re-type it on every free exam within the same
// browser session.

export interface GuestExamInfo {
  name: string;
  hscBatch: string;
  collegeName: string;
  phone: string;
}

const KEY = "freeExamGuestInfo";

export function getGuestInfo(): GuestExamInfo | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GuestExamInfo) : null;
  } catch {
    return null;
  }
}

export function setGuestInfo(info: GuestExamInfo) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(info));
  } catch {
    // ignore — worst case, dialog asks again next time
  }
}
