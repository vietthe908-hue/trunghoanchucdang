/*
# Fix verify_greeting_card search_path for pgcrypto

Same issue as create_greeting_card: crypt() from pgcrypto not found with search_path = public only.
*/

DROP FUNCTION IF EXISTS public.verify_greeting_card(text, text);

CREATE FUNCTION public.verify_greeting_card(
  p_token text,
  p_password text
)
RETURNS TABLE (
  sender_name text,
  wish text,
  style_index integer,
  verified boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
DECLARE
  v_card public.greeting_cards%ROWTYPE;
BEGIN
  SELECT * INTO v_card FROM public.greeting_cards WHERE token = p_token;
  IF NOT FOUND THEN
    sender_name := NULL;
    wish := NULL;
    style_index := NULL;
    verified := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_card.password_hash = crypt(p_password, v_card.password_hash) THEN
    UPDATE public.greeting_cards SET viewed_at = now() WHERE id = v_card.id;
    sender_name := v_card.sender_name;
    wish := v_card.wish;
    style_index := v_card.style_index;
    verified := true;
  ELSE
    sender_name := NULL;
    wish := NULL;
    style_index := NULL;
    verified := false;
  END IF;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_greeting_card FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_greeting_card TO anon, authenticated;
