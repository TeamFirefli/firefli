import workspace from "@/layouts/workspace";
import { pageWithLayout } from "@/layoutTypes";
import { loginState } from "@/state";
import axios from "axios";
import { useRouter } from "next/router";
import { getConfig } from "@/utils/configEngine";
import { useState, Fragment, useMemo, useRef, useEffect } from "react";
import randomText from "@/utils/randomText";
import { useRecoilState } from "recoil";
import toast, { Toaster } from "react-hot-toast";
import Button from "@/components/button";
import { InferGetServerSidePropsType } from "next";
import { withSessionSsr } from "@/lib/withSession";
import moment from "moment";
import { Dialog, Transition } from "@headlessui/react";
import { withPermissionCheckSsr } from "@/utils/permissionsManager";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import Input from "@/components/input";
import prisma, { inactivityNotice } from "@/utils/database";
import { getUsername, getThumbnail } from "@/utils/userinfoEngine";
import Image from "next/image";
import Checkbox from "@/components/checkbox";
import Tooltip from "@/components/tooltip";
import {
  IconUsers,
  IconPlus,
  IconTrash,
  IconPencil,
  IconCalendar,
  IconClipboardList,
  IconArrowLeft,
  IconBrandDiscord,
  IconUserCheck,
  IconEdit,
  IconExternalLink,
  IconCopy,
  IconAlertTriangle,
  IconAlertOctagon,
  IconSearch,
  IconLoader2,
  IconX,
} from "@tabler/icons-react";

export const getServerSideProps = withPermissionCheckSsr(
  async ({ req, res, params }) => {
    let users = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            workspaceGroupId: parseInt(params?.id as string),
            permissions: {
              has: "represent_alliance",
            },
          },
        },
      },
    });
    const infoUsers: any = await Promise.all(
      users.map(async (user: any) => {
        return {
          ...user,
          userid: Number(user.userid),
          thumbnail: getThumbnail(user.userid),
        };
      }),
    );

    const ally: any = await prisma.ally.findUnique({
      where: {
        id: String(params?.aid),
      },
      include: {
        reps: true,
      },
    });

    if (ally == null) {
      res.writeHead(302, {
        Location: `/workspace/${params?.id}/alliances`,
      });
      res.end();
      return;
    }

    const infoReps = await Promise.all(
      ally.reps.map(async (rep: any) => {
        return {
          ...rep,
          userid: Number(rep.userid),
          username: await getUsername(rep.userid),
          thumbnail: getThumbnail(rep.userid),
        };
      }),
    );

    let infoAlly = ally;
    infoAlly.reps = infoReps;
    const infoTheirReps = await Promise.all(
      (ally.theirReps || []).map(async (rep: string) => {
        try {
          const parsed = JSON.parse(rep);
          if (parsed.userId) {
            const userId = BigInt(parsed.userId);
            const username = parsed.username || (await getUsername(userId));
            return {
              userId: String(parsed.userId),
              username,
              thumbnail: getThumbnail(userId),
            };
          }
        } catch {}
        return { userId: null, username: rep, thumbnail: null };
      }),
    );

    const eligibleIds = new Set(infoUsers.map((u: any) => Number(u.userid)));
    const repIds = new Set(infoReps.map((r: any) => Number(r.userid)));
    const allDbIdsRaw = await prisma.user.findMany({
      select: { userid: true },
    });
    const extraIds = allDbIdsRaw
      .map((u: any) => Number(u.userid))
      .filter((id: number) => !eligibleIds.has(id) && !repIds.has(id));
    const missingReps = infoReps.filter(
      (r: any) => !eligibleIds.has(Number(r.userid)),
    );
    // @ts-ignore
    const visits = await prisma.allyVisit.findMany({
      where: {
        // @ts-ignore
        allyId: params?.aid,
      },
    });

    const infoVisits = await Promise.all(
      visits.map(async (visit: any) => {
        return {
          ...visit,
          hostId: Number(visit.hostId),
          hostUsername: await getUsername(visit.hostId),
          hostThumbnail: getThumbnail(visit.hostId),
          time: new Date(visit.time).toISOString(),
          participants: visit.participants
            ? visit.participants.map((p: bigint) => Number(p))
            : [],
        };
      }),
    );

    const currentUserId = req.session?.userid;
    const isAllyRep = currentUserId
      ? infoReps.some((rep: any) => rep.userid === Number(currentUserId))
      : false;

    const currentUser = currentUserId
      ? await prisma.user.findFirst({
          where: {
            userid: BigInt(currentUserId),
          },
          include: {
            roles: {
              where: {
                workspaceGroupId: parseInt(params?.id as string),
              },
              orderBy: {
                isOwnerRole: "desc",
              },
            },
          },
        })
      : null;

    const hasManagePermissions =
      currentUser?.roles[0]?.isOwnerRole ||
      currentUser?.roles[0]?.permissions?.includes("create_alliances") ||
      false;

    const hasEditAllianceDetails =
      currentUser?.roles[0]?.isOwnerRole ||
      currentUser?.roles[0]?.permissions?.includes("edit_alliance_details") ||
      false;

    const hasAddNotes =
      currentUser?.roles[0]?.isOwnerRole ||
      currentUser?.roles[0]?.permissions?.includes("add_alliance_notes") ||
      false;

    const hasEditNotes =
      currentUser?.roles[0]?.isOwnerRole ||
      currentUser?.roles[0]?.permissions?.includes("edit_alliance_notes") ||
      false;

    const hasDeleteNotes =
      currentUser?.roles[0]?.isOwnerRole ||
      currentUser?.roles[0]?.permissions?.includes("delete_alliance_notes") ||
      false;

    const hasAddVisits =
      currentUser?.roles[0]?.isOwnerRole ||
      currentUser?.roles[0]?.permissions?.includes("add_alliance_visits") ||
      false;

    const hasEditVisits =
      currentUser?.roles[0]?.isOwnerRole ||
      currentUser?.roles[0]?.permissions?.includes("edit_alliance_visits") ||
      false;

    const hasDeleteVisits =
      currentUser?.roles[0]?.isOwnerRole ||
      currentUser?.roles[0]?.permissions?.includes("delete_alliance_visits") ||
      false;

    if (!isAllyRep && !hasManagePermissions) {
      res.writeHead(302, {
        Location: `/workspace/${params?.id}/alliances`,
      });
      res.end();
      return;
    }

    return {
      props: {
        infoUsers,
        infoAlly,
        infoVisits,
        infoTheirReps,
        missingReps,
        canEditAllianceDetails: hasEditAllianceDetails,
        canAddNotes: hasAddNotes,
        canEditNotes: hasEditNotes,
        canDeleteNotes: hasDeleteNotes,
        canAddVisits: hasAddVisits,
        canEditVisits: hasEditVisits,
        canDeleteVisits: hasDeleteVisits,
      },
    };
  },
);

