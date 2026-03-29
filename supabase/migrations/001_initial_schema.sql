-- ============================================
-- Recentales App - Initial Database Schema
-- ============================================

-- ==================
-- TABLES
-- ==================

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- Events
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Attendees
CREATE TABLE public.attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid REFERENCES public.profiles(id),
  added_by uuid REFERENCES public.profiles(id) NOT NULL,
  name text NOT NULL,
  is_vegetarian boolean DEFAULT false,
  is_registered_user boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Attendance Days
CREATE TABLE public.attendance_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendee_id uuid REFERENCES public.attendees(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  is_present boolean DEFAULT true,
  UNIQUE(attendee_id, date)
);

-- Meals
CREATE TABLE public.meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('desayuno', 'almuerzo', 'merienda', 'cena')),
  total_people integer DEFAULT 0,
  vegetarian_count integer DEFAULT 0,
  notes text,
  UNIQUE(event_id, date, meal_type)
);

-- Drinks
CREATE TABLE public.drinks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  attendee_id uuid REFERENCES public.attendees(id) ON DELETE CASCADE NOT NULL,
  drink_name text NOT NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Beds
CREATE TABLE public.beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  bed_type text NOT NULL CHECK (bed_type IN ('single', 'double')),
  label text,
  count integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  paid_by uuid REFERENCES public.attendees(id) NOT NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  category text CHECK (category IN ('comida', 'bebida', 'leña', 'transporte', 'otros')),
  date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Expense Splits
CREATE TABLE public.expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
  attendee_id uuid REFERENCES public.attendees(id) ON DELETE CASCADE NOT NULL,
  share_amount numeric(12,2),
  is_excluded boolean DEFAULT false,
  is_custom_amount boolean DEFAULT false,
  UNIQUE(expense_id, attendee_id)
);

-- Event History
CREATE TABLE public.event_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) NOT NULL,
  snapshot_date timestamptz DEFAULT now(),
  meals_data jsonb NOT NULL,
  drinks_data jsonb NOT NULL,
  expenses_data jsonb NOT NULL,
  attendees_data jsonb NOT NULL,
  total_expenses numeric(12,2),
  per_person_average numeric(12,2)
);

-- ==================
-- INDEXES
-- ==================

CREATE INDEX idx_attendees_event_id ON public.attendees(event_id);
CREATE INDEX idx_attendees_profile_id ON public.attendees(profile_id);
CREATE INDEX idx_attendees_added_by ON public.attendees(added_by);
CREATE INDEX idx_attendance_days_attendee_id ON public.attendance_days(attendee_id);
CREATE INDEX idx_attendance_days_event_id ON public.attendance_days(event_id);
CREATE INDEX idx_attendance_days_date ON public.attendance_days(date);
CREATE INDEX idx_meals_event_id ON public.meals(event_id);
CREATE INDEX idx_meals_date ON public.meals(date);
CREATE INDEX idx_drinks_event_id ON public.drinks(event_id);
CREATE INDEX idx_drinks_attendee_id ON public.drinks(attendee_id);
CREATE INDEX idx_beds_event_id ON public.beds(event_id);
CREATE INDEX idx_expenses_event_id ON public.expenses(event_id);
CREATE INDEX idx_expenses_paid_by ON public.expenses(paid_by);
CREATE INDEX idx_expense_splits_expense_id ON public.expense_splits(expense_id);
CREATE INDEX idx_expense_splits_attendee_id ON public.expense_splits(attendee_id);
CREATE INDEX idx_event_history_event_id ON public.event_history(event_id);
CREATE INDEX idx_events_created_by ON public.events(created_by);
CREATE INDEX idx_events_is_active ON public.events(is_active);

-- ==================
-- TRIGGER: Auto-create profile on signup
-- ==================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==================
-- FUNCTION: Create default beds when event is created
-- ==================

CREATE OR REPLACE FUNCTION public.create_default_beds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- 4 camas dobles
  INSERT INTO public.beds (event_id, bed_type, label, count)
  VALUES
    (NEW.id, 'double', 'Habitación 1', 1),
    (NEW.id, 'double', 'Habitación 2', 1),
    (NEW.id, 'double', 'Habitación 3', 1),
    (NEW.id, 'double', 'Habitación 4', 1);

  -- 10 camas simples
  INSERT INTO public.beds (event_id, bed_type, label, count)
  VALUES (NEW.id, 'single', 'Camas simples', 10);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_event_created_default_beds
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.create_default_beds();

-- ==================
-- FUNCTION: Auto-generate meals when attendance_days are created
-- ==================

CREATE OR REPLACE FUNCTION public.update_meals_for_day()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  meal_types text[] := ARRAY['desayuno', 'almuerzo', 'merienda', 'cena'];
  mt text;
  people_count integer;
  veg_count integer;
  v_event_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_event_id := OLD.event_id;
  ELSE
    v_event_id := NEW.event_id;
  END IF;

  FOREACH mt IN ARRAY meal_types
  LOOP
    SELECT
      COUNT(*) FILTER (WHERE ad.is_present = true),
      COUNT(*) FILTER (WHERE ad.is_present = true AND a.is_vegetarian = true)
    INTO people_count, veg_count
    FROM public.attendance_days ad
    JOIN public.attendees a ON a.id = ad.attendee_id
    WHERE ad.event_id = v_event_id
      AND ad.date = COALESCE(NEW.date, OLD.date);

    INSERT INTO public.meals (event_id, date, meal_type, total_people, vegetarian_count)
    VALUES (v_event_id, COALESCE(NEW.date, OLD.date), mt, people_count, veg_count)
    ON CONFLICT (event_id, date, meal_type)
    DO UPDATE SET
      total_people = EXCLUDED.total_people,
      vegetarian_count = EXCLUDED.vegetarian_count;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_attendance_day_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance_days
  FOR EACH ROW EXECUTE FUNCTION public.update_meals_for_day();

