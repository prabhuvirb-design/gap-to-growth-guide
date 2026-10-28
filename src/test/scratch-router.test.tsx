import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

describe("scratch", () => {
  it("shows what a router instance offers and what renders", async () => {
    const queryClient = new QueryClient();
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/"] }),
      context: { queryClient },
    });
    const proto = Object.getPrototypeOf(router);
    console.log(
      "METHODS:",
      Object.getOwnPropertyNames(proto).filter((k) => typeof (router as any)[k] === "function").join(","),
    );
    render(<RouterProvider router={router} />);
    await new Promise((r) => setTimeout(r, 100));
    console.log("BODY:", document.body.innerHTML.slice(0, 300));
    expect(true).toBe(true);
  });
});
