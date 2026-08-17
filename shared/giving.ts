export const GIVING_PURPOSES = [
  { value: "tithe", label: "Tithe", accountCode: "TITHE" },
  { value: "offering", label: "Offering", accountCode: "OFFER" },
  { value: "thanksgiving", label: "Thanksgiving", accountCode: "THANKS" },
  {
    value: "special_sacrifice",
    label: "Special Sacrifice",
    accountCode: "SACRIFICE",
  },
  { value: "pledge", label: "Pledge", accountCode: "PLEDGE" },
  {
    value: "project_support",
    label: "Project Support",
    accountCode: "PROJ",
  },
  { value: "building_fund", label: "Building Fund", accountCode: "BUILD" },
  {
    value: "missions_evangelism",
    label: "Missions & Evangelism",
    accountCode: "MISSIONS",
  },
  {
    value: "church_outreach",
    label: "Church Outreach",
    accountCode: "OUTREACH",
  },
  {
    value: "welfare_benevolence",
    label: "Welfare & Benevolence",
    accountCode: "WELFARE",
  },
  { value: "youth_ministry", label: "Youth Ministry", accountCode: "YOUTH" },
  {
    value: "children_ministry",
    label: "Children's Ministry",
    accountCode: "CHILDREN",
  },
  {
    value: "women_ministry",
    label: "Women's Ministry",
    accountCode: "WOMEN",
  },
  { value: "men_ministry", label: "Men's Ministry", accountCode: "MEN" },
  {
    value: "choir_worship",
    label: "Choir & Worship",
    accountCode: "CHOIR",
  },
  {
    value: "media_technology",
    label: "Media & Technology",
    accountCode: "MEDIA",
  },
  {
    value: "conference_event",
    label: "Conference or Event",
    accountCode: "EVENT",
  },
  {
    value: "prayer_care_support",
    label: "Prayer & Care Support",
    accountCode: "PRAYER",
  },
  {
    value: "general_donation",
    label: "General Donation",
    accountCode: "GENERAL",
  },
  { value: "other", label: "Other", accountCode: "OTHER" },
] as const;

export type GivingPurpose = (typeof GIVING_PURPOSES)[number]["value"];
export const GIVING_PURPOSE_VALUES = GIVING_PURPOSES.map(
  purpose => purpose.value
) as [GivingPurpose, ...GivingPurpose[]];

export const GIVING_PROJECTS = [
  {
    value: "community_water",
    label: "Community Water Project",
    accountCode: "WATER",
  },
  {
    value: "student_support",
    label: "Student Support Project",
    accountCode: "STUDENT",
  },
  {
    value: "healthcare_ministry",
    label: "Healthcare Ministry Project",
    accountCode: "HEALTH",
  },
  {
    value: "skills_training",
    label: "Skills Training Project",
    accountCode: "SKILLS",
  },
  {
    value: "church_building",
    label: "Church Building Campaign",
    accountCode: "BUILDING",
  },
  {
    value: "outreach_programme",
    label: "Community Outreach Programme",
    accountCode: "OUTREACH",
  },
] as const;

export type GivingProject = (typeof GIVING_PROJECTS)[number]["value"];
export const GIVING_PROJECT_VALUES = GIVING_PROJECTS.map(
  project => project.value
) as [GivingProject, ...GivingProject[]];

export function getGivingPurpose(value: GivingPurpose) {
  return GIVING_PURPOSES.find(purpose => purpose.value === value)!;
}

export function getGivingProject(value: GivingProject) {
  return GIVING_PROJECTS.find(project => project.value === value)!;
}

export function buildGivingDescription(input: {
  purpose: GivingPurpose;
  project?: GivingProject;
  otherDescription?: string;
  pledgeReference?: string;
}) {
  const purposeLabel = getGivingPurpose(input.purpose).label;
  const projectLabel = input.project
    ? ` — ${getGivingProject(input.project).label}`
    : "";
  const detail =
    input.otherDescription?.trim() || input.pledgeReference?.trim();
  return `${purposeLabel}${projectLabel}${detail ? ` (${detail})` : ""}`.slice(
    0,
    200
  );
}

export function buildMpesaAccountReference(input: {
  purpose: GivingPurpose;
  project?: GivingProject;
}) {
  const purposeCode = getGivingPurpose(input.purpose).accountCode;
  const projectCode = input.project
    ? getGivingProject(input.project).accountCode
    : undefined;
  return `${purposeCode}${projectCode ? `-${projectCode}` : ""}`
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 12);
}
