import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hydrateRealtimeParents,
  mergeRememberedRealtimeParents,
  rememberRealtimeParentThread,
} from "../../src/lib/realtimeParentCatalog";
import { request } from "../../src/lib/codex";
import {
  readDesktopSettingsSnapshot,
  updateDesktopSettings,
} from "../../src/lib/desktopSettings";

vi.mock("../../src/lib/codex", () => ({ request: vi.fn() }));
vi.mock("../../src/lib/desktopSettings", () => ({
  readDesktopSettingsSnapshot: vi.fn(),
  updateDesktopSettings: vi.fn(),
}));

describe("catalogue temporaire des parents Realtime", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mémorise le parent une seule fois en tête de liste", async () => {
    vi.mocked(readDesktopSettingsSnapshot).mockResolvedValue({
      version: 1,
      realtimeParentThreadIds: ["older", "parent"],
    });
    vi.mocked(updateDesktopSettings).mockResolvedValue({ version: 1 });

    await rememberRealtimeParentThread("parent");

    expect(updateDesktopSettings).toHaveBeenCalledWith({
      realtimeParentThreadIds: ["parent", "older"],
    });
  });

  it("restaure les métadonnées lisibles sans échouer sur un parent supprimé", async () => {
    vi.mocked(request)
      .mockResolvedValueOnce({
        thread: {
          id: "parent",
          cwd: "/home/user/Documents/Codex/2026-08-09-discussion",
        },
      })
      .mockRejectedValueOnce(new Error("missing"));

    await expect(hydrateRealtimeParents(["parent", "deleted"])).resolves.toEqual([
      expect.objectContaining({ id: "parent", kind: "discussion" }),
    ]);
  });

  it("préserve un parent absent de thread/list sans dupliquer les autres", () => {
    const merged = mergeRememberedRealtimeParents(
      [{ id: "project", cwd: "/work/project" }],
      [
        { id: "parent", kind: "discussion" },
        { id: "project", cwd: "/work/project", name: "stale" },
      ],
      new Set(["parent"]),
    );

    expect(merged.map((thread) => thread.id)).toEqual(["parent", "project"]);
  });
});
