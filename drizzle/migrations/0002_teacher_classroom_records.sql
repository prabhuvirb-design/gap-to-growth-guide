CREATE TABLE public.teacher_students (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
 class_name text NOT NULL DEFAULT '' CHECK (length(class_name) <= 100),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (id, teacher_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_students TO authenticated;
GRANT ALL ON public.teacher_students TO service_role;
ALTER TABLE public.teacher_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY teacher_students_own ON public.teacher_students FOR ALL TO authenticated USING (teacher_id = auth.uid() AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'teacher')) WITH CHECK (teacher_id = auth.uid() AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'teacher'));
CREATE TABLE public.teacher_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 150),
 subject text NOT NULL DEFAULT '' CHECK (length(subject) <= 100),
 due_date date,
 max_marks numeric NOT NULL DEFAULT 100 CHECK (max_marks > 0 AND max_marks <= 100000),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (id, teacher_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_assignments TO authenticated;
GRANT ALL ON public.teacher_assignments TO service_role;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY teacher_assignments_own ON public.teacher_assignments FOR ALL TO authenticated USING (teacher_id = auth.uid() AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'teacher')) WITH CHECK (teacher_id = auth.uid() AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'teacher'));
CREATE TABLE public.teacher_marks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 student_id uuid NOT NULL,
 assignment_id uuid NOT NULL,
 marks numeric NOT NULL CHECK (marks >= 0),
 feedback text NOT NULL DEFAULT '' CHECK (length(feedback) <= 1000),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (student_id, assignment_id),
 FOREIGN KEY (student_id, teacher_id) REFERENCES public.teacher_students(id, teacher_id) ON DELETE CASCADE,
 FOREIGN KEY (assignment_id, teacher_id) REFERENCES public.teacher_assignments(id, teacher_id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_marks TO authenticated;
GRANT ALL ON public.teacher_marks TO service_role;
ALTER TABLE public.teacher_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY teacher_marks_own ON public.teacher_marks FOR ALL TO authenticated USING (teacher_id = auth.uid() AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'teacher')) WITH CHECK (teacher_id = auth.uid() AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'teacher'));
CREATE FUNCTION public.validate_teacher_marks() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE maximum numeric;
BEGIN
 SELECT max_marks INTO maximum FROM public.teacher_assignments WHERE id = NEW.assignment_id AND teacher_id = NEW.teacher_id;
 IF maximum IS NULL OR NEW.marks > maximum THEN RAISE EXCEPTION 'Marks must be within the assignment maximum'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER teacher_marks_range BEFORE INSERT OR UPDATE ON public.teacher_marks FOR EACH ROW EXECUTE FUNCTION public.validate_teacher_marks();
CREATE INDEX teacher_students_owner ON public.teacher_students(teacher_id);
CREATE INDEX teacher_assignments_owner ON public.teacher_assignments(teacher_id);
CREATE INDEX teacher_marks_owner ON public.teacher_marks(teacher_id);