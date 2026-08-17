import { describe, expect, it } from "vitest";
import {
  buildGivingDescription,
  buildMpesaAccountReference,
} from "../shared/giving";

describe("giving purpose mapping", () => {
  it("maps ordinary giving to a compact PayBill account reference", () => {
    expect(buildMpesaAccountReference({ purpose: "tithe" })).toBe("TITHE");
    expect(buildGivingDescription({ purpose: "tithe" })).toBe("Tithe");
  });

  it("includes the selected project in the PayBill account reference", () => {
    expect(
      buildMpesaAccountReference({
        purpose: "project_support",
        project: "community_water",
      })
    ).toBe("PROJ-WATER");
    expect(
      buildGivingDescription({
        purpose: "project_support",
        project: "community_water",
      })
    ).toBe("Project Support — Community Water Project");
  });

  it("keeps optional pledge and other details out of the account reference", () => {
    expect(
      buildMpesaAccountReference({
        purpose: "other",
      })
    ).toBe("OTHER");
    expect(
      buildGivingDescription({
        purpose: "other",
        otherDescription: "Community medical outreach",
      })
    ).toBe("Other (Community medical outreach)");
  });
});
