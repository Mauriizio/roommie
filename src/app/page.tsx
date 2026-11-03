"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArchiveRestore,
  Bell,
  Bolt,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Droplets,
  EyeOff,
  House,
  ImagePlus,
  LogOut,
  Menu,
  Pencil,
  Plus,
  ReceiptText,
  Settings,
  ShoppingBasket,
  Sparkles,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import type {
  Bill,
  Completion,
  Household,
  Meter,
  Product,
  Purchase,
  Reading,
  Task,
} from "@/lib/types";
import {
  dateInput,
  formatDate,
  initials,
  nextReminder,
  relativeDayCount,
  timeAgo,
  zonedDateToISO,
} from "@/lib/utils";
import {
  compareBill,
  consumptionBetween,
  sameBillingPeriod,
} from "@/lib/electricity";
import {
  billSchema,
  completionSchema,
  firstIssueMessage,
  householdNameSchema,
  productSchema,
  purchaseSchema,
  readingSchema,
  taskSchema,
} from "@/lib/validation";

type Section = "home" | "purchases" | "cleaning" | "electricity" | "settings";
type Notice = { text: string; error?: boolean };
const supabase = () => createClient();

export default function HomePage() {
  const [user, setUser] = useState<{
    id: string;
    email?: string;
    name: string;
  } | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [section, setSection] = useState<Section>("home");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [authMode, setAuthMode] = useState<
    "login" | "signup" | "reset" | "update"
  >("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [homeName, setHomeName] = useState("Nuestro hogar");
  const [inviteInput, setInviteInput] = useState("");
  const [modal, setModal] = useState<
    "purchase" | "product" | "task" | "completion" | "reading" | "bill" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [inactiveProducts, setInactiveProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inactiveTasks, setInactiveTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [meter, setMeter] = useState<Meter | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [householdMembers, setHouseholdMembers] = useState<
    { user_id: string; role: string }[]
  >([]);
  const [inviteLink, setInviteLink] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const flash = useCallback((text: string, error = false) => {
    setNotice({ text, error });
    window.setTimeout(() => setNotice(null), 4200);
  }, []);

  const loadData = useCallback(
    async (houseId: string) => {
      const db = supabase();
      const [p, pr, t, c, m, r, b, hm] = await Promise.all([
        db
          .from("products")
          .select("*")
          .eq("household_id", houseId)
          .order("name"),
        db
          .from("purchase_records")
          .select("*,products(name)")
          .eq("household_id", houseId)
          .order("purchased_at", { ascending: false })
          .limit(60),
        db
          .from("household_tasks")
          .select("*")
          .eq("household_id", houseId)
          .order("name"),
        db
          .from("task_completions")
          .select("*,household_tasks(name)")
          .eq("household_id", houseId)
          .order("completed_at", { ascending: false })
          .limit(60),
        db
          .from("electric_meters")
          .select("*")
          .eq("household_id", houseId)
          .limit(1)
          .maybeSingle(),
        db
          .from("meter_readings")
          .select("*")
          .eq("household_id", houseId)
          .order("read_at", { ascending: true }),
        db
          .from("electricity_bills")
          .select("*")
          .eq("household_id", houseId)
          .order("period_end", { ascending: false }),
        db
          .from("household_members")
          .select("user_id,role")
          .eq("household_id", houseId),
      ]);
      const errors = [
        p.error,
        pr.error,
        t.error,
        c.error,
        m.error,
        r.error,
        b.error,
        hm.error,
      ].filter(Boolean);
      if (errors.length) {
        console.error("Error al sincronizar ROOMMIE", errors);
        flash(
          "No se pudieron actualizar algunos datos. Intenta de nuevo.",
          true,
        );
      }
      setProducts(((p.data ?? []) as Product[]).filter((x) => x.active));
      setInactiveProducts(
        ((p.data ?? []) as Product[]).filter((x) => !x.active),
      );
      setPurchases((pr.data ?? []) as Purchase[]);
      setTasks(((t.data ?? []) as Task[]).filter((x) => x.active));
      setInactiveTasks(((t.data ?? []) as Task[]).filter((x) => !x.active));
      setCompletions((c.data ?? []) as Completion[]);
      setMeter((m.data as Meter | null) ?? null);
      setReadings((r.data ?? []) as Reading[]);
      setBills((b.data ?? []) as Bill[]);
      setHouseholdMembers(
        (hm.data ?? []) as { user_id: string; role: string }[],
      );
      const authors = [
        ...((pr.data ?? []) as unknown as { created_by: string }[]),
        ...((c.data ?? []) as unknown as { created_by: string }[]),
        ...((r.data ?? []) as unknown as { created_by: string }[]),
        ...((hm.data ?? []) as unknown as { user_id: string }[]),
      ];
      const ids = [
        ...new Set(
          authors.map((x) => ("created_by" in x ? x.created_by : x.user_id)),
        ),
      ];
      if (ids.length) {
        const { data: ps } = await db
          .from("profiles")
          .select("id,display_name")
          .in("id", ids);
        setProfiles(
          Object.fromEntries(
            ((ps ?? []) as { id: string; display_name: string }[]).map((x) => [
              x.id,
              x.display_name,
            ]),
          ),
        );
      }
    },
    [flash],
  );

  const initialize = useCallback(async () => {
    try {
      const db = supabase();
      const {
        data: { user: current },
        error,
      } = await db.auth.getUser();
      if (error) throw error;
      if (!current) {
        setUser(null);
        setHousehold(null);
        setLoading(false);
        return;
      }
      if (
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("password") === "1"
      )
        setAuthMode("update");
      const name = String(
        current.user_metadata?.display_name ||
          current.email?.split("@")[0] ||
          "Roommie",
      );
      setUser({ id: current.id, email: current.email, name });
      const { data: membership, error: membershipError } = await db
        .from("household_members")
        .select("household_id")
        .eq("user_id", current.id)
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (membership) {
        const { data: h, error: he } = await db
          .from("households")
          .select("*")
          .eq("id", membership.household_id)
          .single();
        if (he) throw he;
        setHousehold(h as Household);
        await loadData(membership.household_id);
      } else setHousehold(null);
    } catch (e) {
      console.error(e);
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) flash(errorText(e), true);
    }
    setLoading(false);
  }, [loadData, flash]);

  const acceptInvite = useCallback(
    async (token: string) => {
      if (!token) return;
      try {
        const clean = token
          .trim()
          .split(/[?&]/)
          .pop()!
          .replace(/^invite=/, "");
        const { error } = await supabase().rpc("accept_household_invitation", {
          invite_token: clean,
        });
        if (error) throw error;
        history.replaceState({}, "", location.pathname);
        setInviteInput("");
        flash("¡Listo! Ya estás conectado al hogar.");
        await initialize();
      } catch (e) {
        flash(errorText(e), true);
      }
    },
    [flash, initialize],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void initialize(), 0);
    return () => window.clearTimeout(timer);
  }, [initialize]);
  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )
      return;
    const db = supabase();
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange(() => {
      window.setTimeout(() => void initialize(), 0);
    });
    return () => subscription.unsubscribe();
  }, [initialize]);
  useEffect(() => {
    if (!household) return;
    const db = supabase();
    const channel = db
      .channel(`roommie-${household.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `household_id=eq.${household.id}`,
        },
        () => void loadData(household.id),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "purchase_records",
          filter: `household_id=eq.${household.id}`,
        },
        () => void loadData(household.id),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "product_status_events",
          filter: `household_id=eq.${household.id}`,
        },
        () => void loadData(household.id),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "household_tasks",
          filter: `household_id=eq.${household.id}`,
        },
        () => void loadData(household.id),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_completions",
          filter: `household_id=eq.${household.id}`,
        },
        () => void loadData(household.id),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meter_readings",
          filter: `household_id=eq.${household.id}`,
        },
        () => void loadData(household.id),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "electricity_bills",
          filter: `household_id=eq.${household.id}`,
        },
        () => void loadData(household.id),
      )
      .subscribe();
    const refresh = () => void loadData(household.id);
    window.addEventListener("focus", refresh);
    return () => {
      void db.removeChannel(channel);
      window.removeEventListener("focus", refresh);
    };
  }, [household, loadData]);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const token = new URLSearchParams(window.location.search).get("invite");
    if (token) window.setTimeout(() => void acceptInvite(token), 0);
  }, [user, acceptInvite]);

  async function submitAuth(e: FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    try {
      const db = supabase();
      if (authMode === "update") {
        const { error } = await db.auth.updateUser({ password: authPassword });
        if (error) throw error;
        history.replaceState({}, "", location.pathname);
        setAuthPassword("");
        setAuthMode("login");
        flash("Contraseña actualizada. Ya puedes continuar.");
      } else if (authMode === "signup") {
        const { data, error } = await db.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: { display_name: authName },
            emailRedirectTo: `${location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (!data.session)
          flash(
            "Revisa tu correo para confirmar la cuenta y luego inicia sesión.",
          );
        else flash("Cuenta creada. ¡Bienvenido a ROOMMIE!");
      } else if (authMode === "reset") {
        const next = encodeURIComponent("/?password=1");
        const { error } = await db.auth.resetPasswordForEmail(authEmail, {
          redirectTo: `${location.origin}/auth/callback?next=${next}`,
        });
        if (error) throw error;
        flash(
          "Si el correo está registrado, recibirás un enlace para restablecer la contraseña.",
        );
      } else {
        const { error } = await db.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
      }
    } catch (e) {
      flash(errorText(e), true);
    } finally {
      setAuthBusy(false);
    }
  }
  async function signOut() {
    await supabase().auth.signOut();
    setUser(null);
    setHousehold(null);
    setSection("home");
  }
  async function createHome(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const validName = householdNameSchema.safeParse(homeName);
    if (!validName.success) {
      flash(firstIssueMessage(validName.error), true);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase().rpc("create_household", {
        household_name: validName.data,
      });
      if (error) throw error;
      flash("Hogar creado. Ahora puedes invitar a tu roommate.");
      await initialize();
    } catch (e) {
      flash(errorText(e), true);
    } finally {
      setBusy(false);
    }
  }
  async function makeInvite() {
    if (!household || !user) return;
    setBusy(true);
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const token = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const { error } = await supabase()
        .from("household_invitations")
        .insert({
          household_id: household.id,
          token,
          created_by: user.id,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        });
      if (error) throw error;
      const link = `${location.origin}/?invite=${token}`;
      setInviteLink(link);
      await navigator.clipboard.writeText(link);
      flash("Enlace copiado. Es válido por 7 días y para una sola persona.");
    } catch (e) {
      flash(errorText(e), true);
    } finally {
      setBusy(false);
    }
  }
  async function upload(
    file: File | undefined,
    required = false,
    allowPdf = false,
  ) {
    if (!file || (file.size === 0 && file.name === "")) {
      if (required) throw new Error("Agrega una fotografía para continuar.");
      return null;
    }
    const allowedTypes = allowPdf
      ? ["image/jpeg", "image/png", "image/webp", "application/pdf"]
      : ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type))
      throw new Error(
        allowPdf
          ? "Formato no admitido. Usa JPG, PNG, WebP o PDF."
          : "La fotografía debe ser JPG, PNG o WebP.",
      );
    if (file.size > 8 * 1024 * 1024)
      throw new Error("El archivo supera el límite de 8 MB.");
    if (!household || !user)
      throw new Error("Inicia sesión para adjuntar archivos.");
    const ext =
      file.name
        .split(".")
        .pop()
        ?.replace(/[^a-z0-9]/gi, "")
        .toLowerCase() || "jpg";
    const path = `${household.id}/${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase()
      .storage.from("roommie-private")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
  }
  async function addProduct(name: string, category: string | null = null) {
    if (!household || !user) throw new Error("El hogar no está disponible.");
    const validProduct = productSchema.safeParse({ name, category });
    if (!validProduct.success)
      throw new Error(firstIssueMessage(validProduct.error));
    const { data, error } = await supabase()
      .from("products")
      .insert({
        household_id: household.id,
        created_by: user.id,
        name: validProduct.data.name,
        category: validProduct.data.category,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505")
        throw new Error("Ya existe un producto activo con ese nombre.");
      throw error;
    }
    return data as Product;
  }
  async function submitPurchase(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!household || !user) return;
    setBusy(true);
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      let productId = String(f.get("product") || "");
      if (productId === "__new__") {
        const newProduct = await addProduct(String(f.get("newName")));
        productId = newProduct.id;
        setProducts((existing) => [newProduct, ...existing]);
        window.setTimeout(() => {
          const select = form.elements.namedItem("product");
          if (select instanceof HTMLSelectElement) select.value = productId;
        }, 0);
      }
      if (!productId) throw new Error("Elige un producto.");
      const validPurchase = purchaseSchema.safeParse({
        purchasedAt: String(f.get("date")),
        quantity: f.get("quantity") ? Number(f.get("quantity")) : null,
        unit: String(f.get("unit") || ""),
        notes: String(f.get("notes") || "") || null,
      });
      if (!validPurchase.success)
        throw new Error(firstIssueMessage(validPurchase.error));
      const photo = await upload(f.get("photo") as File | undefined);
      const { error } = await supabase()
        .from("purchase_records")
        .insert({
          household_id: household.id,
          product_id: productId,
          created_by: user.id,
          purchased_at: zonedDateToISO(validPurchase.data.purchasedAt),
          quantity: validPurchase.data.quantity,
          unit: validPurchase.data.unit || null,
          photo_path: photo,
          notes: validPurchase.data.notes,
        });
      if (error) throw error;
      await loadData(household.id);
      setModal(null);
      flash("Compra registrada. El historial ya está actualizado.");
    } catch (e) {
      flash(errorText(e), true);
    } finally {
      setBusy(false);
    }
  }
  async function addTask(name: string, frequency: number | null) {
    if (!household || !user) throw new Error("El hogar no está disponible.");
    const validTask = taskSchema.safeParse({ name, frequencyDays: frequency });
    if (!validTask.success) throw new Error(firstIssueMessage(validTask.error));
    const { error } = await supabase()
      .from("household_tasks")
      .insert({
        household_id: household.id,
        created_by: user.id,
        name: validTask.data.name,
        frequency_days: validTask.data.frequencyDays,
      });
    if (error) {
      if (error.code === "23505")
        throw new Error("Ya existe una tarea con ese nombre.");
      throw error;
    }
  }
  async function submitCompletion(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!household || !user) return;
    setBusy(true);
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      let taskId = String(f.get("task") || "");
      const validCompletion = completionSchema.safeParse({
        completedAt: String(f.get("date")),
        frequencyDays:
          taskId === "__new__" && f.get("frequency")
            ? Number(f.get("frequency"))
            : null,
        notes: String(f.get("notes") || "") || null,
      });
      if (!validCompletion.success)
        throw new Error(firstIssueMessage(validCompletion.error));
      if (taskId === "__new__") {
        const newName = String(f.get("newName"));
        await addTask(
          newName,
          validCompletion.data.frequencyDays,
        );
        const { data, error } = await supabase()
          .from("household_tasks")
          .select("id")
          .eq("household_id", household.id)
          .eq("name", newName.trim())
          .single();
        if (error) throw error;
        taskId = data.id;
        window.setTimeout(() => {
          const select = form.elements.namedItem("task");
          if (select instanceof HTMLSelectElement) select.value = taskId;
        }, 0);
      }
      if (!taskId) throw new Error("Elige una actividad.");
      const photo = await upload(f.get("photo") as File | undefined);
      const { error } = await supabase()
        .from("task_completions")
        .insert({
          household_id: household.id,
          task_id: taskId,
          created_by: user.id,
          completed_at: zonedDateToISO(validCompletion.data.completedAt),
          photo_path: photo,
          notes: validCompletion.data.notes,
        });
      if (error) throw error;
      await loadData(household.id);
      setModal(null);
      flash("Actividad guardada en la bitácora compartida.");
    } catch (e) {
      flash(errorText(e), true);
    } finally {
      setBusy(false);
    }
  }
  async function toggleReplenish(product: Product) {
    if (!user || !household) return;
    const status = product.status === "replenish" ? "available" : "replenish";
    const { error } = await supabase()
      .from("products")
      .update({ status })
      .eq("id", product.id)
      .eq("household_id", household.id);
    if (error) flash(errorText(error), true);
    else {
      setProducts((ps) =>
        ps.map((x) => (x.id === product.id ? { ...x, status } : x)),
      );
      flash(
        status === "replenish"
          ? "Marcado como “Se está acabando”."
          : "Aviso de reposición retirado.",
      );
    }
  }
  async function submitReading(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!household || !user) return;
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      if (!meter) throw new Error("Configura un medidor primero.");
      const readAt = zonedDateToISO(
        String(f.get("date")),
        String(f.get("time") || "12:00"),
      );
      const validReading = readingSchema.safeParse({
        readAt,
        valueKwh: Number(f.get("value")),
        notes: String(f.get("notes") || "") || null,
      });
      if (!validReading.success)
        throw new Error(firstIssueMessage(validReading.error));
      const photo = await upload(f.get("photo") as File | undefined, true);
      const { error } = await supabase()
        .from("meter_readings")
        .insert({
          household_id: household.id,
          meter_id: meter.id,
          created_by: user.id,
          read_at: validReading.data.readAt,
          value_kwh: validReading.data.valueKwh,
          photo_path: photo,
          notes: validReading.data.notes,
        });
      if (error) {
        if (error.code === "23505")
          throw new Error(
            "Ya hay una lectura en esa fecha. Revisa el historial para evitar duplicados.",
          );
        throw error;
      }
      await loadData(household.id);
      setModal(null);
      flash(
        "Lectura guardada. El consumo se calculó con las lecturas registradas.",
      );
    } catch (e) {
      flash(errorText(e), true);
    } finally {
      setBusy(false);
    }
  }
  async function submitBill(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!household || !user) return;
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const optionalNumber = (field: string) =>
        f.get(field) ? Number(f.get(field)) : null;
      const validBill = billSchema.safeParse({
        issuedAt: String(f.get("issued")),
        periodStart: String(f.get("start")),
        periodEnd: String(f.get("end")),
        initialReadingKwh: optionalNumber("initial"),
        finalReadingKwh: optionalNumber("final"),
        billedKwh: optionalNumber("billed"),
        amountClp: optionalNumber("amount"),
        otherChargesClp: optionalNumber("charges"),
        notes: String(f.get("notes") || "") || null,
      });
      if (!validBill.success)
        throw new Error(firstIssueMessage(validBill.error));
      const photo = await upload(f.get("photo") as File | undefined, false, true);
      const { error } = await supabase()
        .from("electricity_bills")
        .insert({
          household_id: household.id,
          created_by: user.id,
          distributor: f.get("distributor") || null,
          issued_at: validBill.data.issuedAt,
          period_start: validBill.data.periodStart,
          period_end: validBill.data.periodEnd,
          initial_reading_kwh: validBill.data.initialReadingKwh,
          final_reading_kwh: validBill.data.finalReadingKwh,
          billed_kwh: validBill.data.billedKwh,
          amount_clp: validBill.data.amountClp,
          other_charges_clp: validBill.data.otherChargesClp,
          photo_path: photo,
          notes: validBill.data.notes,
        });
      if (error) throw error;
      await loadData(household.id);
      setModal(null);
      flash("Boleta guardada.");
    } catch (e) {
      flash(errorText(e), true);
    } finally {
      setBusy(false);
    }
  }
  async function editHousehold() {
    if (!household) return;
    const name = prompt("Nombre del hogar", household.name);
    if (!name?.trim()) return;
    const { error } = await supabase()
      .from("households")
      .update({ name: name.trim() })
      .eq("id", household.id);
    if (error) flash(errorText(error), true);
    else {
      setHousehold({ ...household, name: name.trim() });
      flash("Nombre del hogar actualizado.");
    }
  }
  async function changeProfile() {
    if (!user) return;
    const name = prompt("Nombre para mostrar", user.name);
    if (!name?.trim()) return;
    const { error } = await supabase()
      .from("profiles")
      .update({ display_name: name.trim() })
      .eq("id", user.id);
    if (error) flash(errorText(error), true);
    else {
      setUser({ ...user, name: name.trim() });
      flash("Perfil actualizado.");
    }
  }
  async function toggleTask(task: Task) {
    const { error } = await supabase()
      .from("household_tasks")
      .update({ active: !task.active })
      .eq("id", task.id);
    if (error) flash(errorText(error), true);
    else if (household) await loadData(household.id);
  }
  async function editProduct(product: Product) {
    const name = prompt("Nombre del producto", product.name);
    if (!name?.trim()) return;
    const category = prompt("Categoría (opcional)", product.category || "");
    if (category === null) return;
    const { error } = await supabase()
      .from("products")
      .update({ name: name.trim(), category: category.trim() || null })
      .eq("id", product.id);
    if (error)
      flash(
        error.code === "23505"
          ? "Ya existe un producto activo con ese nombre."
          : errorText(error),
        true,
      );
    else if (household) {
      await loadData(household.id);
      flash("Producto actualizado.");
    }
  }
  async function archiveProduct(product: Product) {
    if (
      !confirm(
        `¿Desactivar “${product.name}”? Su historial de compras se conservará.`,
      )
    )
      return;
    const { error } = await supabase()
      .from("products")
      .update({ active: false })
      .eq("id", product.id);
    if (error) flash(errorText(error), true);
    else if (household) {
      await loadData(household.id);
      flash("Producto desactivado. El historial sigue guardado.");
    }
  }
  async function editTask(task: Task) {
    const name = prompt("Nombre de la actividad", task.name);
    if (!name?.trim()) return;
    const frequency = prompt(
      "Frecuencia orientativa en días (opcional)",
      task.frequency_days ? String(task.frequency_days) : "",
    );
    if (frequency === null) return;
    const { error } = await supabase()
      .from("household_tasks")
      .update({
        name: name.trim(),
        frequency_days: frequency ? Number(frequency) : null,
      })
      .eq("id", task.id);
    if (error)
      flash(
        error.code === "23505"
          ? "Ya existe una actividad con ese nombre."
          : errorText(error),
        true,
      );
    else if (household) {
      await loadData(household.id);
      flash("Actividad actualizada.");
    }
  }
  async function restoreProduct(product: Product) {
    const { error } = await supabase()
      .from("products")
      .update({ active: true })
      .eq("id", product.id);
    if (error)
      flash(
        error.code === "23505"
          ? "Hay un producto activo con ese mismo nombre."
          : errorText(error),
        true,
      );
    else if (household) await loadData(household.id);
  }
  async function restoreTask(task: Task) {
    const { error } = await supabase()
      .from("household_tasks")
      .update({ active: true })
      .eq("id", task.id);
    if (error)
      flash(
        error.code === "23505"
          ? "Hay una actividad activa con ese mismo nombre."
          : errorText(error),
        true,
      );
    else if (household) await loadData(household.id);
  }
  async function openPhoto(path: string | null) {
    if (!path) return;
    const { data, error } = await supabase()
      .storage.from("roommie-private")
      .createSignedUrl(path, 180);
    if (error) flash("No se pudo abrir el archivo privado.", true);
    else if (data?.signedUrl)
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const lastPurchaseFor = (id: string) =>
    purchases.find((p) => p.product_id === id);
  const lastCompletionFor = (id: string) =>
    completions.find((c) => c.task_id === id);
  const orderedReadings = [...readings].sort(
    (a, b) => new Date(a.read_at).getTime() - new Date(b.read_at).getTime(),
  );
  const previousReading =
      orderedReadings.length > 1 ? orderedReadings.at(-2) : undefined,
    latestReading = orderedReadings.at(-1);
  const consumption =
    previousReading && latestReading
      ? consumptionBetween(
          Number(previousReading.value_kwh),
          Number(latestReading.value_kwh),
          previousReading.read_at,
          latestReading.read_at,
        )
      : null;
  const reminder = nextReminder(meter?.reminder_day ?? 20),
    daysUntil = relativeDayCount(reminder);
  const activity = useMemo(
    () =>
      [
        ...purchases
          .slice(0, 7)
          .map((p) => ({
            date: p.purchased_at,
            title: `${profiles[p.created_by] || "Un integrante"} registró una compra de ${p.products?.name || "un producto"}`,
            icon: ShoppingBasket,
            color: "violet",
          })),
        ...completions
          .slice(0, 7)
          .map((c) => ({
            date: c.completed_at,
            title: `${profiles[c.created_by] || "Un integrante"} registró ${c.household_tasks?.name || "una actividad"}`,
            icon: Sparkles,
            color: "coral",
          })),
        ...readings
          .slice(-5)
          .map((r) => ({
            date: r.read_at,
            title: `${profiles[r.created_by] || "Un integrante"} registró una lectura del medidor`,
            icon: Bolt,
            color: "teal",
          })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8),
    [purchases, completions, readings, profiles],
  );

  if (loading)
    return (
      <main className="loader-screen">
        <span className="loader-mark">
          <Image src="/roommie-logo.png" alt="ROOMMIE" width={68} height={68} />
        </span>
        <p>Preparando tu hogar...</p>
      </main>
    );
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return <SetupScreen />;
  if (
    user &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("password") === "1"
  )
    return (
      <AuthScreen
        mode="update"
        setMode={setAuthMode}
        email={authEmail || user.email || ""}
        setEmail={setAuthEmail}
        password={authPassword}
        setPassword={setAuthPassword}
        name={authName}
        setName={setAuthName}
        busy={authBusy}
        onSubmit={submitAuth}
        notice={notice}
      />
    );
  if (!user)
    return (
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        email={authEmail}
        setEmail={setAuthEmail}
        password={authPassword}
        setPassword={setAuthPassword}
        name={authName}
        setName={setAuthName}
        busy={authBusy}
        onSubmit={submitAuth}
        notice={notice}
      />
    );
  if (!household)
    return (
      <main className="onboarding">
        <div className="onboard-card">
          <Brand />
          <p className="eyebrow">TU ESPACIO COMPARTIDO</p>
          <h1>Un hogar, muchas cosas que recordar.</h1>
          <p className="muted">
            ROOMMIE ayuda a registrar y recordar, sin imponer. Crea un hogar o
            únete con una invitación.
          </p>
          <form onSubmit={createHome} className="stack-form">
            <label>
              Nombre del hogar
              <input
                value={homeName}
                onChange={(e) => setHomeName(e.target.value)}
                maxLength={80}
                required
              />
            </label>
            <button className="primary-btn" disabled={busy}>
              {busy ? "Creando…" : "Crear hogar"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="join-separator">
            <span />o<span />
          </div>
          <form
            className="join-form"
            onSubmit={(e) => {
              e.preventDefault();
              void acceptInvite(inviteInput);
            }}
          >
            <label>
              ¿Tienes un enlace o código de invitación?
              <input
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                placeholder="Pega el enlace o código"
                required
              />
            </label>
            <button className="secondary-btn" disabled={busy}>
              Unirme al hogar
            </button>
          </form>
          <button className="text-btn signout-btn" onClick={signOut}>
            <LogOut size={15} /> Cerrar sesión
          </button>
        </div>
        <NoticeToast notice={notice} />
      </main>
    );
  const nav: [Section, string, typeof House][] = [
    ["home", "Inicio", House],
    ["purchases", "Compras", ShoppingBasket],
    ["cleaning", "Limpieza", Sparkles],
    ["electricity", "Electricidad", Bolt],
  ];
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Brand />
        <div className="house-pill">
          <span className="house-icon">
            <House size={16} />
          </span>
          <span>
            <small>HOGAR</small>
            <strong>{household.name}</strong>
          </span>
          <ChevronRight size={15} />
        </div>
        <nav className="side-nav">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={section === id ? "active" : ""}
              onClick={() => setSection(id)}
            >
              <Icon size={19} />
              {label}
              {id === "purchases" &&
              products.some((p) => p.status === "replenish") ? (
                <i className="nav-dot" />
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={section === "settings" ? "active" : ""}
            onClick={() => setSection("settings")}
          >
            <Settings size={18} />
            Configuración
          </button>
          <button onClick={signOut}>
            <LogOut size={18} />
            Cerrar sesión
          </button>
          <div className="profile-mini">
            <span className="avatar">{initials(user.name)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
          </div>
        </div>
      </aside>
      <header className="mobile-header">
        <button
          className="icon-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Abrir menú"
        >
          <Menu size={21} />
        </button>
        <Brand compact />
        <button
          className="avatar avatar-small"
          onClick={() => setSection("settings")}
        >
          {initials(user.name)}
        </button>
      </header>
      {menuOpen && (
        <div className="mobile-menu">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => {
                setSection(id);
                setMenuOpen(false);
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
          <button
            onClick={() => {
              setSection("settings");
              setMenuOpen(false);
            }}
          >
            <Settings size={18} />
            Configuración
          </button>
          <button onClick={signOut}>
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      )}
      <main className="main-content">
        {section === "home" && (
          <>
            <div className="welcome-row">
              <div>
                <p className="eyebrow">MARTES, 3 DE NOVIEMBRE</p>
                <h1>
                  Hola, {user.name.split(" ")[0]}{" "}
                  <span className="wave">✳</span>
                </h1>
                <p className="muted">
                  Un vistazo tranquilo a lo que pasa en {household.name}.
                </p>
              </div>
              <button
                className="outline-btn settings-shortcut"
                onClick={() => setSection("settings")}
              >
                <Settings size={17} /> Ajustes del hogar
              </button>
            </div>
            <section className="hero-card">
              <div className="hero-orbit orbit-one" />
              <div className="hero-orbit orbit-two" />
              <div className="hero-copy">
                <span className="hero-kicker">
                  <Sparkles size={15} /> HOGAR EN SINTONÍA
                </span>
                <h2>
                  Un espacio compartido,
                  <br />a su propio ritmo.
                </h2>
                <p>
                  Todo lo importante, en un solo lugar. Sin turnos ni presión.
                </p>
              </div>
              <Image
                src="/roommie-logo.png"
                alt=""
                width={126}
                height={126}
                className="hero-logo"
              />
            </section>
            <div className="section-heading">
              <div>
                <p className="eyebrow">RESUMEN DE HOY</p>
                <h2>Tu hogar, de un vistazo</h2>
              </div>
              <span className="live-pill">
                <i /> Compartido
              </span>
            </div>
            <div className="overview-grid">
              <button
                className="overview-card overview-violet"
                onClick={() => setSection("purchases")}
              >
                <span className="overview-icon">
                  <ShoppingBasket size={19} />
                </span>
                <span className="overview-label">COMPRAS</span>
                <strong>
                  {products.filter((p) => p.status === "replenish").length
                    ? `${products.filter((p) => p.status === "replenish").length} por reponer`
                    : "Todo al día"}
                </strong>
                <small>
                  {purchases[0]
                    ? `Última: ${purchases[0].products?.name || "compra"} · ${formatDate(purchases[0].purchased_at)}`
                    : "Aún no hay compras registradas"}
                </small>
                <span className="card-arrow">
                  <ArrowRight size={17} />
                </span>
              </button>
              <button
                className="overview-card overview-coral"
                onClick={() => setSection("cleaning")}
              >
                <span className="overview-icon">
                  <Sparkles size={19} />
                </span>
                <span className="overview-label">BITÁCORA</span>
                <strong>
                  {completions[0]?.household_tasks?.name ||
                    "Actividades de casa"}
                </strong>
                <small>
                  {completions[0]
                    ? `${profiles[completions[0].created_by] || "Un integrante"} · ${timeAgo(completions[0].completed_at)}`
                    : "Registra la primera actividad"}
                </small>
                <span className="card-arrow">
                  <ArrowRight size={17} />
                </span>
              </button>
              <button
                className="overview-card overview-teal"
                onClick={() => setSection("electricity")}
              >
                <span className="overview-icon">
                  <Bolt size={19} />
                </span>
                <span className="overview-label">ELECTRICIDAD</span>
                <strong>
                  {consumption
                    ? `${consumption.kwh.toLocaleString("es-CL")} kWh`
                    : "Tu medidor, al día"}
                </strong>
                <small>
                  {latestReading
                    ? `Última lectura · ${formatDate(latestReading.read_at)}`
                    : `Lectura sugerida · ${formatDate(reminder.toISOString())}`}
                </small>
                <span className="card-arrow">
                  <ArrowRight size={17} />
                </span>
              </button>
            </div>
            {products.some((p) => p.status === "replenish") && (
              <section className="restock-strip">
                <span>
                  <Bell size={16} />
                </span>
                <div>
                  <strong>Algunos productos están por reponer</strong>
                  <p>
                    {products
                      .filter((p) => p.status === "replenish")
                      .map((p) => p.name)
                      .join(" · ")}
                  </p>
                </div>
                <button onClick={() => setSection("purchases")}>
                  Ver lista <ArrowRight size={15} />
                </button>
              </section>
            )}
            <section className="electric-reminder">
              <span className="reminder-icon">
                <Bolt size={18} />
              </span>
              <div className="reminder-copy">
                <span>RECORDATORIO COMPARTIDO</span>
                <strong>
                  {daysUntil === 0
                    ? "Hoy pueden registrar la lectura del medidor"
                    : `Próxima lectura sugerida: ${formatDate(reminder.toISOString())}`}
                </strong>
                <small>
                  {daysUntil === 0
                    ? "Cualquiera puede tomar y subir la foto."
                    : `Faltan ${daysUntil} ${daysUntil === 1 ? "día" : "días"} · Cualquiera puede registrarla.`}
                </small>
              </div>
              <button
                className="outline-btn"
                onClick={() => setModal("reading")}
              >
                <Plus size={16} /> Registrar lectura
              </button>
            </section>
            <div className="section-heading recent-heading">
              <div>
                <p className="eyebrow">MEMORIA COMPARTIDA</p>
                <h2>Actividad reciente</h2>
              </div>
              <Activity size={19} className="subtle-icon" />
            </div>
            <ActivityFeed
              items={activity}
              profiles={profiles}
              onOpen={() => setSection("purchases")}
            />
          </>
        )}
        {section === "purchases" && (
          <>
            <PageTitle
              eyebrow="LO QUE COMPARTEN"
              title="Compras"
              description="Un registro útil para recordar qué compraron y cuándo."
              action={
                <button
                  className="primary-btn"
                  onClick={() => setModal("purchase")}
                >
                  <Plus size={18} /> Registrar compra
                </button>
              }
            />
            <div className="replenish-note">
              <span className="replenish-dot" /> Marcar algo como “Se está
              acabando” solo avisa al hogar; nadie queda a cargo.
            </div>
            {products.length === 0 ? (
              <EmptyState
                icon={<ShoppingBasket size={22} />}
                title="Todavía no hay productos"
                text="Agreguen lo que acostumbran compartir. El catálogo queda abierto a sus necesidades."
                action={
                  <button
                    className="primary-btn"
                    onClick={() => setModal("product")}
                  >
                    <Plus size={17} /> Agregar primer producto
                  </button>
                }
              />
            ) : (
              <div className="product-grid">
                {products.map((p) => {
                  const last = lastPurchaseFor(p.id);
                  return (
                    <article className="product-card" key={p.id}>
                      <div
                        className={`product-illustration ${p.status === "replenish" ? "needs-restock" : ""}`}
                      >
                        <Droplets size={27} />
                        <span>{p.name.slice(0, 1).toUpperCase()}</span>
                      </div>
                      <div className="product-main">
                        <span
                          className={`status-label ${p.status === "replenish" ? "status-warning" : ""}`}
                        >
                          <i />
                          {p.status === "replenish"
                            ? "Por reponer"
                            : "Disponible"}
                        </span>
                        <h3>{p.name}</h3>
                        <p className="product-category">
                          {p.category || "Producto compartido"}
                        </p>
                        <div className="last-purchase">
                          <span>ÚLTIMA COMPRA</span>
                          {last ? (
                            <strong>
                              {profiles[last.created_by] || "Un integrante"} ·{" "}
                              {formatDate(last.purchased_at)}
                            </strong>
                          ) : (
                            <strong className="muted">Sin compras aún</strong>
                          )}
                          {last?.quantity && (
                            <small>
                              {last.quantity} {last.unit || ""}
                            </small>
                          )}
                        </div>
                        <div className="product-actions">
                          <button
                            className="icon-btn"
                            title="Editar producto"
                            onClick={() => void editProduct(p)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="icon-btn"
                            title="Desactivar producto"
                            onClick={() => void archiveProduct(p)}
                          >
                            <EyeOff size={14} />
                          </button>
                          <button
                            className="text-btn"
                            onClick={() => {
                              setSection("purchases");
                              document
                                .getElementById(`history-${p.id}`)
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "center",
                                });
                            }}
                          >
                            <Clock3 size={15} /> Historial
                          </button>
                          <button
                            className={
                              p.status === "replenish"
                                ? "restock-btn is-marked"
                                : "restock-btn"
                            }
                            onClick={() => void toggleReplenish(p)}
                          >
                            {p.status === "replenish" ? (
                              <>
                                <Check size={15} /> Quitar aviso
                              </>
                            ) : (
                              <>
                                <Bell size={15} /> Se está acabando
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <div id={`history-${p.id}`} className="history-anchor" />
                    </article>
                  );
                })}
                <button
                  className="add-card"
                  onClick={() => setModal("product")}
                >
                  <span>
                    <Plus size={21} />
                  </span>
                  <strong>Agregar otro producto</strong>
                  <small>Personalicen su catálogo</small>
                </button>
              </div>
            )}
            <div className="history-section">
              <h2>Historial de compras</h2>
              {purchases.length ? (
                <div className="table-card">
                  {purchases.map((p) => (
                    <div className="history-row" key={p.id}>
                      <span className="history-icon violet-icon">
                        <ShoppingBasket size={17} />
                      </span>
                      <div className="history-info">
                        <strong>{p.products?.name || "Producto"}</strong>
                        <small>
                          {profiles[p.created_by] || "Integrante"}
                          {p.quantity ? ` · ${p.quantity} ${p.unit || ""}` : ""}
                        </small>
                      </div>
                      <span className="history-date">
                        {formatDate(p.purchased_at)}
                      </span>
                      {p.photo_path && (
                        <button
                          className="icon-btn"
                          onClick={() => void openPhoto(p.photo_path)}
                          aria-label="Ver foto"
                        >
                          <ImagePlus size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">
                  Las compras que registren aparecerán aquí para mantener la
                  memoria del hogar.
                </p>
              )}
            </div>
          </>
        )}
        {section === "cleaning" && (
          <>
            <PageTitle
              eyebrow="MEMORIA DE CASA"
              title="Limpieza"
              description="Una bitácora compartida de lo que se ha hecho, sin turnos ni pendientes asignados."
              action={
                <button
                  className="primary-btn coral-btn"
                  onClick={() => setModal("completion")}
                >
                  <Plus size={18} /> Registrar actividad
                </button>
              }
            />
            <div className="gentle-note">
              <Sparkles size={17} />
              <span>
                Las frecuencias son orientativas. ROOMMIE recuerda fechas;
                ustedes deciden el ritmo.
              </span>
            </div>
            {tasks.length === 0 ? (
              <EmptyState
                icon={<Sparkles size={22} />}
                title="Empiecen su bitácora"
                text="Agreguen las actividades que les ayude recordar. No hay tareas obligatorias."
                action={
                  <button
                    className="primary-btn coral-btn"
                    onClick={() => setModal("task")}
                  >
                    <Plus size={17} /> Crear actividad
                  </button>
                }
              />
            ) : (
              <div className="task-grid">
                {tasks.map((task) => {
                  const last = lastCompletionFor(task.id);
                  return (
                    <article className="task-card" key={task.id}>
                      <div className="task-top">
                        <span className="task-icon">
                          <Sparkles size={18} />
                        </span>
                        <span className="frequency">
                          {task.frequency_days
                            ? `Orientativa · cada ${task.frequency_days} días`
                            : "Sin frecuencia"}
                        </span>
                      </div>
                      <h3>{task.name}</h3>
                      <div className="task-last">
                        {last ? (
                          <>
                            <span>
                              {profiles[last.created_by] || "Un integrante"} ·{" "}
                              {formatDate(last.completed_at)}
                            </span>
                            <strong>{timeAgo(last.completed_at)}</strong>
                          </>
                        ) : (
                          <>
                            <span>Aún no hay registros</span>
                            <strong>Cuando quieran</strong>
                          </>
                        )}
                      </div>
                      <div className="task-actions">
                        <button
                          className="text-btn"
                          onClick={() => void editTask(task)}
                        >
                          <Pencil size={13} /> Editar
                        </button>
                        <button
                          className="text-btn"
                          onClick={() => void toggleTask(task)}
                        >
                          <EyeOff size={13} /> Desactivar
                        </button>
                        <button
                          className="small-action coral-action"
                          onClick={() => setModal("completion")}
                        >
                          Registrar <ArrowRight size={15} />
                        </button>
                      </div>
                    </article>
                  );
                })}
                <button
                  className="add-card add-card-coral"
                  onClick={() => setModal("task")}
                >
                  <span>
                    <Plus size={21} />
                  </span>
                  <strong>Agregar actividad</strong>
                  <small>Personalicen su bitácora</small>
                </button>
              </div>
            )}
            <div className="history-section">
              <h2>Últimas actividades</h2>
              {completions.length ? (
                <div className="table-card">
                  {completions.map((c) => (
                    <div className="history-row" key={c.id}>
                      <span className="history-icon coral-icon">
                        <Sparkles size={17} />
                      </span>
                      <div className="history-info">
                        <strong>
                          {c.household_tasks?.name || "Actividad del hogar"}
                        </strong>
                        <small>
                          {profiles[c.created_by] || "Integrante"}
                          {c.notes ? ` · ${c.notes}` : ""}
                        </small>
                      </div>
                      <span className="history-date">
                        {formatDate(c.completed_at)}
                      </span>
                      {c.photo_path && (
                        <button
                          className="icon-btn"
                          onClick={() => void openPhoto(c.photo_path)}
                          aria-label="Ver foto"
                        >
                          <ImagePlus size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">
                  Cuando alguien registre una actividad, el historial aparecerá
                  aquí.
                </p>
              )}
            </div>
          </>
        )}
        {section === "electricity" && (
          <>
            <PageTitle
              eyebrow="CONSUMO DEL HOGAR"
              title="Electricidad"
              description="Lecturas verificables y boletas para entender el consumo entre fechas."
              action={
                <div className="inline-actions">
                  <button
                    className="outline-btn"
                    onClick={() => setModal("bill")}
                  >
                    <ReceiptText size={16} /> Agregar boleta
                  </button>
                  <button
                    className="primary-btn teal-btn"
                    onClick={() => setModal("reading")}
                  >
                    <Plus size={18} /> Nueva lectura
                  </button>
                </div>
              }
            />
            <section className="meter-highlight">
              <div className="meter-spark">
                <Bolt size={22} />
              </div>
              <div className="meter-copy">
                <span>{meter?.name || "Medidor principal"} · kWh</span>
                <strong>
                  {latestReading
                    ? `${Number(latestReading.value_kwh).toLocaleString("es-CL")} <small>kWh</small>`
                    : "Sin lecturas todavía"}
                </strong>
                <p>
                  {latestReading
                    ? `Última lectura · ${formatDate(latestReading.read_at)} · ${profiles[latestReading.created_by] || "Integrante"}`
                    : "Agrega una foto y lectura para comenzar el historial."}
                </p>
              </div>
              <div className="consumption-box">
                <span>CONSUMO DEL ÚLTIMO PERÍODO</span>
                <strong>
                  {consumption
                    ? `${consumption.kwh.toLocaleString("es-CL")} kWh`
                    : previousReading && latestReading
                      ? "Revisar lectura"
                      : "—"}
                </strong>
                <small>
                  {consumption?.averageDailyKwh !== null &&
                  consumption?.averageDailyKwh !== undefined
                    ? `Promedio ${consumption.averageDailyKwh.toLocaleString("es-CL")} kWh/día · `
                    : ""}
                  {previousReading && latestReading
                    ? `${formatDate(previousReading.read_at)} → ${formatDate(latestReading.read_at)}`
                    : "Se calcula al tener dos lecturas"}
                </small>
                {previousReading &&
                  latestReading &&
                  Number(latestReading.value_kwh) <
                    Number(previousReading.value_kwh) && (
                    <em>
                      La lectura disminuyó. Revisa reinicio o cambio de medidor.
                    </em>
                  )}
              </div>
            </section>
            <section className="chart-card">
              <div className="chart-title">
                <div>
                  <p className="eyebrow">HISTORIAL DE MEDIDOR</p>
                  <h2>Consumo entre lecturas</h2>
                </div>
                <span className="unit-chip">kWh por período</span>
              </div>
              {orderedReadings.length < 2 ? (
                <div className="chart-empty">
                  <Bolt size={23} />
                  <p>
                    Con dos lecturas o más podrás ver el consumo real entre
                    fechas.
                  </p>
                </div>
              ) : (
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={orderedReadings.slice(1).flatMap((r, i) => {
                        const amount = consumptionBetween(
                          Number(orderedReadings[i].value_kwh),
                          Number(r.value_kwh),
                          orderedReadings[i].read_at,
                          r.read_at,
                        );
                        return amount
                          ? [
                              {
                                period: formatDate(r.read_at),
                                consumo: amount.kwh,
                              },
                            ]
                          : [];
                      })}
                      margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="consumptionFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#47aaa1"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="95%"
                            stopColor="#47aaa1"
                            stopOpacity={0.01}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e9eeeb"
                      />
                      <XAxis
                        dataKey="period"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#89958f", fontSize: 11 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#89958f", fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(v) => [
                          `${Number(v).toLocaleString("es-CL")} kWh`,
                          "Consumo",
                        ]}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e8ecea",
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="consumo"
                        stroke="#399c93"
                        strokeWidth={2.5}
                        fill="url(#consumptionFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
            <div className="electric-columns">
              <section className="history-section electric-history">
                <h2>Lecturas registradas</h2>
                {orderedReadings.length ? (
                  <div className="table-card">
                    {[...orderedReadings].reverse().map((r, i, all) => (
                      <div className="history-row" key={r.id}>
                        <span className="history-icon teal-icon">
                          <Bolt size={17} />
                        </span>
                        <div className="history-info">
                          <strong>
                            {Number(r.value_kwh).toLocaleString("es-CL")} kWh
                          </strong>
                          <small>
                            {profiles[r.created_by] || "Integrante"} ·{" "}
                            {i + 1 < all.length
                              ? consumptionBetween(
                                  Number(all[i + 1].value_kwh),
                                  Number(r.value_kwh),
                                  all[i + 1].read_at,
                                  r.read_at,
                                )
                                ? `${consumptionBetween(Number(all[i + 1].value_kwh), Number(r.value_kwh), all[i + 1].read_at, r.read_at)?.kwh.toLocaleString("es-CL")} kWh desde la anterior`
                                : "Lectura menor que la anterior; revisar"
                              : "Primera lectura"}
                          </small>
                        </div>
                        <span className="history-date">
                          {formatDate(r.read_at)}
                        </span>
                        <button
                          className="icon-btn"
                          onClick={() => void openPhoto(r.photo_path)}
                          aria-label="Ver foto del medidor"
                        >
                          <ImagePlus size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    Aún no hay lecturas. La lectura debe llevar una foto del
                    medidor.
                  </p>
                )}
              </section>
              <section className="history-section">
                <h2>Boletas</h2>
                {bills.length ? (
                  <div className="table-card">
                    {bills.map((b) => (
                      <div className="history-row" key={b.id}>
                        <span className="history-icon violet-icon">
                          <ReceiptText size={17} />
                        </span>
                        <div className="history-info">
                          <strong>
                            {b.distributor || "Boleta eléctrica"}
                            {b.billed_kwh !== null
                              ? ` · ${Number(b.billed_kwh).toLocaleString("es-CL")} kWh`
                              : ""}
                          </strong>
                          <small>
                            {formatDate(b.period_start)} –{" "}
                            {formatDate(b.period_end)}
                            {b.amount_clp !== null
                              ? ` · $${Number(b.amount_clp).toLocaleString("es-CL")}`
                              : ""}
                          </small>
                        </div>
                        {b.photo_path && (
                          <button
                            className="icon-btn"
                            onClick={() => void openPhoto(b.photo_path)}
                            aria-label="Ver boleta"
                          >
                            <ImagePlus size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    Guarda las boletas para comparar períodos equivalentes.
                  </p>
                )}
              </section>
            </div>
            <section className="comparison-section">
              <div className="comparison-heading">
                <span className="history-icon">
                  <ReceiptText size={17} />
                </span>
                <div>
                  <h2>Medición y boleta</h2>
                  <p>
                    Solo se comparan períodos con fechas inicial y final
                    coincidentes.
                  </p>
                </div>
              </div>
              {bills.map((b) => {
                const start = String(b.period_start).slice(0, 10),
                  end = String(b.period_end).slice(0, 10);
                const own = orderedReadings.find(
                  (r, i) =>
                    i > 0 &&
                    sameBillingPeriod(
                      start,
                      end,
                      String(orderedReadings[i - 1].read_at),
                      String(r.read_at),
                    ),
                );
                const previous = own
                  ? orderedReadings[orderedReadings.indexOf(own) - 1]
                  : null;
                const ownKwh =
                  own && previous
                    ? (consumptionBetween(
                        Number(previous.value_kwh),
                        Number(own.value_kwh),
                        previous.read_at,
                        own.read_at,
                      )?.kwh ?? null)
                    : null;
                return (
                  <div className="comparison-row" key={b.id}>
                    <span>
                      {formatDate(start)} – {formatDate(end)}
                    </span>
                    {ownKwh !== null && b.billed_kwh !== null && ownKwh >= 0 ? (
                      <>
                        <strong>
                          Medido {ownKwh.toLocaleString("es-CL")} kWh
                        </strong>
                        <strong>
                          Boleta {Number(b.billed_kwh).toLocaleString("es-CL")}{" "}
                          kWh
                        </strong>
                        <em
                          className={
                            compareBill(ownKwh, Number(b.billed_kwh))
                              ?.differenceKwh === 0
                              ? "match"
                              : ""
                          }
                        >
                          Diferencia{" "}
                          {(
                            compareBill(ownKwh, Number(b.billed_kwh))
                              ?.differenceKwh ?? 0
                          ).toLocaleString("es-CL")}{" "}
                          kWh
                        </em>
                      </>
                    ) : (
                      <small>
                        Sin comparación directa: las fechas del período deben
                        coincidir exactamente.
                      </small>
                    )}
                  </div>
                );
              })}
              {!bills.length && (
                <p className="muted">
                  Agrega una boleta y lecturas del mismo período para ver una
                  comparación.
                </p>
              )}
            </section>
            <p className="disclaimer">
              <CircleHelp size={15} /> Las diferencias sirven para revisar los
              registros. No indican por sí solas un error de facturación; las
              boletas pueden incluir cargos, ajustes e impuestos.
            </p>
          </>
        )}
        {section === "settings" && (
          <>
            <PageTitle
              eyebrow="ESPACIO COMPARTIDO"
              title="Configuración"
              description="Datos de tu hogar, invitaciones y perfil."
            />
            <div className="settings-grid">
              <section className="settings-card">
                <span className="settings-icon violet-icon">
                  <House size={19} />
                </span>
                <h2>Tu hogar</h2>
                <p>Nombre e integrantes conectados a este espacio.</p>
                <div className="settings-field">
                  <small>NOMBRE</small>
                  <strong>{household.name}</strong>
                  <button onClick={() => void editHousehold()}>Editar</button>
                </div>
                <div className="member-list">
                  <small>INTEGRANTES</small>
                  {householdMembers.map((m) => (
                    <div className="member-row" key={m.user_id}>
                      <span className="avatar">
                        {initials(
                          profiles[m.user_id] ||
                            (m.user_id === user.id ? user.name : "R"),
                        )}
                      </span>
                      <span>
                        <strong>
                          {profiles[m.user_id] ||
                            (m.user_id === user.id ? user.name : "Roommie")}
                        </strong>
                        <small>
                          {m.user_id === user.id ? "Tú" : "Integrante"} ·{" "}
                          {m.role === "admin" ? "Administrador" : "Miembro"}
                        </small>
                      </span>
                      {m.user_id === user.id && <CheckCircle2 size={17} />}
                    </div>
                  ))}
                </div>
                <button
                  className="secondary-btn full-btn"
                  onClick={() => void makeInvite()}
                  disabled={busy || householdMembers.length >= 2}
                >
                  <Users size={17} />
                  {householdMembers.length >= 2
                    ? "Hogar completo"
                    : "Copiar invitación para roommate"}
                </button>
                {inviteLink && (
                  <div className="invite-link">
                    <small>ENLACE DE INVITACIÓN · 7 DÍAS</small>
                    <code>{inviteLink}</code>
                    <button
                      onClick={() =>
                        void navigator.clipboard.writeText(inviteLink)
                      }
                    >
                      Copiar de nuevo
                    </button>
                  </div>
                )}
                <p className="field-hint">
                  El enlace se usa una sola vez. Compártelo solo con la persona
                  que quieres invitar.
                </p>
              </section>
              <section className="settings-card">
                <span className="settings-icon teal-icon">
                  <UserRound size={19} />
                </span>
                <h2>Tu perfil</h2>
                <p>El nombre que aparece en el historial compartido.</p>
                <div className="profile-settings">
                  <span className="avatar avatar-large">
                    {initials(user.name)}
                  </span>
                  <div>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </div>
                </div>
                <button
                  className="secondary-btn full-btn"
                  onClick={() => void changeProfile()}
                >
                  Editar nombre
                </button>
                <button className="signout-card" onClick={signOut}>
                  <LogOut size={17} /> Cerrar sesión
                </button>
              </section>
              <section className="settings-card meter-settings">
                <span className="settings-icon teal-icon">
                  <Bolt size={19} />
                </span>
                <h2>Recordatorio eléctrico</h2>
                <p>
                  Una fecha de referencia compartida para la lectura mensual.
                </p>
                <div className="settings-field">
                  <small>DÍA DEL MES</small>
                  <strong>Día {meter?.reminder_day ?? 20}</strong>
                  <button
                    onClick={async () => {
                      const v = prompt(
                        "Día mensual para recordar (1–28)",
                        String(meter?.reminder_day ?? 20),
                      );
                      if (!v || !meter) return;
                      const day = Number(v);
                      if (!Number.isInteger(day) || day < 1 || day > 28) {
                        flash("El día debe estar entre 1 y 28.", true);
                        return;
                      }
                      const { error } = await supabase()
                        .from("electric_meters")
                        .update({ reminder_day: day })
                        .eq("id", meter.id);
                      if (error) flash(errorText(error), true);
                      else {
                        setMeter({ ...meter, reminder_day: day });
                        flash("Recordatorio actualizado.");
                      }
                    }}
                  >
                    Cambiar
                  </button>
                </div>
                <p className="field-hint">
                  Zona horaria: America/Santiago · Unidad: kWh
                </p>
              </section>
              {(inactiveProducts.length > 0 || inactiveTasks.length > 0) && (
                <CatalogArchive
                  products={inactiveProducts}
                  tasks={inactiveTasks}
                  onProduct={restoreProduct}
                  onTask={restoreTask}
                />
              )}
            </div>
          </>
        )}
        <footer className="app-footer">
          <span>ROOMMIE</span>
          <span>Registrar y recordar, sin imponer.</span>
          <button onClick={() => setSection("settings")}>
            <CircleHelp size={14} /> Ayuda y ajustes
          </button>
        </footer>
      </main>
      <nav className="bottom-nav">
        {nav.map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={section === id ? "selected" : ""}
          >
            <Icon size={19} />
            <span>{label}</span>
            {id === "purchases" &&
              products.some((p) => p.status === "replenish") && <i />}
          </button>
        ))}
      </nav>
      {modal && (
        <Modal title={modalTitle(modal)} onClose={() => setModal(null)}>
          {modal === "purchase" ? (
            <PurchaseForm
              products={products}
              busy={busy}
              submit={submitPurchase}
            />
          ) : modal === "product" ? (
            <SimpleCreateForm
              title="Agregar producto"
              placeholder="Ej. Limpiapisos"
              label="Nombre del producto"
              busy={busy}
              onClose={() => setModal(null)}
              onSave={async (name, category) => {
                setBusy(true);
                try {
                  await addProduct(name, category || null);
                  if (household) await loadData(household.id);
                  setModal(null);
                  flash("Producto agregado al catálogo.");
                } catch (e) {
                  flash(errorText(e), true);
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : modal === "task" ? (
            <SimpleCreateForm
              title="Crear actividad"
              placeholder="Ej. Limpiar el baño"
              label="Nombre de la actividad"
              busy={busy}
              taskMode
              onClose={() => setModal(null)}
              onSave={async (name, frequency) => {
                setBusy(true);
                try {
                  await addTask(name, frequency ? Number(frequency) : null);
                  if (household) await loadData(household.id);
                  setModal(null);
                  flash("Actividad agregada a la bitácora.");
                } catch (e) {
                  flash(errorText(e), true);
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : modal === "completion" ? (
            <CompletionForm
              tasks={tasks}
              busy={busy}
              submit={submitCompletion}
            />
          ) : modal === "reading" ? (
            <ReadingForm
              busy={busy}
              submit={submitReading}
              latest={latestReading}
              meter={meter}
            />
          ) : (
            <BillForm busy={busy} submit={submitBill} />
          )}
        </Modal>
      )}
      <NoticeToast notice={notice} />
    </div>
  );
}

function errorText(e: unknown) {
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === "object" && e && "message" in e
        ? String((e as { message: unknown }).message)
        : "Ocurrió un error. Inténtalo de nuevo.";
  return msg.replace(/\s*\(https?:\/\/[^)]+\)/g, "");
}
function modalTitle(m: NonNullable<HomePageModal>) {
  return {
    purchase: "Registrar una compra",
    product: "Agregar producto",
    task: "Nueva actividad",
    completion: "Registrar actividad",
    reading: "Nueva lectura del medidor",
    bill: "Agregar una boleta",
  }[m];
}
type HomePageModal =
  "purchase" | "product" | "task" | "completion" | "reading" | "bill";
function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`}>
      <Image
        src="/roommie-logo.png"
        alt="ROOMMIE"
        width={compact ? 37 : 43}
        height={compact ? 37 : 43}
      />
      <span>
        ROOMMIE<small>Hogar en sintonía</small>
      </span>
    </div>
  );
}
function NoticeToast({ notice }: { notice: Notice | null }) {
  return notice ? (
    <div className={`toast ${notice.error ? "toast-error" : ""}`}>
      <span>
        {notice.error ? <CircleHelp size={17} /> : <CheckCircle2 size={18} />}
      </span>
      {notice.text}
      <button onClick={() => {}} aria-label="Cerrar">
        <X size={15} />
      </button>
    </div>
  ) : null;
}
function AuthScreen({
  mode,
  setMode,
  email,
  setEmail,
  password,
  setPassword,
  name,
  setName,
  busy,
  onSubmit,
  notice,
}: {
  mode: "login" | "signup" | "reset" | "update";
  setMode: (m: "login" | "signup" | "reset" | "update") => void;
  email: string;
  setEmail: (s: string) => void;
  password: string;
  setPassword: (s: string) => void;
  name: string;
  setName: (s: string) => void;
  busy: boolean;
  onSubmit: (e: FormEvent) => void;
  notice: Notice | null;
}) {
  return (
    <main className="auth-page">
      <div className="auth-art">
        <div className="art-orbit art-orbit-a" />
        <div className="art-orbit art-orbit-b" />
        <div className="art-copy">
          <Brand />
          <p className="eyebrow">UNA FORMA MÁS AMABLE DE COMPARTIR</p>
          <h1>
            Tu hogar,
            <br />
            en sintonía.
          </h1>
          <p>
            Compras, actividades y lecturas en un lugar compartido. Cada quien a
            su ritmo.
          </p>
          <div className="art-pill">
            <Check size={15} /> Registrar y recordar, sin imponer.
          </div>
        </div>
        <span className="art-footer">HECHO PARA COMPARTIR ESPACIO</span>
      </div>
      <div className="auth-panel">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-form-wrap">
          <div className="auth-icon">
            <Users size={21} />
          </div>
          <p className="eyebrow">
            {mode === "signup"
              ? "BIENVENIDO A ROOMMIE"
              : mode === "reset"
                ? "RECUPERA TU ACCESO"
                : mode === "update"
                  ? "NUEVA CONTRASEÑA"
                  : "QUÉ BUENO VERTE"}
          </p>
          <h2>
            {mode === "signup"
              ? "Crea tu cuenta"
              : mode === "reset"
                ? "Recupera tu contraseña"
                : mode === "update"
                  ? "Elige una contraseña nueva"
                  : "Iniciar sesión"}
          </h2>
          <p className="muted">
            {mode === "signup"
              ? "Comienza tu espacio compartido."
              : mode === "reset"
                ? "Te enviaremos un enlace a tu correo."
                : mode === "update"
                  ? "Actualiza tu acceso para volver a tu hogar."
                  : "Entra para ver cómo va el hogar."}
          </p>
          <form className="stack-form auth-form" onSubmit={onSubmit}>
            {mode === "signup" && (
              <label>
                Tu nombre
                <input
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="¿Cómo te llamamos?"
                  required
                  maxLength={80}
                />
              </label>
            )}
            <label>
              Correo electrónico
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
              />
            </label>
            {mode !== "reset" && (
              <label>
                Contraseña
                <input
                  type="password"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Al menos 8 caracteres"
                  minLength={8}
                  required
                />
              </label>
            )}
            {mode === "login" && (
              <button
                type="button"
                className="forgot-link"
                onClick={() => setMode("reset")}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
            <button className="primary-btn auth-submit" disabled={busy}>
              {busy
                ? "Un momento…"
                : mode === "signup"
                  ? "Crear cuenta"
                  : mode === "reset"
                    ? "Enviar enlace"
                    : mode === "update"
                      ? "Actualizar contraseña"
                      : "Entrar"}
              <ArrowRight size={17} />
            </button>
          </form>
          {mode === "login" || mode === "signup" ? (
            <p className="auth-switch">
              {mode === "signup"
                ? "¿Ya tienes cuenta?"
                : "¿Primera vez en ROOMMIE?"}{" "}
              <button
                onClick={() => setMode(mode === "signup" ? "login" : "signup")}
              >
                {mode === "signup" ? "Inicia sesión" : "Crea una cuenta"}
              </button>
            </p>
          ) : null}
          {mode === "reset" && (
            <button
              className="text-btn reset-back"
              onClick={() => setMode("login")}
            >
              <ArrowLeft size={15} /> Volver al inicio de sesión
            </button>
          )}
          <div className="auth-privacy">
            <span>
              <CheckCircle2 size={15} />
            </span>
            Tu espacio es privado y solo lo ven sus integrantes.
          </div>
        </div>
        <footer>ROOMMIE · Registrar y recordar, sin imponer.</footer>
      </div>
      <NoticeToast notice={notice} />
    </main>
  );
}
function SetupScreen() {
  return (
    <main className="setup-screen">
      <div className="setup-card">
        <Brand />
        <span className="setup-badge">
          <Settings size={15} /> FALTA UN PASO
        </span>
        <h1>Conectemos tu hogar.</h1>
        <p>
          La interfaz está lista. Para habilitar cuentas y sincronización,
          configura la URL y la clave pública del proyecto Supabase{" "}
          <strong>xcfltowyckznlhqnioqi</strong>.
        </p>
        <div className="env-box">
          <code>
            NEXT_PUBLIC_SUPABASE_URL=https://xcfltowyckznlhqnioqi.supabase.co
          </code>
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…</code>
        </div>
        <p className="field-hint">
          Copia la clave publicable desde Settings → API Keys en Supabase y crea{" "}
          <code>.env.local</code>. Nunca uses una secret key en el navegador.
          Después aplica la migración SQL de <code>supabase/migrations</code>.
        </p>
      </div>
    </main>
  );
}
function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
function ActivityFeed({
  items,
  profiles,
  onOpen,
}: {
  items: {
    date: string;
    title: string;
    icon: typeof ShoppingBasket;
    color: string;
  }[];
  profiles: Record<string, string>;
  onOpen: () => void;
}) {
  void profiles;
  return items.length ? (
    <div className="activity-card">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <div className="activity-row" key={`${item.date}-${i}`}>
            <span className={`activity-icon ${item.color}-icon`}>
              <Icon size={16} />
            </span>
            <p>{item.title}</p>
            <time>{formatDate(item.date)}</time>
          </div>
        );
      })}
      <button className="activity-more" onClick={onOpen}>
        Ver módulos <ArrowRight size={15} />
      </button>
    </div>
  ) : (
    <div className="empty-feed">
      <span>
        <Activity size={19} />
      </span>
      <div>
        <strong>La actividad aparecerá aquí</strong>
        <p>
          Cuando registren una compra, tarea o lectura, podrán verla en este
          espacio compartido.
        </p>
      </div>
    </div>
  );
}
function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
function CatalogArchive({
  products,
  tasks,
  onProduct,
  onTask,
}: {
  products: Product[];
  tasks: Task[];
  onProduct: (p: Product) => void;
  onTask: (t: Task) => void;
}) {
  return (
    <section className="settings-card archive-settings">
      <span className="settings-icon">
        <ArchiveRestore size={18} />
      </span>
      <h2>Catálogo desactivado</h2>
      <p>Reactivarlo conserva el historial anterior.</p>
      {products.map((p) => (
        <div className="member-row" key={p.id}>
          <span>
            <strong>{p.name}</strong>
            <small>Producto</small>
          </span>
          <button
            className="icon-btn"
            title="Reactivar producto"
            onClick={() => onProduct(p)}
          >
            <ArchiveRestore size={15} />
          </button>
        </div>
      ))}
      {tasks.map((t) => (
        <div className="member-row" key={t.id}>
          <span>
            <strong>{t.name}</strong>
            <small>Actividad</small>
          </span>
          <button
            className="icon-btn"
            title="Reactivar actividad"
            onClick={() => onTask(t)}
          >
            <ArchiveRestore size={15} />
          </button>
        </div>
      ))}
    </section>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">ROOMMIE · HOGAR COMPARTIDO</p>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function FormButtons({
  busy,
  label = "Guardar",
}: {
  busy: boolean;
  label?: string;
}) {
  return (
    <button className="primary-btn form-submit" disabled={busy}>
      {busy ? "Guardando…" : label}
      <ArrowRight size={16} />
    </button>
  );
}
function PhotoField({
  required = false,
  allowPdf = false,
}: {
  required?: boolean;
  allowPdf?: boolean;
}) {
  const [preview, setPreview] = useState("");
  return (
    <label className="file-field">
      Fotografía {required ? <em>Obligatoria</em> : <small>Opcional</small>}
      <span className="file-button">
        <Upload size={16} />
        {preview ? "Foto seleccionada" : "Tomar o elegir foto"}
        <input
          name="photo"
          type="file"
          accept={allowPdf ? "image/*,application/pdf" : "image/*"}
          capture="environment"
          required={required}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (preview) URL.revokeObjectURL(preview);
              setPreview(
                f.type.startsWith("image/")
                  ? URL.createObjectURL(f)
                  : "archivo PDF seleccionado",
              );
            }
          }}
        />
      </span>
      {preview && (
        <span className="file-preview">
          {preview.startsWith("blob:") ? (
            <Image
              src={preview}
              alt="Vista previa"
              width={480}
              height={200}
              unoptimized
            />
          ) : (
            <span>PDF listo para subir</span>
          )}
        </span>
      )}
      <small>
        {allowPdf ? "JPG, PNG, WebP o PDF" : "JPG, PNG o WebP"} · hasta 8 MB
      </small>
    </label>
  );
}
function PurchaseForm({
  products,
  busy,
  submit,
}: {
  products: Product[];
  busy: boolean;
  submit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="modal-form" onSubmit={submit}>
      <label>
        Producto
        <select name="product" defaultValue={products[0]?.id || "__new__"}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="__new__">+ Crear nuevo producto</option>
        </select>
      </label>
      <label className="nested-create">
        Si eliges “Crear nuevo producto”, escribe su nombre:
        <input name="newName" placeholder="Ej. Jabón para la loza" />
      </label>
      {products.length === 0 && (
        <p className="field-hint">
          El primer producto se creará junto con esta compra.
        </p>
      )}
      <div className="form-row">
        <label>
          Fecha
          <input name="date" type="date" defaultValue={dateInput()} required />
        </label>
        <label>
          Cantidad <small>Opcional</small>
          <input
            name="quantity"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="1"
          />
        </label>
      </div>
      <label>
        Unidad <small>Opcional</small>
        <input
          name="unit"
          placeholder="Litro, paquete, unidad…"
          maxLength={30}
        />
      </label>
      <PhotoField />
      <label>
        Nota <small>Opcional</small>
        <textarea
          name="notes"
          rows={2}
          placeholder="Un detalle para recordar"
          maxLength={1000}
        />
      </label>
      <p className="field-hint">
        Quedará registrada con tu perfil y hora local de Santiago.
      </p>
      <FormButtons busy={busy} label="Guardar compra" />
    </form>
  );
}
function SimpleCreateForm({
  title,
  placeholder,
  label,
  busy,
  onSave,
  onClose,
  taskMode = false,
}: {
  title: string;
  placeholder: string;
  label: string;
  busy: boolean;
  onSave: (name: string, extra?: string) => Promise<void>;
  onClose: () => void;
  taskMode?: boolean;
}) {
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  return (
    <form
      className="modal-form"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave(name, extra);
      }}
    >
      <label>
        {label}
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          required
          maxLength={100}
        />
      </label>
      {taskMode ? (
        <label>
          Frecuencia orientativa <small>Opcional</small>
          <div className="input-suffix">
            <input
              type="number"
              min={1}
              max={3650}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="Ej. 14"
            />
            <span>días</span>
          </div>
        </label>
      ) : (
        <label>
          Categoría <small>Opcional</small>
          <input
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="Ej. Limpieza"
            maxLength={60}
          />
        </label>
      )}
      <p className="field-hint">
        {taskMode
          ? "Es solo una referencia de tiempo, no un turno ni una obligación."
          : "Pueden cambiar el catálogo cuando lo necesiten."}
      </p>
      <div className="modal-actions">
        <button type="button" className="secondary-btn" onClick={onClose}>
          Cancelar
        </button>
        <FormButtons
          busy={busy}
          label={
            title.startsWith("Agregar")
              ? "Agregar producto"
              : "Guardar actividad"
          }
        />
      </div>
    </form>
  );
}
function CompletionForm({
  tasks,
  busy,
  submit,
}: {
  tasks: Task[];
  busy: boolean;
  submit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="modal-form" onSubmit={submit}>
      <label>
        Actividad
        <select name="task" defaultValue={tasks[0]?.id || "__new__"}>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          <option value="__new__">+ Crear actividad nueva</option>
        </select>
      </label>
      <label className="nested-create">
        Si eliges “Crear actividad nueva”, escribe el nombre:
        <input name="newName" placeholder="Ej. Limpiar el baño" />
      </label>
      <div className="form-row">
        <label>
          Fecha
          <input name="date" type="date" defaultValue={dateInput()} required />
        </label>
        <label>
          Frecuencia orientativa <small>Opcional</small>
          <input
            name="frequency"
            type="number"
            min="1"
            max="3650"
            placeholder="Días"
          />
        </label>
      </div>
      <PhotoField />
      <label>
        Observaciones <small>Opcional</small>
        <textarea
          name="notes"
          rows={2}
          maxLength={1000}
          placeholder="Un detalle de la actividad"
        />
      </label>
      <p className="field-hint">
        El historial muestra quién registró la actividad. No hay turnos ni
        próximos responsables.
      </p>
      <FormButtons busy={busy} label="Guardar actividad" />
    </form>
  );
}
function ReadingForm({
  busy,
  submit,
  latest,
  meter,
}: {
  busy: boolean;
  submit: (e: FormEvent<HTMLFormElement>) => void;
  latest: Reading | undefined;
  meter: Meter | null;
}) {
  return (
    <form className="modal-form" onSubmit={submit}>
      <div className="meter-reading-hint">
        <Bolt size={18} />
        <span>
          {meter?.name || "Medidor principal"} · unidad kWh
          <small>Escribe el valor acumulado que aparece en el medidor.</small>
        </span>
      </div>
      <label>
        Lectura acumulada (kWh)
        <input
          name="value"
          type="number"
          min="0"
          step="0.001"
          placeholder="Ej. 12620.000"
          required
        />
      </label>
      <div className="form-row">
        <label>
          Fecha
          <input name="date" type="date" defaultValue={dateInput()} required />
        </label>
        <label>
          Hora <small>Opcional</small>
          <input name="time" type="time" />
        </label>
      </div>
      <PhotoField required />
      <label>
        Observaciones <small>Opcional</small>
        <textarea
          name="notes"
          rows={2}
          placeholder="Cambio de medidor u otro detalle"
          maxLength={1000}
        />
      </label>
      {latest && (
        <p className="field-hint">
          Última lectura: {Number(latest.value_kwh).toLocaleString("es-CL")} kWh
          · {formatDate(latest.read_at)}. Un valor menor se puede guardar, pero
          se mostrará como inconsistencia.
        </p>
      )}
      <FormButtons busy={busy} label="Guardar lectura" />
    </form>
  );
}
function BillForm({
  busy,
  submit,
}: {
  busy: boolean;
  submit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="modal-form" onSubmit={submit}>
      <label>
        Distribuidora <small>Opcional</small>
        <input name="distributor" placeholder="Ej. Enel, CGE…" />
      </label>
      <label>
        Fecha de emisión
        <input name="issued" type="date" defaultValue={dateInput()} required />
      </label>
      <div className="form-row">
        <label>
          Inicio del período
          <input name="start" type="date" required />
        </label>
        <label>
          Fin del período
          <input name="end" type="date" required />
        </label>
      </div>
      <div className="form-row">
        <label>
          Consumo facturado (kWh)
          <input
            name="billed"
            type="number"
            min="0"
            step="0.001"
            placeholder="Opcional"
          />
        </label>
        <label>
          Monto total (CLP)
          <input
            name="amount"
            type="number"
            min="0"
            step="1"
            placeholder="Opcional"
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Lectura inicial (kWh)
          <input
            name="initial"
            type="number"
            min="0"
            step="0.001"
            placeholder="Si aparece"
          />
        </label>
        <label>
          Lectura final (kWh)
          <input
            name="final"
            type="number"
            min="0"
            step="0.001"
            placeholder="Si aparece"
          />
        </label>
      </div>
      <label>
        Otros cargos (CLP) <small>Opcional</small>
        <input
          name="charges"
          type="number"
          min="0"
          step="1"
          placeholder="Cargos adicionales"
        />
      </label>
      <PhotoField allowPdf />
      <label>
        Observaciones <small>Opcional</small>
        <textarea
          name="notes"
          rows={2}
          maxLength={1000}
          placeholder="Ajustes u otros datos de la boleta"
        />
      </label>
      <p className="field-hint">
        Solo se hará una comparación directa cuando las fechas coincidan
        exactamente.
      </p>
      <FormButtons busy={busy} label="Guardar boleta" />
    </form>
  );
}
