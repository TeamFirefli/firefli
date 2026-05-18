"use client";

import type React from "react";

import "@/styles/tailwind.css";
import "@/styles/globals.scss";
import "@/styles/grid-layout.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { AppProps } from "next/app";
import { workspacestate } from "@/state";
import { RecoilRoot, useRecoilState, useRecoilValue } from "recoil";
import type { pageWithLayout } from "@/layoutTypes";
import { useEffect, useState, useRef } from "react";
import Head from "next/head";
import Router from "next/router";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
} from "chart.js";
import { themeState } from "@/state/theme";
import AuthProvider from "./AuthProvider";
import HelpWidget from "@/components/helpwidget";
import axios from "axios";
import { loginState } from "@/state";
import { SWRConfig } from 'swr';
import { swrConfig } from '@/lib/swr-config';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST;
const POSTHOG_API = process.env.NEXT_PUBLIC_POSTHOG_API;
const INTERCOM_APP_ID = process.env.NEXT_PUBLIC_INTERCOM_APP_ID;

type AppPropsWithLayout = AppProps & {
  Component: pageWithLayout;
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement
);

function ThemeHandler() {
  const theme = useRecoilValue(themeState);

  useEffect(() => {
    if (!theme) return;
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme as string);
  }, [theme]);

  return null;
}

function ColorThemeHandler() {
  const [workspace] = useRecoilState(workspacestate);

  useEffect(() => {
    const defaultColor = "52, 152, 219";

    if (
      workspace &&
      workspace.groupTheme &&
      typeof workspace.groupTheme === "string"
    ) {
      const rgbValue = getRGBFromTailwindColor(workspace.groupTheme);
      document.documentElement.style.setProperty("--group-theme", rgbValue);
    } else {
      document.documentElement.style.setProperty("--group-theme", defaultColor);
    }
  }, [workspace]);

  return null;
}

function getRGBFromTailwindColor(tw: any): string {
  const fallback = "52, 152, 219"; // firefli blue

  if (!tw || typeof tw !== "string") {
    if (tw !== null && tw !== undefined) {
      console.warn("Invalid color value:", tw);
    }
    return fallback;
  }

  const colorName = tw.replace("bg-", "");

  if (colorName === "firefli") {
    return "52, 152, 219";
  }

  const colorMap: Record<string, string> = {
    "firefli": "52, 152, 219",
    "blue-500": "59, 130, 246",
    "red-500": "239, 68, 68",
    "red-700": "185, 28, 28",
    "green-500": "34, 197, 94",
    "green-600": "22, 163, 74",
    "yellow-500": "234, 179, 8",
    "orange-500": "249, 115, 22",
    "purple-500": "168, 85, 247",
    "pink-500": "236, 72, 153",
    black: "0, 0, 0",
    "gray-500": "107, 114, 128",
  };

  return colorMap[colorName] || fallback;
}

