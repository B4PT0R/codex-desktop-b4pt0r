import type {
  AppServerPlugin,
  PluginInstalledResponse,
} from "./appServerTypes";

export function normalizeInstalledPlugins(
  response: PluginInstalledResponse,
): AppServerPlugin[] {
  if (!Array.isArray(response.marketplaces)) return [];
  return response.marketplaces.flatMap((marketplace) => {
    if (!marketplace || !Array.isArray(marketplace.plugins)) return [];
    const marketplaceName = boundedString(marketplace.name, 512) ?? "unknown";
    const marketplaceDisplayName = boundedString(
      marketplace.interface?.displayName,
      512,
    );
    return marketplace.plugins.flatMap((plugin) => {
      if (
        !plugin ||
        typeof plugin.id !== "string" ||
        typeof plugin.name !== "string" ||
        plugin.installed !== true ||
        typeof plugin.enabled !== "boolean"
      ) return [];
      const localVersion = boundedString(plugin.localVersion, 128);
      const version = boundedString(plugin.version, 128);
      const displayName = boundedString(plugin.interface?.displayName, 512);
      const description = boundedString(
        plugin.interface?.shortDescription,
        2_000,
      );
      return [{
        id: plugin.id.slice(0, 1_000),
        name: plugin.name.slice(0, 512),
        marketplaceName,
        ...(marketplaceDisplayName ? { marketplaceDisplayName } : {}),
        installed: true,
        enabled: plugin.enabled,
        availability: plugin.availability === "DISABLED_BY_ADMIN"
          ? "DISABLED_BY_ADMIN" as const
          : "AVAILABLE" as const,
        ...(localVersion ? { localVersion } : {}),
        ...(version ? { version } : {}),
        ...(displayName ? { displayName } : {}),
        ...(description ? { description } : {}),
      }];
    });
  });
}

export function pluginMarketplaceErrorCount(response: PluginInstalledResponse) {
  return Array.isArray(response.marketplaceLoadErrors)
    ? response.marketplaceLoadErrors.filter(
        (error) => error && typeof error.message === "string",
      ).length
    : 0;
}

function boundedString(value: unknown, limit: number) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, limit)
    : undefined;
}
