export type Household = { id: string; name: string; created_by: string };
export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};
export type Product = {
  id: string;
  household_id: string;
  name: string;
  category: string | null;
  image_path: string | null;
  status: "available" | "replenish";
  active: boolean;
  created_at: string;
};
export type Purchase = {
  id: string;
  product_id: string;
  household_id: string;
  created_by: string;
  purchased_at: string;
  quantity: string | null;
  unit: string | null;
  photo_path: string | null;
  notes: string | null;
  products?: { name: string };
  profiles?: { display_name: string };
};
export type Task = {
  id: string;
  household_id: string;
  name: string;
  frequency_days: number | null;
  active: boolean;
};
export type Completion = {
  id: string;
  task_id: string;
  household_id: string;
  created_by: string;
  completed_at: string;
  photo_path: string | null;
  notes: string | null;
  household_tasks?: { name: string };
  profiles?: { display_name: string };
};
export type Meter = {
  id: string;
  household_id: string;
  name: string;
  meter_number: string | null;
  distributor: string | null;
  reminder_day: number;
  unit: string;
};
export type Reading = {
  id: string;
  meter_id: string;
  household_id: string;
  created_by: string;
  read_at: string;
  value_kwh: number;
  photo_path: string;
  notes: string | null;
  profiles?: { display_name: string };
};
export type Bill = {
  id: string;
  household_id: string;
  distributor: string | null;
  issued_at: string;
  period_start: string;
  period_end: string;
  billed_kwh: number | null;
  amount_clp: number | null;
  initial_reading_kwh: number | null;
  final_reading_kwh: number | null;
  photo_path: string | null;
  notes: string | null;
};
