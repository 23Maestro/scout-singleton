export const ASANA_PROJECT_GID = "1208992901563477";

// enum/text CF GIDs in your Asana project
export const CFID_STAGE = "XXXXXXXX_STAGE";         // Video Stage (enum)
export const CFID_STATUS = "XXXXXXXX_STATUS";       // Video Status (enum)
export const CFID_PLAYER_ID = "XXXXXXXX_PLAYERID";  // Player ID (text)
export const CFID_PROFILE_URL = "XXXXXXXX_PROFILE"; // Profile URL (text)
export const CFID_ATHLETE_NAME = "XXXXXXXX_NAME";   // Athlete Name (text)
export const CFID_SPORT = "XXXXXXXX_SPORT";         // Sport (text or enum)
export const CFID_GRAD_YEAR = "XXXXXXXX_GRAD";      // Grad Year (text or number)
export const CFID_CITY = "XXXXXXXX_CITY";           // City (text)
export const CFID_STATE = "XXXXXXXX_STATE";         // State (text)
export const CFID_HIGH_SCHOOL = "XXXXXXXX_HS";      // High School (text)
export const CFID_POSITIONS = "XXXXXXXX_POS";       // Positions (text)
export const CFID_PAYMENT_STATUS = "XXXXXXXX_PAY";  // Payment Status (enum/text)
export const CFID_ASSIGNED_AT = "XXXXXXXX_ASSIGNED";// Assigned Date (date)

// Optional: enum option GIDs for Stage/Status if you want instant updates
export const STAGE_ENUM = {
  "On Hold": "YYYY_STAGE_1",
  "Awaiting Client": "YYYY_STAGE_2",
  "In Queue": "YYYY_STAGE_3",
  "Done": "YYYY_STAGE_4"
} as const;

export const STATUS_ENUM = {
  "Revisions": "YYYY_STATUS_1",
  "HUDL": "YYYY_STATUS_2",
  "Dropbox": "YYYY_STATUS_3",
  "External Links": "YYYY_STATUS_4",
  "Not Approved": "YYYY_STATUS_5"
} as const;
