export type AppPhase =
  | "booting"
  | "landing"
  | "auth"
  | "registration"
  | "waiting"
  | "pair"
  | "decision"
  | "result"
  | "ended";

export type MobileUser = {
  id: string;
  email: string;
  lineLinked: boolean;
  lineFollowed: boolean;
  instagramHandle: string | null;
  lineContact: string | null;
};

export type LineStatus = {
  linked: boolean;
  followed: boolean;
  officialAccountUrl: string | null;
};

export type EventRegistration = {
  status: "waiting" | "cancelled";
  lineStatus: "not_registered" | "registered";
  nickname: string | null;
  faculty: string | null;
  academicYear: string | null;
  gender: string | null;
  purpose: "friend" | "romance" | "either";
  preferredGender: "any" | "male" | "female" | "other";
  ageConfirmed: boolean;
  rulesAccepted: boolean;
};

export type EventState = {
  kind?: "weekly" | "extension";
  matchingStatus?: "scheduled" | "processing" | "matched" | "unmatched" | "ended";
  endsAt?: string;
  eventKey: string;
  registration: EventRegistration | null;
  previousRegistration?: EventRegistration | null;
  count: number;
  capacity: number;
  remaining: number;
  updatedAt: string;
  startsAt: string;
  registrationClosesAt: string;
  decisionOpensAt: string;
  registrationOpen: boolean;
  canCancel: boolean;
  decisionOpen: boolean;
};

export type DecisionOption = "instagram" | "line" | "continue" | "none";

export type PairDecision = {
  instagram: boolean;
  line: boolean;
  continue: boolean;
  none: boolean;
  answered: boolean;
};

export type PairResult = {
  kind: "pending" | "disclosed" | "continued" | "ended";
  items: DecisionOption[];
  contacts: { instagram?: string; line?: string } | null;
};

export type RemotePair = {
  kind?: "weekly" | "extension";
  endsAt?: string;
  invite?: { status: "waiting" | "ready"; canEdit: boolean; suggestedCreator: boolean; joined: boolean };
  extension?: { eventKey: string; startsAt: string; status: string; canCancel: boolean } | null;
  id: string;
  eventKey: string;
  startsAt: string;
  decisionOpensAt: string;
  decisionOpen: boolean;
  status: "published";
  setlogUrl: string | null;
  setlogCode: string | null;
  candidate: {
    id: string;
    nickname: string;
    faculty: string;
    academicYear: string;
    gender: string;
  };
  decision: PairDecision | null;
  partnerAnswered: boolean;
  result: PairResult | null;
};

export type RegistrationInput = {
  profile: {
    nickname: string;
    faculty: string;
    academicYear: string;
    gender: string;
  };
  preferences: {
    purpose: "friend" | "romance" | "either";
    preferredGender: "any" | "male" | "female" | "other";
  };
  contacts: {
    instagramHandle: string | null;
    lineContact: string | null;
  };
  ageConfirmed: boolean;
  rulesAccepted: boolean;
};
