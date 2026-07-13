export type VerificationStatus =
  | "FAILED"
  | "EXECUTED"
  | "VERIFIED"
  | "TESTED"
  | "CERTIFIED";

export type VerificationCheck = {
  name: string;
  passed: boolean;
  message?: string;
};

export type VerificationResult = {
  status: VerificationStatus;
  checks: VerificationCheck[];
  messages: string[];
};