type Notes = {
  [key: string]: string;
};

type Rep = {
  userid: number;
};

type Visit = {
  name: string;
  time: Date;
  eventType?: string;
  description?: string;
  hostRole?: string;
  participants?: string[];
};

type EditVisit = {
  name: string;
  time: string;
  eventType?: string;
  description?: string;
  hostRole?: string;
  participants?: string[];
};

type NoteItem = {
  type: 'note' | 'warning' | 'strike';
  content: string;
  postedBy?: string;
  postedAt?: string;
  editedBy?: string;
  editedAt?: string;
};

type TheirRepItem = {
  userId: string | null;
  username: string;
  thumbnail: string | null;
};

function parseNote(raw: string): NoteItem {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.type && parsed.content !== undefined) return parsed as NoteItem;
  } catch {}
  return { type: 'note', content: raw };
}

function serializeNote(note: NoteItem): string {
  return JSON.stringify(note);
}

type pageProps = InferGetServerSidePropsType<typeof getServerSideProps>;
const ManageAlly: pageWithLayout<pageProps> = (props) => {
  const router = useRouter();
  const { id } = router.query;
  const [login, setLogin] = useRecoilState(loginState);
  const text = useMemo(() => randomText(login.displayname), []);
  const ally: any = props.infoAlly;
  const users: any = props.infoUsers;
  const visits: any = props.infoVisits;
  const canEditAllianceDetails: boolean = Boolean(props.canEditAllianceDetails);
  const canAddNotes: boolean = Boolean(props.canAddNotes);
  const canEditNotes: boolean = Boolean(props.canEditNotes);
  const canDeleteNotes: boolean = Boolean(props.canDeleteNotes);
  const canAddVisits: boolean = Boolean(props.canAddVisits);
  const canEditVisits: boolean = Boolean(props.canEditVisits);
  const canDeleteVisits: boolean = Boolean(props.canDeleteVisits);

  const BG_COLORS = [
    "bg-amber-200",
    "bg-red-300",
    "bg-lime-200",
    "bg-emerald-300",
    "bg-rose-200",
    "bg-green-100",
    "bg-teal-200",
    "bg-yellow-200",
    "bg-red-100",
    "bg-green-300",
    "bg-lime-300",
    "bg-emerald-200",
    "bg-rose-300",
    "bg-amber-300",
    "bg-red-200",
    "bg-green-200",
  ];

  function getRandomBg(userid: string, username?: string) {
    const key = `${userid ?? ""}:${username ?? ""}`;
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) ^ key.charCodeAt(i);
    }
    const index = (hash >>> 0) % BG_COLORS.length;
    return BG_COLORS[index];
  }

  const form = useForm();
  const { register, handleSubmit, setError, watch } = form;

  const [reps, setReps] = useState(
    ally.reps.map((u: any) => {
      return u.userid;
    }),
  );

  const saveNotes = async () => {
    const now = new Date().toISOString();
    const updatedNotes = notes.map((note, index) => {
      if (editNotes.includes(index) && !newNotes.includes(index)) {
        return { ...note, editedBy: login.username, editedAt: now };
      }
      return note;
    });
    const axiosPromise = axios
      .patch(`/api/workspace/${id}/allies/${ally.id}/notes`, {
        notes: updatedNotes.map(serializeNote),
      })
      .then((req) => {
        setNotes(updatedNotes);
        setEditNotes([]);
        setNewNotes([]);
      });
    toast.promise(axiosPromise, {
      loading: "Updating notes...",
      success: () => {
        return "Notes updated!";
      },
      error: "Notes were not saved due to an unknown error.",
    });
  };

  const saveAllianceInfo = async () => {
    const filteredTheirReps = theirReps
      .filter((rep: TheirRepItem) => rep.username?.trim())
      .map((rep: TheirRepItem) =>
        rep.userId
          ? JSON.stringify({ userId: rep.userId, username: rep.username })
          : rep.username,
      );

    // Save alliance info
    const allianceInfoPromise = axios.post(
      `/api/workspace/${id}/allies/${ally.id}/update`,
      {
        discordServer: discordServer.trim(),
        ourReps: reps,
        theirReps: filteredTheirReps,
      },
    );

    // Use old rep api
    const repsPromise = axios.patch(
      `/api/workspace/${id}/allies/${ally.id}/reps`,
      { reps: reps },
    );

    const dualPromise = Promise.all([allianceInfoPromise, repsPromise]).then(
      () => {
        setIsEditingInfo(false);
        router.reload();
      },
    );

    toast.promise(dualPromise, {
      loading: "Updating alliance information...",
      success: () => {
        return "Alliance information updated!";
      },
      error: "Alliance information was not saved due to an unknown error.",
    });
  };
  const [notes, setNotes] = useState<NoteItem[]>(
    (ally.notes || []).map(parseNote),
  );
  const [editNotes, setEditNotes] = useState<any[]>([]);
  const [newNotes, setNewNotes] = useState<number[]>([]);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [discordServer, setDiscordServer] = useState(ally.discordServer || "");
  const [theirReps, setTheirReps] = useState<TheirRepItem[]>(
    ((props.infoTheirReps as TheirRepItem[]) || []).filter(
      (r: TheirRepItem) => r.username?.trim(),
    ),
  );
  const [theirRepSearch, setTheirRepSearch] = useState("");
  const [theirRepSearchResults, setTheirRepSearchResults] = useState<any[]>([]);
  const [isSearchingTheirReps, setIsSearchingTheirReps] = useState(false);

  const updateReps = async () => {
    const axiosPromise = axios
      .patch(`/api/workspace/${id}/allies/${ally.id}/reps`, { reps: reps })
      .then((req) => {});
    toast.promise(axiosPromise, {
      loading: "Updating representatives...",
      success: () => {
        return "Representatives updated!";
      },
      error: "Representatives were unable to save.",
    });
  };

  const [isOpen, setIsOpen] = useState(false);
  const [isEditOpen, setEditOpen] = useState(false);
  const [ourRepSearch, setOurRepSearch] = useState("");
  const [ourRepSearchFocused, setOurRepSearchFocused] = useState(false);
  const ourRepSearchRef = useRef<HTMLInputElement>(null);

  const filteredOurRepSuggestions = users
    ? users.filter(
        (u: any) =>
          !reps.includes(Number(u.userid)) &&
          (ourRepSearch.trim() === "" ||
            u.username.toLowerCase().includes(ourRepSearch.toLowerCase())),
      )
    : [];

  const addOurRep = (userid: number) => {
    if (!reps.includes(userid)) setReps([...reps, userid]);
    setOurRepSearch("");
    ourRepSearchRef.current?.focus();
  };

  const removeOurRep = (userid: number) => {
    setReps(reps.filter((r: any) => r !== userid));
  };
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>(
    [],
  );
  const [editSelectedParticipants, setEditSelectedParticipants] = useState<
    number[]
  >([]);

  const [editContent, setEditContent] = useState({
    name: "",
    time: "",
    id: "",
    eventType: "visit",
    description: "",
    hostRole: "host",
    participants: [] as number[],
  });

  const handleVisitChange = async (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: "name" | "time",
  ) => {
    setEditContent({ ...editContent, [field]: e.target.value });
    return true;
  };

  const handleVisitBlur = async () => {
    return true;
  };

  const handleNoteChange = async (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    index: number,
  ) => {
    const newValue = e.target.value;
    const updated = [...notes];
    updated[index] = { ...updated[index], content: newValue };
    setNotes(updated);
    return true;
  };

  const handleNoteTypeChange = (index: number, type: NoteItem["type"]) => {
    const updated = [...notes];
    updated[index] = { ...updated[index], type };
    setNotes(updated);
  };

  const removeTheirRep = (index: number) => {
    setTheirReps(theirReps.filter((_, i) => i !== index));
  };

  const searchTheirRepsExternally = async () => {
    if (!theirRepSearch.trim()) return;
    setIsSearchingTheirReps(true);
    try {
      const response = await axios.post("/api/roblox/id", {
        keyword: theirRepSearch.trim(),
      });
      if (response.data?.data?.length > 0) {
        const users = response.data.data.map((user: any) => ({
          userId: String(user.id),
          username: user.name,
          displayName: user.displayName,
          thumbnail: `/api/workspace/${id}/avatar/${user.id}`,
        }));
        setTheirRepSearchResults(users);
      } else {
        setTheirRepSearchResults([]);
        toast.error("No Roblox users found");
      }
    } catch {
      toast.error("Failed to search Roblox");
      setTheirRepSearchResults([]);
    }
    setIsSearchingTheirReps(false);
  };

  const addTheirRepFromSearch = (user: {
    userId: string;
    username: string;
    thumbnail: string;
  }) => {
    if (theirReps.some((r) => r.userId === user.userId)) {
      toast.error("This user is already added");
      return;
    }
    setTheirReps([
      ...theirReps,
      { userId: user.userId, username: user.username, thumbnail: user.thumbnail },
    ]);
    setTheirRepSearch("");
    setTheirRepSearchResults([]);
  };

  const handleNoteBlur = async () => {
    return true;
  };

  const createNote = () => {
    const newNoteIndex = notes.length;
    setNotes([...notes, { type: "note", content: "", postedBy: login.username, postedAt: new Date().toISOString() }]);
    setEditNotes([...editNotes, newNoteIndex]);
    setNewNotes([...newNotes, newNoteIndex]);
  };

  const deleteNote = async (index: any) => {
    const noteClone = [...notes];
    noteClone.splice(index, 1);
    setNotes(noteClone);
    setNewNotes(
      newNotes.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)),
    );

    const axiosPromise = axios
      .patch(`/api/workspace/${id}/allies/${ally.id}/notes`, {
        notes: noteClone.map(serializeNote),
      })
      .then((req) => {
        setEditNotes([]);
      });
    toast.promise(axiosPromise, {
      loading: "Deleting note...",
      success: () => {
        return "Note deleted!";
      },
      error: "Note was not deleted due to an unknown error.",
    });
  };

  const noteEdit = (index: any) => {
    if (editNotes.includes(index)) {
      const newEdits = editNotes.filter((n) => n !== index);
      setEditNotes(newEdits);
    } else {
      setEditNotes([...editNotes, index]);
    }
  };
  const visitform = useForm<Visit>();
  const notesform = useForm<Notes>({
    defaultValues: notes.reduce((acc: Notes, note: NoteItem, index: number) => {
      acc[`note-${index}`] = note.content;
      return acc;
    }, {} as Notes),
  });

  const createVisit: SubmitHandler<Visit> = async ({
    name,
    time,
    eventType,
    description,
    hostRole,
  }) => {
    const axiosPromise = axios
      .post(`/api/workspace/${id}/allies/${ally.id}/visits`, {
        name: name,
        time: time,
        eventType: eventType || "visit",
        description: description || "",
        hostRole: hostRole || "host",
        participants: selectedParticipants,
      })
      .then((req) => {});
    toast.promise(axiosPromise, {
      loading: "Creating visit...",
      success: () => {
        setSelectedParticipants([]);
        router.reload();
        return "Visit created!";
      },
      error: "Visit was not created due to an unknown error.",
    });
  };

  const editVisit = async (
    visitId: any,
    visitName: any,
    visitTime: any,
    visitEventType?: string,
    visitDescription?: string,
    visitHostRole?: string,
    visitParticipants?: number[],
  ) => {
    // Format the time for datetime-local input (YYYY-MM-DDTHH:MM)
    const formattedTime = new Date(visitTime).toISOString().slice(0, 16);

    setEditContent({
      name: visitName,
      time: formattedTime,
      id: visitId,
      eventType: visitEventType || "visit",
      description: visitDescription || "",
      hostRole: visitHostRole || "host",
      participants: visitParticipants || [],
    });
    setEditSelectedParticipants(visitParticipants || []);

    // Reset the form with the new values
    editform.reset({
      name: visitName,
      time: formattedTime,
      eventType: visitEventType || "visit",
      description: visitDescription || "",
      hostRole: visitHostRole || "host",
    });

    setEditOpen(true);
  };

  const updateVisit = async () => {
    const formValues = editform.getValues();
    const axiosPromise = axios
      .patch(
        `/api/workspace/${id}/allies/${ally.id}/visits/${editContent.id}`,
        {
          name: formValues.name,
          time: formValues.time,
          eventType: formValues.eventType || "visit",
          description: formValues.description || "",
          hostRole: formValues.hostRole || "host",
          participants: editSelectedParticipants,
        },
      )
      .then((req) => {});
    toast.promise(axiosPromise, {
      loading: "Updating visit...",
      success: () => {
        setEditSelectedParticipants([]);
        router.reload();
        return "Visit updated!";
      },
      error: "Visit was not updated due to an unknown error.",
    });
  };

  const deleteVisit = async (visitId: any) => {
    const axiosPromise = axios
      .delete(`/api/workspace/${id}/allies/${ally.id}/visits/${visitId}`)
      .then((req) => {});
    toast.promise(axiosPromise, {
      loading: "Deleting visit...",
      success: () => {
        router.reload();
        return "Visit deleted!";
      },
      error: "Visit was not deleted due to an unknown error.",
    });
  };

  const editform = useForm<EditVisit>({
    defaultValues: {
      name: editContent.name,
      time: editContent.time,
      eventType: editContent.eventType,
      description: editContent.description,
      hostRole: editContent.hostRole,
    },
  });

  return (
    <>
      <Toaster position="bottom-center" />

      {/* create visit modal */}
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-10"
          onClose={() => setIsOpen(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-white dark:bg-zinc-800 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium text-zinc-900 mb-4 dark:text-white"
                  >
                    Create Scheduled Event
                  </Dialog.Title>

                  <div className="mt-2">
                    <FormProvider {...visitform}>
                      <form onSubmit={visitform.handleSubmit(createVisit)}>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                              Event Type
                            </label>
                            <select
                              {...visitform.register("eventType")}
                              defaultValue="visit"
                              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                            >
                              <option value="visit">Alliance Visit</option>
                              <option value="event">Alliance Event</option>
                            </select>
                          </div>
                          <Input
                            label="Title"
                            {...visitform.register("name", { required: true })}
                          />
                          <Input
                            label="Date & Time"
                            type="datetime-local"
                            {...visitform.register("time", { required: true })}
                          />
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                              Description (optional)
                            </label>
                            <textarea
                              {...visitform.register("description")}
                              rows={2}
                              placeholder="Briefly describe the event..."
                              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                              Our Role
                            </label>
                            <select
                              {...visitform.register("hostRole")}
                              defaultValue="host"
                              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                            >
                              <option value="host">Host</option>
                              <option value="attending">Attending</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                              Attendees
                            </label>
                            <div className="max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-600 rounded-lg p-2 bg-white dark:bg-zinc-700">
                              {users.map((user: any) => (
                                <label
                                  key={user.userid}
                                  className="flex items-center gap-2 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-600 rounded cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedParticipants.includes(
                                      Number(user.userid),
                                    )}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedParticipants([
                                          ...selectedParticipants,
                                          Number(user.userid),
                                        ]);
                                      } else {
                                        setSelectedParticipants(
                                          selectedParticipants.filter(
                                            (id) => id !== Number(user.userid),
                                          ),
                                        );
                                      }
                                    }}
                                    className="rounded border-zinc-300 text-primary focus:ring-primary"
                                  />
                                  <span className="text-sm text-zinc-900 dark:text-white">
                                    {user.username}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                        <input type="submit" className="hidden" />
                      </form>
                    </FormProvider>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      className="flex-1 justify-center rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="flex-1 justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
                      onClick={visitform.handleSubmit(createVisit)}
                    >
                      Create Event
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* edit visit modal */}
      <Transition appear show={isEditOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-10"
          onClose={() => setEditOpen(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-white dark:bg-zinc-800 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium dark:text-white text-zinc-900 mb-4"
                  >
                    Edit Scheduled Event
                  </Dialog.Title>

                  <div className="mt-2">
                    <FormProvider {...editform}>
                      <form>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                              Event Type
                            </label>
                            <select
                              {...editform.register("eventType")}
                              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                            >
                              <option value="visit">Alliance Visit</option>
                              <option value="event">Alliance Event</option>
                            </select>
                          </div>
                          <Input
                            label="Title"
                            {...editform.register("name")}
                          />
                          <Input
                            label="Date & Time"
                            type="datetime-local"
                            {...editform.register("time")}
                          />
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                              Description (optional)
                            </label>
                            <textarea
                              {...editform.register("description")}
                              rows={2}
                              placeholder="Briefly describe the event..."
                              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                              Our Role
                            </label>
                            <select
                              {...editform.register("hostRole")}
                              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                            >
                              <option value="host">Host</option>
                              <option value="attending">Attending</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                              Attendees
                            </label>
                            <div className="max-h-48 overflow-y-auto border border-zinc-200 dark:border-zinc-600 rounded-lg p-2 bg-white dark:bg-zinc-700">
                              {users.map((user: any) => (
                                <label
                                  key={user.userid}
                                  className="flex items-center gap-2 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-600 rounded cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={editSelectedParticipants.includes(
                                      Number(user.userid),
                                    )}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setEditSelectedParticipants([
                                          ...editSelectedParticipants,
                                          Number(user.userid),
                                        ]);
                                      } else {
                                        setEditSelectedParticipants(
                                          editSelectedParticipants.filter(
                                            (id) => id !== Number(user.userid),
                                          ),
                                        );
                                      }
                                    }}
                                    className="rounded border-zinc-300 text-primary focus:ring-primary"
                                  />
                                  <span className="text-sm text-zinc-900 dark:text-white">
                                    {user.username}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                        <input type="submit" className="hidden" />
                      </form>
                    </FormProvider>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      className="flex-1 justify-center rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition-colors"
                      onClick={() => setEditOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="flex-1 justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
                      onClick={() => {
                        updateVisit();
                      }}
                    >
                      Update Event
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <div className="pagePadding">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.push(`/workspace/${id}/alliances`)}
              className="p-2 text-zinc-500 hover:text-zinc-700 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              <IconArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-medium text-zinc-900 dark:text-white">
              Alliances
            </h1>
          </div>

          {/* Ally Header */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="p-6">
              <div className="flex items-center gap-4">
                <img
                  src={ally.icon}
                  className="w-16 h-16 rounded-full"
                  alt={`${ally.name} icon`}
                />
                <div className="flex-1">
                  <h2 className="text-xl font-medium text-zinc-900 dark:text-white">
                    {ally.name}
                  </h2>
                  <p className="text-sm text-zinc-500 mt-1">
                    Group ID: {ally.groupId}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {ally.reps.map((rep: any) => (
                      <Tooltip
                        key={rep.userid}
                        orientation="top"
                        tooltipText={rep.username}
                      >
                        <a
                          href={`https://www.roblox.com/users/${rep.userid}/profile`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <div
                            className={`w-8 h-8 p-0.5 rounded-full flex items-center justify-center ${getRandomBg(
                              rep.userid,
                            )} border-2 ${
                              (props as any).missingReps?.some(
                                (m: any) =>
                                  Number(m.userid) === Number(rep.userid),
                              )
                                ? "border-amber-400 opacity-70"
                                : "border-white"
                            } hover:scale-110 transition-transform cursor-pointer`}
                          >
                            <img
                              src={rep.thumbnail}
                              className="w-full h-full rounded-full object-cover"
                              alt={rep.username}
                              style={{ background: "transparent" }}
                            />
                          </div>
                        </a>
                      </Tooltip>
                    ))}
                  </div>
                </div>
                <a
                  href={`https://www.roblox.com/groups/${ally.groupId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full border border-zinc-300 bg-white text-xs font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800 whitespace-nowrap self-start"
                >
                  <IconExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">View on Roblox</span>
                  <span className="sm:hidden">Roblox</span>
                </a>
              </div>
            </div>
          </div>

          {/* Alliance Information */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <IconUserCheck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-zinc-900 dark:text-white">
                      Alliance Information
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Discord server and representative information
                    </p>
                  </div>
                </div>
                {canEditAllianceDetails && (
                  <button
                    onClick={() => setIsEditingInfo(!isEditingInfo)}
                    className="p-2 text-zinc-400 hover:text-primary transition-colors"
                  >
                    <IconEdit className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Discord Server
                </label>
                {isEditingInfo ? (
                  <input
                    type="text"
                    value={discordServer}
                    onChange={(e) => setDiscordServer(e.target.value)}
                    placeholder="https://discord.gg/..."
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    {discordServer ? (
                      <>
                        <IconBrandDiscord className="w-5 h-5 text-indigo-500" />
                        <a
                          href={
                            discordServer.startsWith("http://") ||
                            discordServer.startsWith("https://")
                              ? discordServer
                              : `https://${discordServer}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 underline"
                        >
                          {discordServer}
                        </a>
                      </>
                    ) : (
                      <span className="text-zinc-500 dark:text-zinc-400 italic">
                        No Discord server set
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Our Representatives
                </label>
                {isEditingInfo ? (
                  <div className="space-y-2">
                    {reps.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {reps.map((userid: any) => {
                          const user = users.find(
                            (u: any) => Number(u.userid) === userid,
                          );
                          const missing = (props as any).missingReps?.find(
                            (m: any) => Number(m.userid) === userid,
                          );
                          const displayUser = user || missing;
                          if (!displayUser) return null;
                          return (
                            <div
                              key={userid}
                              className={`flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full ${
                                missing
                                  ? "bg-amber-100 dark:bg-amber-900/30"
                                  : "bg-primary/10"
                              }`}
                            >
                              <img
                                src={
                                  displayUser.thumbnail ||
                                  "/default-avatar.jpg"
                                }
                                alt={displayUser.username}
                                className="w-5 h-5 rounded-full"
                                onError={(e) =>
                                  (e.currentTarget.src = "/default-avatar.jpg")
                                }
                              />
                              <span
                                className={`text-xs font-medium ${
                                  missing
                                    ? "text-amber-700 dark:text-amber-400"
                                    : "text-primary"
                                }`}
                              >
                                {displayUser.username}
                                {missing && (
                                  <span className="ml-1 opacity-70">
                                    (not in workspace)
                                  </span>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeOurRep(userid)}
                                className={`${
                                  missing
                                    ? "text-amber-500/60 hover:text-amber-500"
                                    : "text-primary/60 hover:text-primary"
                                }`}
                              >
                                <IconX className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="relative">
                      <div className="relative">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
                        <input
                          ref={ourRepSearchRef}
                          type="text"
                          value={ourRepSearch}
                          onChange={(e) => setOurRepSearch(e.target.value)}
                          onFocus={() => setOurRepSearchFocused(true)}
                          onBlur={() =>
                            setTimeout(() => setOurRepSearchFocused(false), 150)
                          }
                          placeholder="Search by username..."
                          className="w-full pl-9 pr-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>
                      {ourRepSearchFocused &&
                        filteredOurRepSuggestions.length > 0 && (
                          <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredOurRepSuggestions.map((user: any) => (
                              <button
                                key={user.userid}
                                type="button"
                                onMouseDown={() =>
                                  addOurRep(Number(user.userid))
                                }
                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition text-left"
                              >
                                <img
                                  src={user.thumbnail}
                                  alt={user.username}
                                  className="w-8 h-8 rounded-full"
                                />
                                <span className="text-sm text-zinc-900 dark:text-white">
                                  {user.username}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      {ourRepSearchFocused &&
                        filteredOurRepSuggestions.length === 0 &&
                        ourRepSearch.trim() !== "" && (
                          <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg px-3 py-2">
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                              No matching representatives found
                            </p>
                          </div>
                        )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {reps.length} selected, minimum 1 required.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {ally.reps && ally.reps.length > 0 ? (
                      ally.reps.map((rep: any, index: number) => (
                        <div
                          key={`rep-${index}`}
                          className="flex items-center gap-3 py-1.5"
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${getRandomBg(
                              String(rep.userid),
                            )} overflow-hidden flex-shrink-0`}
                          >
                            <img
                              src={rep.thumbnail}
                              className="w-full h-full object-cover"
                              alt={rep.username}
                              style={{ background: "transparent" }}
                            />
                          </div>
                          <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1">
                            {rep.username}
                            {(props as any).missingReps?.some(
                              (m: any) =>
                                Number(m.userid) === Number(rep.userid),
                            ) && (
                              <span className="ml-2 text-xs text-amber-500">
                                (not in workspace)
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            title="Copy username"
                            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors flex-shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText(rep.username);
                              toast.success("Copied to clipboard");
                            }}
                          >
                            <IconCopy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <span className="text-zinc-500 dark:text-zinc-400 italic">
                        No representatives assigned
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Their Representatives
                  </label>
                </div>
                {isEditingInfo ? (
                  <div className="space-y-2">
                    {/* External Roblox search */}
                    <div className="relative">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
                          <input
                            type="text"
                            value={theirRepSearch}
                            onChange={(e) => setTheirRepSearch(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && searchTheirRepsExternally()
                            }
                            placeholder="Search by Roblox username..."
                            className="w-full pl-9 pr-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={searchTheirRepsExternally}
                          disabled={isSearchingTheirReps}
                          className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm flex items-center gap-1 disabled:opacity-50 transition-colors"
                        >
                          {isSearchingTheirReps ? (
                            <IconLoader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <IconSearch className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {theirRepSearchResults.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {theirRepSearchResults.map((u: any) => (
                            <button
                              key={u.userId}
                              type="button"
                              onClick={() => addTheirRepFromSearch(u)}
                              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition text-left"
                            >
                              <img
                                src={u.thumbnail}
                                alt=""
                                className="w-8 h-8 rounded-full"
                              />
                              <div>
                                <span className="text-sm text-zinc-900 dark:text-white">
                                  {u.username}
                                </span>
                                {u.displayName && u.displayName !== u.username && (
                                  <span className="text-xs text-zinc-400 ml-1">
                                    ({u.displayName})
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {theirReps.map((rep, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-2 bg-zinc-50 dark:bg-zinc-700 rounded-lg"
                      >
                        {rep.thumbnail ? (
                          <img
                            src={rep.thumbnail}
                            alt={rep.username}
                            className="w-8 h-8 rounded-full flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs text-zinc-500">
                              {rep.username?.[0]?.toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="text-sm text-zinc-900 dark:text-white flex-1">
                          {rep.username}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeTheirRep(index)}
                          className="p-1 text-red-400 hover:text-red-500"
                        >
                          <IconTrash className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {theirReps.length === 0 && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
                        Search above to add their representatives
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {theirReps.filter((rep) => rep.username?.trim()).length >
                    0 ? (
                      theirReps
                        .filter((rep) => rep.username?.trim())
                        .map((rep, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-3 py-1.5"
                          >
                            {rep.thumbnail ? (
                              <img
                                src={rep.thumbnail}
                                alt={rep.username}
                                className="w-8 h-8 rounded-full flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-600 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs text-zinc-500">
                                  {rep.username?.[0]?.toUpperCase()}
                                </span>
                              </div>
                            )}
                            <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1">
                              {rep.username}
                            </span>
                            {rep.userId && (
                              <a
                                href={`https://www.roblox.com/users/${rep.userId}/profile`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-zinc-400 hover:text-primary transition-colors"
                              >
                                <IconExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ))
                    ) : (
                      <span className="text-zinc-500 dark:text-zinc-400 italic">
                        No representatives listed
                      </span>
                    )}
                  </div>
                )}
              </div>

              {isEditingInfo && (
                <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                  <button
                    onClick={() => {
                      setIsEditingInfo(false);
                      setDiscordServer(ally.discordServer || "");
                      setTheirReps(
                        (
                          (props.infoTheirReps as TheirRepItem[]) || []
                        ).filter((r: TheirRepItem) => r.username?.trim()),
                      );
                      setTheirRepSearch("");
                      setTheirRepSearchResults([]);
                      setReps(ally.reps.map((r: any) => r.userid));
                    }}
                    className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveAllianceInfo}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Notes Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <IconClipboardList className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-zinc-900 dark:text-white">
                      Notes
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Keep track of additional information
                    </p>
                  </div>
                </div>
                {canAddNotes && (
                  <button
                    onClick={() => createNote()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <IconPlus className="w-4 h-4" />
                    <span className="text-sm font-medium">Add Note</span>
                  </button>
                )}
              </div>

              {notes.length === 0 ? (
                <div className="text-center py-8">
                  <div className="rounded-xl p-6 max-w-md mx-auto">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                      <IconClipboardList className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
                      No Notes
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      You haven't added any notes yet
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {notes.map((note: NoteItem, index: any) => (
                    <div
                      key={index}
                      className={`rounded-lg p-4 ${
                        note.type === "strike"
                          ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                          : note.type === "warning"
                          ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                          : "bg-zinc-50 dark:bg-zinc-700"
                      }`}
                    >
                      {/* Header row — type title/pills on left, action buttons on right */}
                      <div className="flex items-center justify-between mb-2">
                        {editNotes.includes(index) ? (
                          <div className="flex gap-2">
                            {(["note", "warning", "strike"] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => handleNoteTypeChange(index, t)}
                                className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                                  notes[index]?.type === t
                                    ? t === "strike"
                                      ? "bg-red-500 text-white"
                                      : t === "warning"
                                      ? "bg-amber-500 text-white"
                                      : "bg-primary text-white"
                                    : "bg-zinc-200 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-500"
                                }`}
                              >
                                {t === "note"
                                  ? "Note"
                                  : t === "warning"
                                  ? "⚠ Warning"
                                  : "✕ Strike"}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              note.type === "strike"
                                ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"
                                : note.type === "warning"
                                ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                                : "bg-zinc-200 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300"
                            }`}
                          >
                            {note.type === "warning" && <IconAlertTriangle className="w-3 h-3" />}
                            {note.type === "strike" && <IconAlertOctagon className="w-3 h-3" />}
                            {note.type === "warning"
                              ? "Warning"
                              : note.type === "strike"
                              ? "Strike"
                              : "Note"}
                          </span>
                        )}
                        {(canEditNotes ||
                          (canAddNotes && newNotes.includes(index)) ||
                          canDeleteNotes) && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {(canEditNotes ||
                              (canAddNotes && newNotes.includes(index))) && (
                              <button
                                onClick={() => noteEdit(index)}
                                className="p-1 text-zinc-400 hover:text-primary transition-colors"
                              >
                                <IconPencil className="w-4 h-4" />
                              </button>
                            )}
                            {canDeleteNotes && (
                              <button
                                onClick={() => deleteNote(index)}
                                className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                              >
                                <IconTrash className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Body */}
                      {editNotes.includes(index) ? (
                        <textarea
                          className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                          value={notes[index]?.content ?? ""}
                          onChange={(e) => handleNoteChange(e, index)}
                          onBlur={handleNoteBlur}
                          rows={3}
                          placeholder="Enter your note here..."
                        />
                      ) : (
                        <p className="text-sm text-zinc-700 dark:text-white">
                          {note.content}
                        </p>
                      )}
                      {/* Posted / edited metadata */}
                      {(note.postedBy || note.editedBy) && (
                        <div className="mt-2 flex flex-col gap-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                          {note.postedBy && (
                            <span>
                              Posted by{" "}
                              <span className="font-medium text-zinc-500 dark:text-zinc-400">{note.postedBy}</span>
                              {note.postedAt && (
                                <> &middot; {moment(note.postedAt).format("MMM D, YYYY [at] h:mm A")}</>
                              )}
                            </span>
                          )}
                          {note.editedBy && (
                            <span>
                              Last edited by{" "}
                              <span className="font-medium text-zinc-500 dark:text-zinc-400">{note.editedBy}</span>
                              {note.editedAt && (
                                <> &middot; {moment(note.editedAt).format("MMM D, YYYY [at] h:mm A")}</>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {(canAddNotes || canEditNotes) && (
                    <button
                      onClick={() => saveNotes()}
                      className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                    >
                      Save Notes
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Visits Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <IconCalendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-zinc-900 dark:text-white">
                      Scheduled Events
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Schedule and manage alliance visits and events
                    </p>
                  </div>
                </div>
                {canAddVisits && (
                  <button
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <IconPlus className="w-4 h-4" />
                    <span className="text-sm font-medium">New Event</span>
                  </button>
                )}
              </div>

              {visits.length === 0 ? (
                <div className="text-center py-8">
                  <div className="rounded-xl p-6 max-w-md mx-auto">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                      <IconCalendar className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-sm font-medium text-zinc-900 mb-1 dark:text-white">
                      No Scheduled Events
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      You haven't scheduled any events yet
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                  {visits.map((visit: any) => (
                    <div
                      key={visit.id}
                      className="bg-zinc-50 dark:bg-zinc-700 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="text-sm font-medium dark:text-white text-zinc-900">
                              {visit.name}
                            </h3>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                visit.eventType === "event"
                                  ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400"
                                  : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400"
                              }`}
                            >
                              {visit.eventType === "event" ? "Event" : "Visit"}
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                visit.hostRole === "attending"
                                  ? "bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300"
                                  : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                              }`}
                            >
                              {visit.hostRole === "attending"
                                ? "Attending"
                                : "Hosting"}
                            </span>
                          </div>
                          {visit.description && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
                              {visit.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <div
                              className={`w-6 h-6 p-0.5 rounded-full flex items-center justify-center ${getRandomBg(
                                visit.hostId,
                              )} border-2 border-white`}
                            >
                              <img
                                src={visit.hostThumbnail}
                                className="w-full h-full rounded-full object-cover"
                                alt={visit.hostUsername}
                                style={{ background: "transparent" }}
                              />
                            </div>
                            <p className="text-xs dark:text-zinc-400 text-zinc-500">
                              {visit.hostRole === "attending"
                                ? "Attending"
                                : "Hosted by"}{" "}
                              {visit.hostUsername}
                            </p>
                          </div>
                          <p className="text-xs dark:text-zinc-400 text-zinc-500 mt-1">
                            {new Date(visit.time).toLocaleDateString()} at{" "}
                            {new Date(visit.time)
                              .getHours()
                              .toString()
                              .padStart(2, "0")}
                            :
                            {new Date(visit.time)
                              .getMinutes()
                              .toString()
                              .padStart(2, "0")}
                          </p>
                          {visit.participants &&
                            visit.participants.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                                  Participants ({visit.participants.length})
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {visit.participants
                                    .slice(0, 5)
                                    .map((participantId: number) => {
                                      const participant = users.find(
                                        (u: any) =>
                                          Number(u.userid) === participantId,
                                      );
                                      return participant ? (
                                        <span
                                          key={participantId}
                                          className="text-xs bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded"
                                        >
                                          {participant.username}
                                        </span>
                                      ) : null;
                                    })}
                                  {visit.participants.length > 5 && (
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                      +{visit.participants.length - 5} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                        {(canEditVisits || canDeleteVisits) && (
                          <div className="flex items-center gap-1">
                            {canEditVisits && (
                              <button
                                onClick={() =>
                                  editVisit(
                                    visit.id,
                                    visit.name,
                                    visit.time,
                                    visit.eventType,
                                    visit.description,
                                    visit.hostRole,
                                    visit.participants,
                                  )
                                }
                                className="p-1 text-zinc-400 hover:text-primary transition-colors"
                              >
                                <IconPencil className="w-4 h-4" />
                              </button>
                            )}
                            {canDeleteVisits && (
                              <button
                                onClick={() => deleteVisit(visit.id)}
                                className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                              >
                                <IconTrash className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

ManageAlly.layout = workspace;

export default ManageAlly;