-- ==================
-- RLS POLICIES
-- ==================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_history ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user participates in an event
CREATE OR REPLACE FUNCTION public.user_is_event_participant(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.attendees
    WHERE event_id = p_event_id
      AND (profile_id = auth.uid() OR added_by = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.events
    WHERE id = p_event_id
      AND created_by = auth.uid()
  );
$$;

-- PROFILES
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- EVENTS
CREATE POLICY "Participants can view events"
  ON public.events FOR SELECT
  TO authenticated
  USING (public.user_is_event_participant(id) OR created_by = auth.uid());

CREATE POLICY "Authenticated users can create events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator can update event"
  ON public.events FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator can delete event"
  ON public.events FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ATTENDEES
CREATE POLICY "Participants can view attendees"
  ON public.attendees FOR SELECT
  TO authenticated
  USING (public.user_is_event_participant(event_id));

CREATE POLICY "Users can add attendees"
  ON public.attendees FOR INSERT
  TO authenticated
  WITH CHECK (added_by = auth.uid() AND public.user_is_event_participant(event_id));

CREATE POLICY "Users can update own attendees"
  ON public.attendees FOR UPDATE
  TO authenticated
  USING (added_by = auth.uid())
  WITH CHECK (added_by = auth.uid());

CREATE POLICY "Users can delete own attendees"
  ON public.attendees FOR DELETE
  TO authenticated
  USING (added_by = auth.uid());

-- ATTENDANCE_DAYS
CREATE POLICY "Participants can view attendance"
  ON public.attendance_days FOR SELECT
  TO authenticated
  USING (public.user_is_event_participant(event_id));

CREATE POLICY "Users can manage attendance for own attendees"
  ON public.attendance_days FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attendees
      WHERE id = attendee_id AND added_by = auth.uid()
    )
  );

CREATE POLICY "Users can update attendance for own attendees"
  ON public.attendance_days FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendees
      WHERE id = attendee_id AND added_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete attendance for own attendees"
  ON public.attendance_days FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendees
      WHERE id = attendee_id AND added_by = auth.uid()
    )
  );

-- MEALS
CREATE POLICY "Participants can view meals"
  ON public.meals FOR SELECT
  TO authenticated
  USING (public.user_is_event_participant(event_id));

CREATE POLICY "System can manage meals"
  ON public.meals FOR ALL
  TO authenticated
  USING (public.user_is_event_participant(event_id));

-- DRINKS
CREATE POLICY "Participants can view drinks"
  ON public.drinks FOR SELECT
  TO authenticated
  USING (public.user_is_event_participant(event_id));

CREATE POLICY "Users can manage drinks for own attendees"
  ON public.drinks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attendees
      WHERE id = attendee_id AND added_by = auth.uid()
    )
  );

CREATE POLICY "Users can update drinks for own attendees"
  ON public.drinks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendees
      WHERE id = attendee_id AND added_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete drinks for own attendees"
  ON public.drinks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendees
      WHERE id = attendee_id AND added_by = auth.uid()
    )
  );

-- BEDS
CREATE POLICY "Participants can view beds"
  ON public.beds FOR SELECT
  TO authenticated
  USING (public.user_is_event_participant(event_id));

CREATE POLICY "Creator can manage beds"
  ON public.beds FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Creator can update beds"
  ON public.beds FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Creator can delete beds"
  ON public.beds FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_id AND created_by = auth.uid()
    )
  );

-- EXPENSES
CREATE POLICY "Participants can view expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (public.user_is_event_participant(event_id));

CREATE POLICY "Participants can add expenses"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (public.user_is_event_participant(event_id));

CREATE POLICY "Users can update own expenses"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendees
      WHERE id = paid_by AND (profile_id = auth.uid() OR added_by = auth.uid())
    )
  );

CREATE POLICY "Users can delete own expenses"
  ON public.expenses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendees
      WHERE id = paid_by AND (profile_id = auth.uid() OR added_by = auth.uid())
    )
  );

-- EXPENSE_SPLITS
CREATE POLICY "Participants can view expense splits"
  ON public.expense_splits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id AND public.user_is_event_participant(e.event_id)
    )
  );

CREATE POLICY "Participants can manage expense splits"
  ON public.expense_splits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id AND public.user_is_event_participant(e.event_id)
    )
  );

CREATE POLICY "Participants can update expense splits"
  ON public.expense_splits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id AND public.user_is_event_participant(e.event_id)
    )
  );

CREATE POLICY "Participants can delete expense splits"
  ON public.expense_splits FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id AND public.user_is_event_participant(e.event_id)
    )
  );

-- EVENT_HISTORY
CREATE POLICY "Participants can view event history"
  ON public.event_history FOR SELECT
  TO authenticated
  USING (public.user_is_event_participant(event_id));

CREATE POLICY "Creator can manage event history"
  ON public.event_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_id AND created_by = auth.uid()
    )
  );
