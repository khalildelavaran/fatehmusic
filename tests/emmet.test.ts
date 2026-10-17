import { describe, expect, it } from "vitest";
import { expandEmmetAbbreviation, formatHtmlSource } from "../src/utils/emmet";

describe("Emmet helpers for the article HTML editor", () => {
  it("expands nested elements, classes, and repeated siblings", () => {
    const html = expandEmmetAbbreviation("ul.nav>li.nav-item$*4>a");
    if (html === null) throw new Error("Emmet abbreviation should expand successfully");

    expect(html).toContain('<ul class="nav">');
    expect(html).toContain('<li class="nav-item1">');
    expect(html).toContain('<li class="nav-item2">');
    expect(html).toContain('<li class="nav-item3">');
    expect(html).toContain('<li class="nav-item4">');
    expect((html.match(/<a><\/a>/g) ?? [])).toHaveLength(4);
  });

  it("supports IDs, quoted attributes, and text content", () => {
    expect(expandEmmetAbbreviation('section.card#intro>h2{عنوان}+a[href="/courses/guitar"]{مشاهده دوره}'))
      .toBe([
        '<section id="intro" class="card">',
        '  <h2>عنوان</h2>',
        '  <a href="/courses/guitar">مشاهده دوره</a>',
        '</section>'
      ].join("\n"));
  });

  it("rejects unsupported or executable element abbreviations", () => {
    expect(expandEmmetAbbreviation("script>alert(1)")).toBeNull();
    expect(expandEmmetAbbreviation("iframe[src=https://bad.example]")).toBeNull();
    expect(expandEmmetAbbreviation("<p>not an abbreviation</p>")).toBeNull();
  });

  it("formats simple nested HTML with indentation", () => {
    const output = formatHtmlSource("<div><p>متن</p><ul><li>اول</li><li>دوم</li></ul></div>");
    expect(output).toContain("<div>");
    expect(output).toContain("  <p>متن</p>");
    expect(output).toContain("    <li>اول</li>");
  });
});
