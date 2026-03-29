export type MealType = "desayuno" | "almuerzo" | "merienda" | "cena";
export type BedType = "single" | "double";
export type ExpenseCategory = "comida" | "bebida" | "leña" | "transporte" | "otros";

export interface Event {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  created_by: string;
  created_at: string;
  is_active: boolean;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Attendee {
  id: string;
  event_id: string;
  profile_id: string | null;
  added_by: string;
  name: string;
  is_vegetarian: boolean;
  is_registered_user: boolean;
  created_at: string;
}

export interface AttendanceDay {
  id: string;
  attendee_id: string;
  event_id: string;
  date: string;
  is_present: boolean;
  day_part: "full" | "morning" | "afternoon";
}

export interface Meal {
  id: string;
  event_id: string;
  date: string;
  meal_type: MealType;
  total_people: number;
  vegetarian_count: number;
  notes: string | null;
}

export interface Drink {
  id: string;
  event_id: string;
  attendee_id: string;
  drink_name: string;
  quantity: number;
  unit: string;
  created_at: string;
}

export interface Bed {
  id: string;
  event_id: string;
  bed_type: BedType;
  label: string | null;
  count: number;
  created_at: string;
}

export interface Expense {
  id: string;
  event_id: string;
  paid_by: string;
  description: string;
  amount: number;
  category: ExpenseCategory | null;
  date: string;
  created_at: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  attendee_id: string;
  share_amount: number | null;
  is_excluded: boolean;
  is_custom_amount: boolean;
}

export interface EventHistory {
  id: string;
  event_id: string;
  snapshot_date: string;
  meals_data: Record<string, unknown>;
  drinks_data: Record<string, unknown>;
  expenses_data: Record<string, unknown>;
  attendees_data: Record<string, unknown>;
  total_expenses: number | null;
  per_person_average: number | null;
}

export interface Database {
  public: {
    Tables: {
      events: {
        Row: Event;
        Insert: Omit<Event, "id" | "created_at" | "is_active">;
        Update: Partial<Omit<Event, "id">>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at">;
        Update: Partial<Omit<Profile, "id">>;
      };
      attendees: {
        Row: Attendee;
        Insert: Omit<Attendee, "id" | "created_at" | "is_vegetarian" | "is_registered_user"> & {
          is_vegetarian?: boolean;
          is_registered_user?: boolean;
        };
        Update: Partial<Omit<Attendee, "id">>;
      };
      attendance_days: {
        Row: AttendanceDay;
        Insert: Omit<AttendanceDay, "id" | "is_present"> & { is_present?: boolean };
        Update: Partial<Omit<AttendanceDay, "id">>;
      };
      meals: {
        Row: Meal;
        Insert: Omit<Meal, "id" | "total_people" | "vegetarian_count"> & {
          total_people?: number;
          vegetarian_count?: number;
        };
        Update: Partial<Omit<Meal, "id">>;
      };
      drinks: {
        Row: Drink;
        Insert: Omit<Drink, "id" | "created_at">;
        Update: Partial<Omit<Drink, "id">>;
      };
      beds: {
        Row: Bed;
        Insert: Omit<Bed, "id" | "created_at" | "count"> & { count?: number };
        Update: Partial<Omit<Bed, "id">>;
      };
      expenses: {
        Row: Expense;
        Insert: Omit<Expense, "id" | "created_at">;
        Update: Partial<Omit<Expense, "id">>;
      };
      expense_splits: {
        Row: ExpenseSplit;
        Insert: Omit<ExpenseSplit, "id" | "is_excluded" | "is_custom_amount"> & {
          is_excluded?: boolean;
          is_custom_amount?: boolean;
        };
        Update: Partial<Omit<ExpenseSplit, "id">>;
      };
      event_history: {
        Row: EventHistory;
        Insert: Omit<EventHistory, "id" | "snapshot_date">;
        Update: Partial<Omit<EventHistory, "id">>;
      };
    };
  };
}