function InstanceError({ missing }: { missing: string[] }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Instance Not Available</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Contact an administrator — this instance has not been configured correctly.
          </p>
        </div>
        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 text-left">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Missing environment variables:</p>
          <ul className="space-y-1">
            {missing.map((v) => (
              <li key={v} className="text-sm font-mono text-red-600 dark:text-red-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                {v}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          Add the missing keys to your <code className="px-1 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded font-mono">.env</code> file and restart the server.
        </p>
      </div>
    </div>
  );
}

function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  const [loading, setLoading] = useState(true);
  const [instanceError, setInstanceError] = useState<string[] | null>(null);
  const Layout =
    Component.layout ||
    (({ children }: { children: React.ReactNode }) => <>{children}</>);

  // Check instance configuration on mount
  useEffect(() => {
    fetch("/api/instance-check")
      .then((r) => r.json())
      .then((data) => {
        if (!data.configured) {
          setInstanceError(data.missing || ["Unknown"]);
        }
      })
      .catch(() => {});
  }, []);

  // Scroll to top on route change
  useEffect(() => {
    const handleRouteChange = () => {
      window.scrollTo(0, 0);
    };
    Router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      Router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, []);

  if (instanceError) {
    return (
      <>
        <Head>
          <title>Firefli - Instance Error</title>
        </Head>
        <InstanceError missing={instanceError} />
      </>
    );
  }

  return (
    <RecoilRoot>
      <SWRConfig value={swrConfig}>
        <Head>
          <title>Firefli</title>
          <script
            dangerouslySetInnerHTML={{
              __html: `console.info('%c %cFirefli%c — Manage your group like never before%c\\n\\nUnder no circumstances should you paste anything into this console.', 'padding-left: 2.5em; line-height: 4em; background-size: 2.5em; background-repeat: no-repeat; background-position: left center; background-image: url("data:image/svg+xml,%3Csvg%20width%3D%221080%22%20height%3D%221080%22%20viewBox%3D%220%200%201080%201080%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%221080%22%20height%3D%221080%22%20rx%3D%22200%22%20fill%3D%22%239400DE%22%2F%3E%3Cpath%20d%3D%22M641.37%20433.449C649.589%20439.84%20654.742%20449.362%20655.572%20459.652L658.255%20493.523C659.214%20505.644%20654.614%20517.446%20645.735%20525.626L595.591%20571.81C591.056%20575.986%20587.095%20580.715%20583.752%20585.87L510.016%20700.244C497.092%20720.311%20479.27%20736.736%20458.19%20748.026L365.652%20797.64C349.3%20806.417%20330.114%20791.1%20335.033%20773.206L362.373%20673.722C368.676%20650.779%20380.642%20629.86%20397.208%20612.839L490.789%20516.636C496.197%20511.076%20500.69%20504.664%20504.076%20497.677L532.629%20438.775C538.165%20427.378%20548.833%20419.368%20561.395%20417.217L593.824%20411.635C604.002%20409.888%20614.499%20412.53%20622.718%20418.921L641.37%20433.428V433.449ZM567.677%20393.336C570.998%20395.935%20569.891%20401.154%20565.824%20402.092L553.347%20404.882C541.934%20407.439%20532.224%20414.703%20526.603%20424.885L490.981%20489.454C483.017%20503.876%20469.134%20514.08%20452.909%20517.403L382.942%20531.782C303.328%20548.143%20219.988%20528.502%20155.216%20478.142L131.326%20459.566C106.456%20440.223%20118.55%20400.877%20149.808%20399.471L534.29%20382.11C545.852%20381.577%20557.286%20385.241%20566.484%20392.399L567.677%20393.315V393.336ZM681.273%20481.678C690.471%20488.836%20696.838%20499.019%20699.18%20510.352L777.281%20887.388C783.626%20918.022%20748.493%20939.474%20723.624%20920.131L699.733%20901.555C634.961%20851.195%20595.378%20775.23%20591.567%20694.003L588.224%20622.617C587.457%20606.044%20593.888%20590.067%20605.897%20578.798L659.639%20528.331C668.114%20520.364%20672.756%20509.159%20672.415%20497.464L672.053%20484.682C671.925%20480.507%20676.737%20478.121%20680.059%20480.72L681.251%20481.636L681.273%20481.678ZM953.094%20599.078C964.188%20607.79%20964.23%20624.47%20953.201%20632.906C925.073%20654.401%20885.597%20653.826%20857.426%20631.522L765.528%20558.73C762.951%20556.685%20760.566%20554.427%20758.416%20551.935L648.631%20425.461C644.692%20420.923%20646.161%20413.979%20651.548%20411.507L657.936%20408.61C662.727%20406.416%20668.178%20405.947%20673.33%20407.268L714.936%20417.92C722.474%20419.858%20729.522%20423.33%20735.654%20428.145L953.115%20599.056L953.094%20599.078ZM604.811%20326.36C610.879%20331.089%20615.926%20337.011%20619.609%20343.743L640.455%20381.918C642.903%20386.392%20643.819%20391.504%20643.074%20396.489L642.243%20402.113C641.37%20408.056%20634.94%20411.358%20629.489%20408.674L479.61%20334.945C476.395%20333.347%20473.329%20331.451%20470.497%20329.236L378.087%20257.381C349.789%20235.376%20339.697%20197.329%20353.537%20164.864C359.03%20151.976%20375.34%20147.907%20386.583%20156.641L604.811%20326.338V326.36ZM678.547%20251.438C697.689%20262.302%20705.163%20275.297%20704.886%20288.036C704.652%20298.006%20699.648%20306.548%20694.41%20312.3C699.776%20315.367%20705.525%20319.223%20711.657%20323.995C717.427%20328.49%20722.346%20332.857%20726.477%20337.075C730.799%20330.812%20737.634%20324.315%20746.854%20321.737C759.118%20318.307%20773.555%20322.355%20788.8%20338.225C791.036%20340.547%20790.994%20344.233%20788.694%20346.427C786.394%20348.621%20782.711%20348.514%20780.475%20346.192C767.167%20332.346%20757.01%20331.004%20750.176%20332.921C743.149%20334.881%20737.613%20340.782%20734.547%20346.299C751.581%20368.519%20747.493%20385.987%20741.062%20396.723C735.824%20405.457%20724.773%20407.289%20714.766%20404.797L681.337%20396.468C667.518%20393.017%20655.743%20383.856%20648.993%20371.309L632.662%20340.952C627.764%20331.856%20626.827%20320.693%20634.003%20313.472C642.69%20304.716%20658.277%20296.557%20683.317%20306.868C688.193%20302.586%20693.09%20295.364%20693.26%20287.631C693.431%20280.538%20689.619%20271.015%20672.926%20261.536C670.115%20259.938%20669.093%20256.402%20670.669%20253.632C672.223%20250.863%20675.758%20249.904%20678.569%20251.502L678.547%20251.438Z%22%20fill%3D%22white%22%2F%3E%3C%2Fsvg%3E")', 'font-weight: bold;', '', 'font-style: italic;');`,
            }}
          />
        </Head>

        <AuthProvider loading={loading} setLoading={setLoading} />
        <Initializer />
        <ThemeHandler />
        <ColorThemeHandler />
        <HelpWidget />

        {!loading ? (
          <Layout>
            <Component {...pageProps} />
          </Layout>
        ) : (
          <div className="flex h-screen dark:bg-zinc-900">
            <svg
              aria-hidden="true"
              className="w-24 h-24 text-zinc-200 animate-spin dark:text-zinc-600 fill-firefli my-auto mx-auto"
              viewBox="0 0 100 101"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                fill="currentColor"
              />
              <path
                d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                fill="currentFill"
              />
            </svg>
          </div>
        )}
      </SWRConfig>
    </RecoilRoot>
  );
}

function Initializer() {
  const [login] = useRecoilState(loginState);
  const posthogRef = useRef<any>(null);
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Service worker registration failed:', err);
      });
    }
  }, []);

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    let mounted = true;
    (async () => {
      try {
        const posthog = (await import("posthog-js")).default;
        if (!mounted) return;
        posthog.init(POSTHOG_KEY as string, {
            ui_host: POSTHOG_HOST,
            api_host: POSTHOG_API
		});
        posthogRef.current = posthog;
      } catch (e) {
        console.error("Failed to init PostHog:", e);
      }
    })();
    return () => {
      mounted = false;
      try {
        posthogRef.current?.reset();
      } catch (e) {}
    };
  }, []);

  useEffect(() => {
    try {
      const ph = posthogRef.current;
      if (ph) {
        if (login) {
          try {
            ph.identify(String(login.username), {
              userid: String(login.userId),
              username: login.username,
            });
          } catch (e) {
            console.error("PostHog identify error:", e);
          }
        } else {
          try {
            ph.reset();
          } catch (e) {}
        }
      }
    } catch (e) {
      console.error("PostHog identify error", e);
    }
  }, [login]);

  useEffect(() => {
    (async () => {
      if (INTERCOM_APP_ID === undefined) return;

      try {
        const cfgResp = await fetch("/api/intercom/config");
        const cfg = cfgResp.ok ? await cfgResp.json() : { configured: false };
        if (!cfg.configured) {
          console.warn(
            "Intercom server-side JWT not configured; skipping Intercom load."
          );
          return;
        }

        const Intercom = (await import("@intercom/messenger-js-sdk")).default;

        const avatar = `${window.location.origin}/avatars/${login.userId}.png`;
        const userId = String(login.userId);
        const payload: any = {
          app_id: INTERCOM_APP_ID,
          name: login.username,
          user_id: userId,
          avatar: { type: "image", image_url: avatar },
        };

        try {
          const r = await fetch("/api/intercom/token", {
            credentials: "same-origin",
          });
          if (r.ok) {
            const j = await r.json();
            if (j.intercom_user_hash) {
              payload.user_hash = j.intercom_user_hash;
            }
          }
        } catch (e) {}

        try {
          Intercom(payload);
        } catch (e) {
          console.error("Failed to initialize Intercom:", e);
        }
      } catch (e) {
        console.error("Intercom init error", e);
      }
    })();
  }, [login]);

  return null;
}

export default MyApp;
