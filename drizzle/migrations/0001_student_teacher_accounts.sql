CREATE TYPE public.account_role AS ENUM ('student', 'teacher');
CREATE TABLE public.user_roles (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 role public.account_role NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_read_own ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
INSERT INTO public.user_roles(user_id, role) SELECT id, 'student'::public.account_role FROM public.profiles;
CREATE FUNCTION public.claim_account_type(chosen public.account_role) RETURNS public.account_role LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE stored public.account_role;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), chosen) ON CONFLICT (user_id) DO NOTHING;
 SELECT role INTO stored FROM public.user_roles WHERE user_id = auth.uid();
 RETURN stored;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_account_type(public.account_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_account_type(public.account_role) TO authenticated;
CREATE FUNCTION public.assign_signup_account_type() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 -- These self-selected account categories never grant access to other learners' data.
 IF NEW.raw_app_meta_data->>'provider' = 'email' THEN
 INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, CASE WHEN NEW.raw_user_meta_data->>'account_type' = 'teacher' THEN 'teacher'::public.account_role ELSE 'student'::public.account_role END) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER assign_signup_account_type AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.assign_signup_account_type();