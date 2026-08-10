import { emptyDecision, hasDecision, toggleDecision } from "@/lib/decision";

describe("非公開判定", () => {
  test("Instagram・LINE・もう一日を複数選択できる", () => {
    const withInstagram = toggleDecision(emptyDecision, "instagram");
    const withLine = toggleDecision(withInstagram, "line");
    const withContinue = toggleDecision(withLine, "continue");

    expect(withContinue).toMatchObject({ instagram: true, line: true, continue: true, none: false });
    expect(hasDecision(withContinue)).toBe(true);
  });

  test("何も教えないは他の選択肢と排他的になる", () => {
    const selected = toggleDecision(toggleDecision(emptyDecision, "instagram"), "none");
    expect(selected).toEqual({ ...emptyDecision, none: true });

    const changed = toggleDecision(selected, "continue");
    expect(changed).toMatchObject({ instagram: false, line: false, continue: true, none: false });
  });
});
