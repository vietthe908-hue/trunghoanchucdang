import { supabase } from './supabase';

export type GreetingCardResult = {
  out_id: string;
  out_token: string;
};

export type VerifiedCard = {
  sender_name: string;
  recipient_name: string | null;
  wish: string;
  style_index: number;
  verified: boolean;
};

export async function createGreetingCard(
  senderName: string,
  recipientName: string | null,
  wish: string,
  password: string,
  styleIndex: number,
): Promise<GreetingCardResult | null> {
  const { data, error } = await supabase.rpc('create_greeting_card', {
    p_sender_name: senderName,
    p_recipient_name: recipientName,
    p_wish: wish,
    p_password: password,
    p_style_index: styleIndex,
  });
  if (error || !data || data.length === 0) return null;
  return data[0] as GreetingCardResult;
}

export async function verifyGreetingCard(
  token: string,
  password: string,
): Promise<VerifiedCard | null> {
  const { data, error } = await supabase.rpc('verify_greeting_card', {
    p_token: token,
    p_password: password,
  });
  if (error || !data || data.length === 0) return null;
  return data[0] as VerifiedCard;
}
