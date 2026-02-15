"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Button from "@/components/button";
import { toast } from "react-hot-toast";
import clsx from "clsx";

interface ExternalServicesProps {
  triggerToast?: typeof toast;
}

const ExternalServices: React.FC<ExternalServicesProps> & { title: string } = ({
  triggerToast = toast,
}) => {
  const router = useRouter();
  const { id: workspaceId } = router.query;

  const [rankingProvider, setRankingProvider] = useState<string>("");
  const [rankingToken, setRankingToken] = useState<string>("");
  const [rankingWorkspaceId, setRankingWorkspaceId] = useState<string>("");
  const [robloxApiKey, setRobloxApiKey] = useState<string>("");
  const [robloxApiKeyStatus, setRobloxApiKeyStatus] = useState<"untested" | "testing" | "valid" | "invalid">("untested");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;

    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/workspace/${workspaceId}/settings/external`
        );
        if (response.ok) {
          const data = await response.json();
          setRankingProvider(data.rankingProvider || "");
          setRankingToken(data.rankingToken || "");
          setRankingWorkspaceId(data.rankingWorkspaceId || "");
          setRobloxApiKey(data.robloxApiKey || "");
          if (data.robloxApiKey) setRobloxApiKeyStatus("valid");
        }
      } catch (error) {
        console.error("Failed to fetch external services settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [workspaceId]);

  const handleSave = async () => {
    if (!workspaceId) return;

    if (
      rankingProvider === "rankgun" &&
      (!rankingToken.trim() || !rankingWorkspaceId.trim())
    ) {
      triggerToast.error("RankGun requires both API key and workspace ID");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/workspace/${workspaceId}/settings/external`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rankingProvider,
            rankingToken,
            rankingWorkspaceId,
            robloxApiKey: robloxApiKey || null,
          }),
        }
      );

      if (response.ok) {
        triggerToast.success("External services settings saved successfully!");
      } else {
        const error = await response.json();
        triggerToast.error(error.message || "Failed to save settings");
      }
    } catch (error) {
      triggerToast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleProviderChange = (newProvider: string) => {
    setRankingProvider(newProvider);
    if (newProvider === "" || newProvider !== rankingProvider) {
      setRankingToken("");
      setRankingWorkspaceId("");
    }
  };

  const rankingProviders = [
    { value: "", label: "None" },
    { value: "rankgun", label: "RankGun" },
    { value: "roblox_cloud", label: "Roblox Open Cloud" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-4">
          Ranking Services
        </h4>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          Configure external ranking services for intergrated promotions and
          demotions.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Ranking Provider
            </label>
            <select
              value={rankingProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
              disabled={isLoading}
              className={clsx(
                "w-full px-3 py-2 border rounded-lg text-sm",
                "bg-white dark:bg-zinc-800",
                "border-zinc-300 dark:border-zinc-600",
                "text-zinc-900 dark:text-white",
                "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {rankingProviders.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </select>
          </div>

          {rankingProvider && rankingProvider !== "" && rankingProvider !== "roblox_cloud" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  API Key for{" "}
                  {
                    rankingProviders.find((p) => p.value === rankingProvider)
                      ?.label
                  }
                </label>
                <input
                  type="password"
                  value={rankingToken}
                  onChange={(e) => setRankingToken(e.target.value)}
                  placeholder={`Enter your ${
                    rankingProviders.find((p) => p.value === rankingProvider)
                      ?.label
                  } API key`}
                  disabled={isLoading}
                  className={clsx(
                    "w-full px-3 py-2 border rounded-lg text-sm",
                    "bg-white dark:bg-zinc-800",
                    "border-zinc-300 dark:border-zinc-600",
                    "text-zinc-900 dark:text-white",
                    "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  This API key will be securely stored and used for API requests
                  to{" "}
                  {
                    rankingProviders.find((p) => p.value === rankingProvider)
                      ?.label
                  }
                  .
                </p>
              </div>

              {rankingProvider === "rankgun" && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    RankGun Workspace ID
                  </label>
                  <input
                    type="text"
                    value={rankingWorkspaceId}
                    onChange={(e) => setRankingWorkspaceId(e.target.value)}
                    placeholder="Enter your RankGun workspace ID"
                    disabled={isLoading}
                    className={clsx(
                      "w-full px-3 py-2 border rounded-lg text-sm",
                      "bg-white dark:bg-zinc-800",
                      "border-zinc-300 dark:border-zinc-600",
                      "text-zinc-900 dark:text-white",
                      "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Your RankGun workspace ID is required for API
                    authentication.
                  </p>
                </div>
              )}
            </div>
          )}

          {rankingProvider === "roblox_cloud" && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Roblox Open Cloud ranking uses the API key configured below. Make sure your API key has both{" "}
                <strong>Group read</strong> and <strong>write</strong> permissions to allow promotions, demotions, and rank changes.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="pt-6 border-t border-zinc-200 dark:border-zinc-700">
        <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-4">
          Roblox Open Cloud API Key
        </h4>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          <strong>Required</strong> for syncing group members.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={robloxApiKey}
                onChange={(e) => {
                  setRobloxApiKey(e.target.value);
                  setRobloxApiKeyStatus("untested");
                }}
                placeholder="Enter your Roblox Open Cloud API key"
                disabled={isLoading}
                className={clsx(
                  "flex-1 px-3 py-2 border rounded-lg text-sm",
                  "bg-white dark:bg-zinc-800",
                  "border-zinc-300 dark:border-zinc-600",
                  "text-zinc-900 dark:text-white",
                  "focus:ring-2 focus:ring-primary/20 focus:border-primary",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              />
              <button
                onClick={async () => {
                  if (!robloxApiKey.trim() || !workspaceId) return;
                  setRobloxApiKeyStatus("testing");
                  try {
                    const response = await fetch(
                      `/api/workspace/${workspaceId}/settings/external/test-roblox-key`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ apiKey: robloxApiKey }),
                      }
                    );
                    const data = await response.json();
                    if (response.ok && data.valid) {
                      setRobloxApiKeyStatus("valid");
                      triggerToast.success(
                        `API key valid! Found ${data.memberCount} members in the group.`
                      );
                    } else {
                      setRobloxApiKeyStatus("invalid");
                      triggerToast.error(data.message || "API key is invalid or lacks group read permissions.");
                    }
                  } catch {
                    setRobloxApiKeyStatus("invalid");
                    triggerToast.error("Failed to test API key");
                  }
                }}
                disabled={isLoading || !robloxApiKey.trim() || robloxApiKeyStatus === "testing"}
                className={clsx(
                  "px-4 py-2 text-sm font-medium rounded-lg border",
                  "transition-colors duration-150",
                  robloxApiKeyStatus === "valid"
                    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700"
                    : robloxApiKeyStatus === "invalid"
                    ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700"
                    : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {robloxApiKeyStatus === "testing"
                  ? "Testing..."
                  : robloxApiKeyStatus === "valid"
                  ? "✓ Valid"
                  : robloxApiKeyStatus === "invalid"
                  ? "✗ Invalid"
                  : "Test Key"}
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
              Your API key needs the <strong>group-membership:read</strong> permission for your group.
              Go to{" "}
              <a
                href="https://create.roblox.com/dashboard/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Creator Hub → Credentials
              </a>
              , create an API key, add the <strong>Group</strong> API system, select your group,
              and enable <strong>Read</strong> access.
            </p>
          </div>

          {robloxApiKey && robloxApiKeyStatus === "valid" && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-green-700 dark:text-green-400">
                Roblox API key connected!
              </span>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
        Need a hand? Check our documentation at{' '}
        <a href="https://docs.firefli.net/workspace/external" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
          docs.firefli.net
        </a>
      </p>

      <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-700">
        <Button onClick={handleSave} disabled={isSaving || isLoading}>
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
};

ExternalServices.title = "External Services";

export default ExternalServices;
