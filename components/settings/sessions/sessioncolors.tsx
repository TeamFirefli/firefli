import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { IconPalette, IconChevronDown } from "@tabler/icons-react";
import toast from "react-hot-toast";
import { Listbox } from "@headlessui/react";

type SessionColors = {
  recurring: string;
  shift: string;
  training: string;
  event: string;
  other: string;
};

const SessionColors = () => {
  const router = useRouter();
  const [sessionColors, setSessionColors] = useState<SessionColors>({
    recurring: "bg-blue-500",
    shift: "bg-green-500",
    training: "bg-yellow-500",
    event: "bg-purple-500",
    other: "bg-zinc-500",
  });
  const [isLoading, setIsLoading] = useState(false);

  const colorOptions = [
    { value: "bg-blue-500", label: "Blue" },
    { value: "bg-green-500", label: "Green" },
    { value: "bg-yellow-500", label: "Yellow" },
    { value: "bg-red-500", label: "Red" },
    { value: "bg-purple-500", label: "Purple" },
    { value: "bg-pink-500", label: "Pink" },
    { value: "bg-indigo-500", label: "Indigo" },
    { value: "bg-orange-500", label: "Orange" },
    { value: "bg-orange-400", label: "Light Orange" },
    { value: "bg-teal-500", label: "Teal" },
    { value: "bg-cyan-500", label: "Cyan" },
    { value: "bg-zinc-500", label: "Gray" },
  ];

  useEffect(() => {
    loadSessionColors();
  }, [router.query.id]);

  const loadSessionColors = async () => {
    if (!router.query.id) return;

    try {
      setIsLoading(true);
      const response = await axios.get(
        `/api/workspace/${router.query.id}/settings/general/session-colors`
      );
      if (response.data.success && response.data.colors) {
        setSessionColors(response.data.colors);
      }
    } catch (error) {
      console.error("Failed to load session colours:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSessionColor = async (
    colorType: keyof SessionColors,
    color: string
  ) => {
    try {
      const newColors = { ...sessionColors, [colorType]: color };
      setSessionColors(newColors);

      const res = await axios.patch(
        `/api/workspace/${router.query.id}/settings/general/session-colors`,
        { colors: newColors }
      );

      if (res.status === 200) {
        toast.success("Session colours updated successfully!");
      } else {
        toast.error("Failed to update session colours.");
        setSessionColors(sessionColors);
      }
    } catch (error) {
      toast.error("Something went wrong.");
      setSessionColors(sessionColors);
    }
  };

  const sessionColorTypes: {
    key: keyof SessionColors;
    label: string;
    description: string;
  }[] = [
    {
      key: "recurring" as keyof SessionColors,
      label: "Recurring Sessions",
      description: 'Colour for "Recurring" tag',
    },
    {
      key: "shift" as keyof SessionColors,
      label: "Shift Sessions",
      description: 'Color for "Shift" sessions',
    },
    {
      key: "training" as keyof SessionColors,
      label: "Training Sessions",
      description: 'Colour for "Training" sessions',
    },
    {
      key: "event" as keyof SessionColors,
      label: "Event Sessions",
      description: 'Colour for "Event" sessions',
    },
    {
      key: "other" as keyof SessionColors,
      label: "Other Sessions",
      description: 'Colour for "Other" sessions',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <IconPalette size={20} className="text-primary" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Session Type Colours
          </h3>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Customise the colours used for different session types in your workspace
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
          Loading colours...
        </div>
      ) : (
        <div className="space-y-4">
          {sessionColorTypes.map((type) => (
            <div key={type.key} className="space-y-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {type.label}
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                {type.description}
              </p>
              <Listbox
                value={sessionColors[type.key]}
                onChange={(value) => updateSessionColor(type.key, value)}
              >
                <div className="relative">
                  <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-white dark:bg-zinc-800 py-2 pl-3 pr-10 text-left border border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary">
                    <span className="flex items-center">
                      <span className={`inline-block h-4 w-4 rounded ${sessionColors[type.key]} mr-2`} />
                      <span className="block truncate dark:text-white">
                        {colorOptions.find(c => c.value === sessionColors[type.key])?.label}
                      </span>
                    </span>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                      <IconChevronDown className="h-5 w-5 text-zinc-400" aria-hidden="true" />
                    </span>
                  </Listbox.Button>
                  <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-zinc-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {colorOptions.map((option) => (
                      <Listbox.Option
                        key={option.value}
                        className={({ active }) =>
                          `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                            active ? "bg-primary/10 text-primary" : "text-zinc-900 dark:text-white"
                          }`
                        }
                        value={option.value}
                      >
                        {({ selected }) => (
                          <>
                            <span className="flex items-center">
                              <span className={`inline-block h-4 w-4 rounded ${option.value} mr-2`} />
                              <span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
                                {option.label}
                              </span>
                            </span>
                          </>
                        )}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </div>
              </Listbox>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

SessionColors.title = "Session Colors";

export default SessionColors;
