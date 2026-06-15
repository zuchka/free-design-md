// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ArtifactActions from "./ArtifactActions";

describe("ArtifactActions", () => {
  it("shows MDX as a save option when an MDX artifact is available", async () => {
    render(
      <ArtifactActions
        markdown="# Design"
        html="<html></html>"
        mdx="export const designMd = '# Design';"
        baseFilename="Example"
      />,
    );

    fireEvent.pointerDown(screen.getByLabelText("Save artifact"));

    expect(await screen.findByText("Save markdown")).toBeTruthy();
    expect(await screen.findByText("Save HTML")).toBeTruthy();
    expect(await screen.findByText("Save MDX")).toBeTruthy();
  });
});
