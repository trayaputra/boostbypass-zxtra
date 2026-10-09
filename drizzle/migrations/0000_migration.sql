CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE TABLE public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  endpoint_url text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  headers_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  auth_mode text NOT NULL DEFAULT 'header',
  auth_header text NOT NULL DEFAULT 'x-apikey',
  input_parameter text NOT NULL DEFAULT 'url',
  response_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  timeout_ms integer NOT NULL DEFAULT 20000,
  enabled boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  theme_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_test_at timestamptz,
  last_test_status text,
  last_test_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.providers TO service_role;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.bypass_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  provider_slug text NOT NULL,
  status text NOT NULL,
  execution_time_ms integer,
  error_code text,
  input_host text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bypass_logs_created_idx ON public.bypass_logs (created_at DESC);
GRANT ALL ON public.bypass_logs TO service_role;
ALTER TABLE public.bypass_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.hit_rate_limit(_key text, _window_seconds integer, _max integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w timestamptz; c integer;
BEGIN
  w := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);
  INSERT INTO public.rate_limits(key, window_start, count) VALUES (_key, w, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
  RETURNING count INTO c;
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day';
  RETURN c <= _max;
END $$;
REVOKE EXECUTE ON FUNCTION public.hit_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hit_rate_limit(text, integer, integer) TO service_role;

INSERT INTO public.providers (name, slug, description, endpoint_url, method, auth_mode, auth_header, input_parameter, response_mapping, timeout_ms, enabled, sort_order, theme_config)
VALUES ('SFL', 'sfl', 'Resolve sfl.gl shortlinks', 'https://api.theresav.eu/api/bypass/sfl', 'GET', 'header', 'x-apikey', 'url',
 '{"successPath":"status","destinationPath":"bypassed_url","originalPath":"original_url","creatorPath":"creator","executionTimePath":"execution_time_ms","errorPath":"message"}'::jsonb,
 20000, true, 0, '{"color":"cyan","icon":"zap"}'::jsonb);