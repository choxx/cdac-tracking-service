SET check_function_bodies = false;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';
CREATE FUNCTION public.set_current_timestamp_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$;
CREATE SEQUENCE public.cdac_tracking_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE TABLE public.cdac_tracking (
    id bigint DEFAULT nextval('public.cdac_tracking_id_seq'::regclass) NOT NULL,
    message_id character varying NOT NULL,
    status smallint NOT NULL,
    last_retried_at timestamp with time zone,
    last_response text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public.cdac_tracking
    ADD CONSTRAINT cdac_tracking_message_id_key UNIQUE (message_id);
ALTER TABLE ONLY public.cdac_tracking
    ADD CONSTRAINT cdac_tracking_pkey PRIMARY KEY (id);
CREATE TRIGGER set_public_cdac_tracking_updated_at BEFORE UPDATE ON public.cdac_tracking FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_cdac_tracking_updated_at ON public.cdac_tracking IS 'trigger to set value of column "updated_at" to current timestamp on row update';
